import {normalizeBarcode} from './foods.mjs';
let libraryPromise;
function loadZXing(){
  if(globalThis.ZXingBrowser)return Promise.resolve(globalThis.ZXingBrowser);
  if(!libraryPromise)libraryPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src=new URL('./vendor/zxing-browser.min.js',import.meta.url).href;
    script.onload=()=>globalThis.ZXingBrowser?resolve(globalThis.ZXingBrowser):reject(new Error('Scanner non disponibile.'));
    script.onerror=()=>{libraryPromise=null;script.remove();reject(new Error('Scanner non disponibile. Inserisci il codice a mano.'));};
    document.head.append(script);
  });
  return libraryPromise;
}
export async function startScanner(video,onCode){
  if(!globalThis.isSecureContext||!navigator.mediaDevices?.getUserMedia)throw new Error('La fotocamera richiede HTTPS e un browser compatibile. Puoi inserire il codice a mano.');
  let stream,controls,timer,stopped=false,reader;
  const stop=()=>{stopped=true;clearTimeout(timer);controls?.stop();stream?.getTracks().forEach(track=>track.stop());video.pause();video.srcObject=null;};
  try{
    const formats=globalThis.BarcodeDetector?await BarcodeDetector.getSupportedFormats():[];
    const supported=['ean_13','ean_8','upc_a'].filter(f=>formats.includes(f));
    const native=supported.includes('ean_13');
    if(!native){const lib=await loadZXing();reader=new lib.BrowserMultiFormatReader();}
    stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false});
    if(native){
      video.srcObject=stream;await video.play();
      const detector=new BarcodeDetector({formats:supported});
      const tick=async()=>{
        if(stopped)return;
        try{const codes=await detector.detect(video);const match=codes.find(code=>normalizeBarcode(code.rawValue));if(!stopped&&match){const value=match.rawValue;stop();onCode(value);return;}}
        catch{/* A frame can be unavailable while the camera adjusts focus. */}
        if(!stopped)timer=setTimeout(tick,200);
      };
      timer=setTimeout(tick,200);
    }else{
      controls=await reader.decodeFromStream(stream,video,(result,error,callbackControls)=>{
        if(result&&!stopped&&normalizeBarcode(result.getText())){callbackControls?.stop();const value=result.getText();stop();onCode(value);}
      });
      if(stopped)controls.stop();
    }
    return stop;
  }catch(err){
    stop();
    if(err.name==='NotAllowedError')throw new Error('Accesso alla fotocamera negato. Abilitalo nelle impostazioni del browser oppure inserisci il codice a mano.');
    if(err.name==='NotFoundError')throw new Error('Nessuna fotocamera disponibile. Inserisci il codice a mano.');
    if(err.name==='NotReadableError')throw new Error('Fotocamera occupata da un’altra app. Chiudila e riprova, oppure scrivi il codice.');
    throw new Error(err.message||'Impossibile avviare la fotocamera. Puoi inserire il codice a mano.');
  }
}

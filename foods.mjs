import {NUTRIENTS, decimal} from './diary.mjs';

export function normalizeBarcode(value) {
  const code=String(value).replace(/[\s-]/g,'');
  if(!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(code))return null;
  let sum=0;
  for(let i=code.length-2,weight=3;i>=0;i--,weight=weight===3?1:3)sum+=Number(code[i])*weight;
  return (10-sum%10)%10===Number(code.at(-1))?code:null;
}
function value(n,key) {
  const raw=n[key];
  if(raw===undefined||raw===null||raw==='')return null;
  return decimal(raw,1000);
}
export function parseProduct(payload,barcode) {
  if(payload?.status!==1||!payload.product)return null;
  const p=payload.product,n=p.nutriments||{};
  let kcal=value(n,'energy-kcal_100g');
  if(kcal===null){const kj=decimal(n['energy-kj_100g']??(n.energy_unit==='kJ'?n.energy_100g:undefined),4200);if(kj!==null)kcal=kj/4.184;}
  const nutrients={kcal,protein:value(n,'proteins_100g'),carbs:value(n,'carbohydrates_100g'),fat:value(n,'fat_100g')};
  return {barcode,name:String(p.product_name_it||p.product_name||p.generic_name_it||p.generic_name||'Prodotto').slice(0,200),brand:String(p.brands||'').slice(0,200),nutrients,
    // OFF uses the _100g suffix for both mass and volume. Never infer the
    // nutrition unit from package size, category or serving size.
    unit:null,missing:NUTRIENTS.filter(k=>nutrients[k]===null),source:{label:'Open Food Facts',url:'https://world.openfoodfacts.org/product/'+barcode,retrievedAt:new Date().toISOString()},note:'Valori per 100 g o 100 ml: controlla la base sulla confezione.'};
}
export async function lookupBarcode(raw,{signal,fetcher=fetch}={}) {
  const barcode=normalizeBarcode(raw);
  if(!barcode)throw new Error('Inserisci un codice EAN/UPC valido di 8, 12, 13 o 14 cifre.');
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
  const abort=()=>controller.abort();
  if(signal?.aborted)controller.abort();
  signal?.addEventListener('abort',abort,{once:true});
  try {
    const fields='code,product_name,product_name_it,generic_name,generic_name_it,brands,nutriments,nutrition_data_per';
    const response=await fetcher('https://world.openfoodfacts.org/api/v2/product/'+barcode+'.json?fields='+fields,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer',headers:{'X-User-Agent':'CiboSano/2.0 (https://gabrirosa.github.io/cibo-sano/)'}});
    if(response.status===404)return null;
    if(response.status===429)throw new Error('Open Food Facts ha ricevuto troppe richieste. Riprova fra un minuto.');
    if(!response.ok)throw new Error('Il database dei prodotti non risponde. Riprova o inserisci l’etichetta.');
    let body;try{body=await response.json();}catch{throw new Error('Risposta del database non leggibile. Riprova o inserisci i valori dall’etichetta.');}
    return parseProduct(body,barcode);
  } catch(error) {
    if(error.name==='AbortError')throw new Error('Ricerca interrotta o troppo lenta. Riprova con una connessione stabile.');
    if(error instanceof TypeError)throw new Error('Connessione al database non disponibile. Puoi inserire i valori dall’etichetta.');
    throw error;
  } finally {clearTimeout(timeout);signal?.removeEventListener('abort',abort);}
}

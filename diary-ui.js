import {escapeHTML as e, normalize} from './lib.mjs';
import {MEALS,NUTRIENTS,DIARY_KEY,DiaryStore,withDiaryLock,localDate,shiftDate,validDate,decimal,nutrientsFor,sumEntries,createEntry,foodItem,recipeItem,catalogFoods,makeFood,safeLink} from './diary.mjs';
import {lookupBarcode,normalizeBarcode} from './foods.mjs';
import {startScanner} from './scanner.js';
import {exportReport} from './report-export.js';
import {validPortions,portionQuantity} from './portions.mjs';
import {createLabelOCR} from './label-ocr.mjs';
import {dailyNutritionHTML} from './insights-ui.js';

const $=id=>document.getElementById(id);
const fmt=(n,d=1)=>new Intl.NumberFormat('it-IT',{maximumFractionDigits:d}).format(n);
const labels={kcal:'Calorie',protein:'Proteine',carbs:'Carboidrati',fat:'Grassi'};
const macroLine=n=>`${fmt(n.kcal,0)} kcal · P ${fmt(n.protein)} g · C ${fmt(n.carbs)} g · G ${fmt(n.fat)} g`;
const options=(items,selected)=>Object.entries(items).map(([v,label])=>`<option value="${e(v)}" ${v===selected?'selected':''}>${e(label)}</option>`).join('');
function download(content,name) {
  const url=URL.createObjectURL(new Blob([content],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export function initDiary({toast,onSaved=()=>{}}) {
  let storage;
  try{storage=window.localStorage;}catch{}
  const store=new DiaryStore(storage);
  let data=null,catalog=[],day=localDate(),seenToday=day,diary=null,activeMeal='breakfast',mode='foods',selected=null,editing=null;
  const productCache=new Map();
  let reportDay=null,exportingPDF=false;
  let stopScanner=null,scannerSequence=0,lookupController=null,requestSequence=0,ocr=null,labelPhotoURL=null,foodEditing=null,initialEntry=null;
  const dialog=document.createElement('dialog');dialog.id='diary-dialog';dialog.setAttribute('aria-labelledby','diary-dialog-title');
  document.body.append(dialog);
  const sourceHTML=source=>safeLink(source?.url)?`<a href="${e(safeLink(source.url))}" target="_blank" rel="noopener noreferrer">${e(source.label)}</a>`:e(source?.label||'');
  function error(message){const target=$('diary-form-error');if(target){target.textContent=message;target.hidden=false;}else toast(message);}
  function read(){try{diary=store.read();$('diary-storage-error').hidden=true;return true;}catch(err){$('diary-storage-error').hidden=false;$('diary-storage-message').textContent=err.message;diary=null;return false;}}
  function render() {
    const ok=read();$('diary-date').value=day;
    if(reportDay!==day){$('diary-report-month').value=day.slice(0,7);reportDay=day;}
    $('diary-report-date').textContent=new Date(day+'T12:00:00').toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'});
    $('diary-date-label').textContent=new Date(day+'T12:00:00').toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long'});
    if(!ok){$('diary-totals').innerHTML='<p>Il diario non è disponibile. Le ricette restano consultabili.</p>';$('diary-meals').innerHTML='';return;}
    const entries=diary.entries.filter(v=>v.date===day);
    $('diary-totals').innerHTML=dailyNutritionHTML(diary,day);
    $('diary-meals').innerHTML=Object.entries(MEALS).map(([key,label],index)=>{
      const list=entries.filter(v=>v.meal===key),total=sumEntries(list);
      return `<section class="meal-card" aria-labelledby="meal-${key}"><div class="meal-heading"><div><span class="meal-number">0${index+1}</span><h2 id="meal-${key}">${label}</h2></div><button class="meal-add" data-add-meal="${key}" aria-label="Aggiungi a ${label.toLowerCase()}">+ Aggiungi</button></div>${list.length?`<ul class="meal-list">${list.map(entry=>`<li><button class="diary-entry" data-edit-entry="${e(entry.id)}" aria-label="Modifica ${e(entry.name)}"><span><b>${e(entry.name)}</b><small>${fmt(entry.quantity,2)} ${entry.unit==='porzione'?(entry.quantity===1?'porzione':'porzioni'):entry.unit}</small></span><span class="entry-energy">${fmt(nutrientsFor(entry).kcal,0)}<small>kcal <span aria-hidden="true">↗</span></small></span></button></li>`).join('')}</ul><p class="meal-total">${macroLine(total)}</p>`:`<p class="meal-empty">Aggiungi una ricetta o quello che hai mangiato.</p>`}</section>`;
    }).join('');
  }
  function stopWork(){requestSequence++;lookupController?.abort();lookupController=null;scannerSequence++;stopScanner?.();stopScanner=null;ocr?.cancel();ocr=null;if(labelPhotoURL){URL.revokeObjectURL(labelPhotoURL);labelPhotoURL=null;}}
  function setDay(value){if(!validDate(value))return;const changed=day!==value;day=value;if(changed)window.dispatchEvent(new CustomEvent('cibo-sano:day-change',{detail:{date:day}}));}
  function close(){stopWork();dialog.close();selected=null;editing=null;foodEditing=null;initialEntry=null;}
  function shell(title,body) {
    dialog.innerHTML=`<div class="dialog-toolbar"><h2 id="diary-dialog-title">${e(title)}</h2><button type="button" class="text-button" data-diary-close>Chiudi ✕</button></div><div class="diary-dialog-body">${body}<p class="form-error" id="diary-form-error" role="alert" hidden></p></div>`;
    if(!dialog.open)dialog.showModal();
    dialog.scrollTop=0;
  }
  function picker() {
    stopWork();selected=null;editing=null;foodEditing=null;initialEntry=null;
    if(mode==='manage'){manageFoods();return;}
    shell(`Aggiungi · ${MEALS[activeMeal]}`,`<div class="add-tabs" role="group" aria-label="Come aggiungere"><button type="button" data-add-tab="foods" aria-pressed="${mode==='foods'}">Alimenti</button><button type="button" data-add-tab="recipes" aria-pressed="${mode==='recipes'}">Ricette</button><button type="button" data-add-tab="barcode" aria-pressed="${mode==='barcode'}">Codice a barre</button><button type="button" data-add-tab="manual" aria-pressed="${mode==='manual'}">Da etichetta</button></div><div id="diary-picker-content"></div>`);
    const content=$('diary-picker-content');
    if(mode==='foods'||mode==='recipes') {
      content.innerHTML=`<label class="field"><span>${mode==='foods'?'Cerca un alimento':'Cerca una ricetta'}</span><input id="diary-search" type="search" autocomplete="off" placeholder="${mode==='foods'?'Es. pane, banana, yogurt':'Nome o ingrediente'}"></label><p class="muted-copy">${mode==='foods'?'Alimenti di base e prodotti già salvati. Controlla marca e stato: crudo, cotto o sgocciolato.':'Le dosi iniziali valgono per una porzione. Per cambiare i singoli ingredienti apri la ricetta nella sezione Ricette.'}</p>${mode==='foods'?'<button type="button" class="secondary-button" data-manage-foods>I tuoi alimenti e le tue porzioni</button>':''}<div id="diary-search-results" class="picker-results"></div>`;
      $('diary-search').addEventListener('input',renderSearch);renderSearch();
    } else if(mode==='barcode') {
      content.innerHTML=`<p class="muted-copy">Inquadra il codice sulla confezione, oppure scrivilo. Verrà inviato solo il numero a Open Food Facts, mai il video.</p><div class="barcode-search"><label class="field"><span>Codice EAN / UPC</span><input id="diary-barcode" inputmode="numeric" autocomplete="off" placeholder="8, 12, 13 o 14 cifre"></label><button type="button" class="primary-button" id="diary-lookup">Cerca</button></div><button type="button" class="secondary-button" id="diary-camera">Apri fotocamera</button><div id="diary-camera-area" hidden><video id="diary-video" autoplay muted playsinline></video><p id="diary-camera-state" role="status">Inquadra il codice con buona luce.</p><button type="button" class="secondary-button" id="diary-stop-camera">Ferma fotocamera</button></div><p id="diary-lookup-status" role="status"></p><p class="muted-copy">Prodotto non presente? Puoi sempre usare <button type="button" class="inline-button" data-add-tab="manual">Da etichetta</button>.</p><p class="source-attribution">Dati collaborativi di <a href="https://world.openfoodfacts.org" target="_blank" rel="noopener noreferrer">Open Food Facts</a> · <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noopener noreferrer">ODbL</a>. Verifica i valori sulla confezione.</p>`;
      $('diary-lookup').addEventListener('click',searchBarcode);
      $('diary-barcode').addEventListener('keydown',ev=>{if(ev.key==='Enter'){ev.preventDefault();searchBarcode();}});
      $('diary-camera').addEventListener('click',camera);
      $('diary-stop-camera').addEventListener('click',()=>{scannerSequence++;stopScanner?.();stopScanner=null;$('diary-camera-area').hidden=true;});
    } else {selected={name:'',type:'food',unit:'g',nutrients:{kcal:null,protein:null,carbs:null,fat:null},source:{label:'Etichetta inserita da te',url:''},origin:'custom'};editor(true);}
  }
  function allFoods() {return [...(diary?.foods||[]).slice().reverse(),...catalog];}
  function renderSearch(){
    const query=normalize($('diary-search').value).trim();
    const all=mode==='foods'?allFoods():(data?.recipes||[]);
    const filtered=all.filter(item=>normalize((item.name||item.title)+' '+(item.ingredients?.map(i=>i.name).join(' ')||'')).includes(query));
    $('diary-search-results').innerHTML=filtered.slice(0,40).map(item=>{
      const isFood=mode==='foods';const n=isFood?item.nutrients:recipeItem(item,data.foods).nutrients;
      return `<button type="button" class="picker-item" data-pick-${isFood?'food':'recipe'}="${e(item.id)}"><span><b>${e(item.name||item.title)}</b><small>${isFood?`Per 100 ${item.unit} · ${e(item.source.label)}`:'Per 1 porzione'}</small></span><strong>${fmt(n.kcal,0)}<small>kcal +</small></strong></button>`;
    }).join('')+(filtered.length>40?'<p class="muted-copy">Mostrati i primi 40 risultati. Scrivi per restringere la ricerca.</p>':'')+(filtered.length?'':`<p class="muted-copy">${data?'Nessun risultato. Usa “Da etichetta” per aggiungere un alimento.':'Ricettario in caricamento. Puoi già aggiungere un alimento da etichetta.'}</p>`);
  }
  async function searchBarcode(){
    const code=normalizeBarcode($('diary-barcode').value);if(!code){error('Controlla il codice: servono 8, 12, 13 o 14 cifre con cifra di controllo valida.');return;}
    scannerSequence++;stopScanner?.();stopScanner=null;$('diary-camera-area').hidden=true;
    const remembered=diary?.foods.find(f=>f.barcode===code);
    if(remembered){selected=foodItem(remembered);editor();return;}
    lookupController?.abort();lookupController=new AbortController();const sequence=++requestSequence;
    $('diary-form-error').hidden=true;$('diary-lookup').disabled=true;$('diary-lookup-status').textContent='Ricerca del prodotto…';
    try {
      const found=productCache.has(code)?productCache.get(code):await lookupBarcode(code,{signal:lookupController.signal});if(sequence!==requestSequence)return;
      productCache.set(code,found);
      if(!found){$('diary-lookup-status').textContent='Prodotto non trovato. Inserisci i valori con “Da etichetta”.';return;}
      selected={...found,type:'food',origin:'off'};editor(true);
    }catch(err){if(sequence===requestSequence){$('diary-lookup-status').textContent='';error(err.message);}}
    finally{if(sequence===requestSequence&&$('diary-lookup'))$('diary-lookup').disabled=false;}
  }
  async function camera(){
    stopScanner?.();stopScanner=null;const sequence=++scannerSequence;
    $('diary-camera-area').hidden=false;$('diary-form-error').hidden=true;$('diary-camera-state').textContent='Avvio fotocamera…';$('diary-camera').disabled=true;
    try {
      const stop=await startScanner($('diary-video'),code=>{
        if(sequence!==scannerSequence||!normalizeBarcode(code))return;
        $('diary-barcode').value=code;searchBarcode();
      });
      if(sequence!==scannerSequence){stop();return;}stopScanner=stop;$('diary-camera-state').textContent='Inquadra il codice con buona luce. La lettura avviene sul dispositivo.';
    }catch(err){if(sequence===scannerSequence){$('diary-camera-area').hidden=true;error(err.message);}}
    finally{if($('diary-camera'))$('diary-camera').disabled=false;}
  }
  function blankFood() {
    return {name:'',type:'food',unit:'g',nutrients:{kcal:null,protein:null,carbs:null,fat:null},source:{label:'Etichetta inserita da te',url:''},origin:'custom'};
  }
  function manageFoods() {
    stopWork();
    if(!read())return;
    const foods=[...diary.foods].reverse();
    shell('I tuoi alimenti',`<button type="button" class="text-button" data-back-foods>← Torna agli alimenti</button><p class="muted-copy">Salva prodotti e porzioni da riutilizzare. Le modifiche valgono per le prossime aggiunte; le voci già nel diario conservano quantità e valori originali.</p><button type="button" class="primary-button" data-new-food>+ Salva un alimento da etichetta</button><div class="personal-food-list">${foods.length?foods.map(food=>`<article class="personal-food"><div><b>${e(food.name)}</b><p>${macroLine(food.nutrients)} · per 100 ${food.unit}</p>${food.portions?.length?`<small>${food.portions.map(portion=>`${e(portion.name)}: ${fmt(portion.quantity,2)} ${food.unit}`).join(' · ')}</small>`:''}</div><div class="personal-food-actions"><button type="button" class="secondary-button" data-edit-food="${e(food.id)}">Modifica</button><button type="button" class="text-button danger-button" data-remove-food="${e(food.id)}" aria-label="Rimuovi ${e(food.name)} dagli alimenti salvati">Rimuovi</button></div></article>`).join(''):'<p class="muted-copy">Nessun alimento personale salvato.</p>'}</div>`);
  }
  function editPersonal(id) {
    if(!read())return;
    const food=diary.foods.find(item=>item.id===id);
    if(!food){error('Questo alimento è stato rimosso.');return;}
    foodEditing=structuredClone(food);selected=foodItem(food);editing=null;initialEntry=null;
    editor(true,{foodOnly:true});
  }
  function portionRow(portion={name:'',quantity:''},unit='g') {
    return `<div class="portion-row" data-portion-row><label class="field"><span>Nome porzione</span><input data-portion-name value="${e(portion.name)}" maxlength="60" placeholder="Es. vasetto" autocomplete="off"></label><label class="field"><span>Quantità (<span data-portion-unit>${e(unit||'g/ml')}</span>)</span><input data-portion-quantity value="${e(String(portion.quantity))}" inputmode="decimal" placeholder="Es. 125" autocomplete="off"></label><button type="button" class="text-button danger-button" data-remove-portion aria-label="Rimuovi porzione">×</button></div>`;
  }
  function editor(editNutrition=false,{foodOnly=false}={}) {
    stopWork();const item=selected;
    const existing=editing!==null,recipe=item.type==='recipe',personal=diary?.foods.some(food=>food.id===item.id);
    const quantity=existing?item.quantity:initialEntry?.quantity??(recipe?1:100);
    const title=foodOnly?(foodEditing?'Modifica alimento salvato':'Salva un alimento'):existing?'Modifica voce':recipe?'Aggiungi la ricetta':'Aggiungi l’alimento';
    shell(title,`<button type="button" class="text-button" ${foodOnly?'data-manage-foods':'data-back-picker'} ${existing?'hidden':''}>← ${foodOnly?'I tuoi alimenti':'Scegli un’altra voce'}</button><form id="diary-entry-form"><label class="field"><span>Nome</span><input id="entry-name" value="${e(item.name)}" maxlength="200" required ${editNutrition?'':'readonly'}></label>${item.brand?`<p class="muted-copy">${e(item.brand)}</p>`:''}${item.note?`<p class="muted-copy">${e(item.note)}</p>`:''}${foodOnly?'<p class="muted-copy">La modifica dell’alimento vale per le prossime aggiunte al diario.</p>':`<div class="form-grid"><label class="field"><span>Giorno</span><input id="entry-date" type="date" value="${existing?item.date:initialEntry?.date??day}" min="1900-01-01" max="2200-12-31" required></label><label class="field"><span>Pasto</span><select id="entry-meal">${options(MEALS,existing?item.meal:initialEntry?.meal??activeMeal)}</select></label></div>`}<div class="form-grid">${foodOnly?'':`<label class="field"><span>Quantità mangiata</span><input id="entry-quantity" inputmode="decimal" value="${quantity}" required autocomplete="off" aria-describedby="entry-quantity-help"></label>`}<label class="field"><span>${recipe?'Unità':'Unità della quantità e dell’etichetta'}</span><select id="entry-unit" ${editNutrition?'':'disabled'} required>${recipe?'<option value="porzione">porzioni</option>':`<option value="">Controlla l’etichetta…</option>${options({g:'grammi · valori per 100 g',ml:'millilitri · valori per 100 ml'},item.unit)}`}</select></label></div>${!foodOnly&&!recipe&&item.portions?.length?`<div class="portion-shortcut form-grid"><label class="field"><span>Usa una porzione salvata</span><select id="entry-portion"><option value="">Quantità libera</option>${item.portions.map((portion,index)=>`<option value="${index}">${e(portion.name)} · ${fmt(portion.quantity,2)} ${item.unit}</option>`).join('')}</select></label><label class="field"><span>Numero di porzioni</span><input id="entry-portion-count" value="1" inputmode="decimal" autocomplete="off" disabled></label></div>`:''}<p id="entry-quantity-help" class="muted-copy">${recipe?'Le dosi sotto corrispondono a una porzione. Puoi registrare anche una frazione, ad esempio 0,5.':'Usa lo stesso stato dell’alimento di riferimento: crudo, cotto o sgocciolato. Le porzioni usano la stessa unità dell’alimento; grammi e millilitri non sono intercambiabili.'}</p>${editNutrition?`<section class="label-reader" aria-labelledby="label-reader-title"><h3 id="label-reader-title">Leggi una foto dell’etichetta</h3><p class="muted-copy">Il primo utilizzo scarica il lettore sul dispositivo. La foto resta qui e viene letta in locale. Inquadra solo la tabella, dritta e ben illuminata.</p><div class="label-photo-actions"><label class="secondary-button import-label">Scegli foto<input type="file" id="label-file" accept="image/jpeg,image/png,image/webp,image/bmp"></label><label class="secondary-button import-label">Scatta foto<input type="file" id="label-camera" accept="image/jpeg,image/png,image/webp" capture="environment"></label><button type="button" id="label-cancel" class="text-button" hidden>Annulla lettura</button></div><img id="label-photo" class="label-photo" alt="Foto dell’etichetta scelta, elaborata solo sul dispositivo" hidden><progress id="label-progress" max="1" value="0" aria-label="Avanzamento lettura etichetta" hidden></progress><p id="label-status" class="muted-copy" role="status"></p><details id="label-text-details" hidden><summary>Testo letto dalla foto</summary><textarea id="label-text" readonly rows="6" aria-label="Testo riconosciuto dall’etichetta"></textarea></details><label id="label-confirm-row" class="label-confirm" hidden><input type="checkbox" id="label-confirm"> Ho confrontato e corretto i valori con la confezione.</label></section><fieldset class="nutrition-fields"><legend>Valori dell’etichetta per 100 g / 100 ml</legend><p class="muted-copy">Completa tutti i valori e scegli l’unità sopra. Se un valore è zero, scrivi 0. I risultati della foto sono proposte da controllare.</p><div class="form-grid">${NUTRIENTS.map(key=>`<label class="field"><span>${labels[key]} (${key==='kcal'?'kcal':'g'})</span><input id="entry-${key}" inputmode="decimal" value="${item.nutrients[key]??''}" required autocomplete="off"></label>`).join('')}</div></fieldset><fieldset class="nutrition-fields"><legend>Le tue porzioni (facoltative)</legend><p class="muted-copy">Per esempio “vasetto” da 125 g o “bicchiere” da 200 ml. Inserisci la quantità di una porzione, nella stessa unità scelta sopra.</p><div id="portion-rows">${(item.portions||[]).map(portion=>portionRow(portion,item.unit)).join('')}</div><button type="button" id="portion-add" class="secondary-button">+ Aggiungi porzione</button><p id="portion-unit-notice" class="muted-copy" hidden>Hai cambiato unità: reinserisci le quantità delle porzioni in quella nuova. Non viene applicata alcuna conversione.</p></fieldset>`:`<p class="muted-copy">Valori di riferimento: ${macroLine(item.nutrients)} ${recipe?'per porzione':`per 100 ${item.unit}`}.</p>${personal&&!existing?`<button type="button" class="text-button" data-edit-food="${e(item.id)}">Modifica alimento e porzioni salvate</button>`:''}`}<section id="entry-preview" class="entry-preview" aria-live="polite"></section><p class="source-attribution">Fonte: ${sourceHTML(item.source)}${item.origin==='off'?' · ODbL · verifica con la confezione':''}</p>${recipe&&item.ingredients?`<details class="entry-ingredients"><summary>Ingredienti della porzione registrata</summary><ul>${item.ingredients.map(ingredient=>`<li>${e(ingredient.name)}: ${fmt(ingredient.grams,2)} g</li>`).join('')}</ul><p>La quantità mangiata moltiplica queste dosi. Il diario conserva questa versione della ricetta.</p></details>`:''}<div class="entry-actions"><button class="primary-button" type="submit">${foodOnly?'Salva alimento':existing?'Salva modifiche':'Aggiungi al diario'}</button>${editNutrition&&!foodOnly?'<button type="button" class="secondary-button" id="entry-save-food">Salva solo alimento</button>':''}${existing?'<button type="button" class="secondary-button danger-button" id="entry-delete">Rimuovi voce</button>':''}</div><p class="muted-copy">Salvato solo su questo browser. Kcal e macro sono stime.</p></form>`);
    const form=$('diary-entry-form');
    let labelRead=false,readSequence=0,currentUnit=$('entry-unit').value;
    const preview=()=>{
      const q=foodOnly?100:decimal($('entry-quantity').value),unit=$('entry-unit').value;
      const nutrients=editNutrition?Object.fromEntries(NUTRIENTS.map(key=>[key,decimal($('entry-'+key).value,1000)])):item.nutrients;
      const valid=q!==null&&q>0&&!!unit&&NUTRIENTS.every(key=>nutrients[key]!==null);
      $('entry-preview').innerHTML=valid?`<span>${foodOnly?`Valori salvati per 100 ${unit}`:'Questa aggiunta'}</span><strong>${macroLine(nutrientsFor({quantity:q,basis:recipe?1:100,nutrients}))}</strong>`:'<span>Completa quantità, unità e valori per vedere il totale.</span>';
    };
    const usePortion=()=>{
      const choice=$('entry-portion'),count=$('entry-portion-count');
      if(!choice)return;
      count.disabled=choice.value==='';
      if(choice.value!==''){
        const q=portionQuantity(item.portions[Number(choice.value)],count.value);
        $('entry-quantity').value=q===null?'':String(Math.round(q*1000000)/1000000);
      }
      preview();
    };
    $('entry-portion')?.addEventListener('change',usePortion);
    $('entry-portion-count')?.addEventListener('input',usePortion);
    $('entry-quantity')?.addEventListener('input',()=>{if($('entry-portion')){$('entry-portion').value='';$('entry-portion-count').disabled=true;}});
    form.addEventListener('input',preview);preview();
    if(editNutrition){
      $('portion-add').addEventListener('click',()=>{
        if($('portion-rows').children.length>=20){error('Puoi salvare al massimo 20 porzioni per alimento.');return;}
        $('portion-rows').insertAdjacentHTML('beforeend',portionRow(undefined,$('entry-unit').value));
        $('portion-rows').lastElementChild.querySelector('[data-portion-name]').focus();
      });
      $('portion-rows').addEventListener('click',event=>{event.target.closest('[data-remove-portion]')?.closest('[data-portion-row]').remove();});
      $('entry-unit').addEventListener('change',()=>{
        const unit=$('entry-unit').value;
        if(unit!==currentUnit&&$('portion-rows').children.length){
          $('portion-rows').querySelectorAll('[data-portion-quantity]').forEach(input=>{input.value='';});
          $('portion-unit-notice').hidden=false;
        }
        currentUnit=unit;
        $('portion-rows').querySelectorAll('[data-portion-unit]').forEach(label=>{label.textContent=unit||'g/ml';});preview();
      });
      const setBusy=busy=>{
        $('label-file').disabled=busy;$('label-camera').disabled=busy;$('label-cancel').hidden=!busy;$('label-progress').hidden=!busy;
        form.querySelectorAll('button[type="submit"],#entry-save-food').forEach(button=>{button.disabled=busy;});
      };
      const readLabel=async event=>{
        const file=event.target.files?.[0];if(!file)return;
        ocr?.cancel();const sequence=++readSequence;
        const reader=createLabelOCR({onProgress:message=>{
          if(ocr!==reader)return;
          const stage=message.status==='recognizing text'?'Lettura dell’etichetta':message.status?.includes('language')?'Caricamento lingua italiana':'Preparazione del lettore locale';
          const progress=Math.min(1,Math.max(0,message.progress||0));
          $('label-progress').value=progress;$('label-status').textContent=`${stage}… ${Math.round(progress*100)}%`;
        }});
        ocr=reader;setBusy(true);$('diary-form-error').hidden=true;
        $('label-status').textContent='Preparazione del lettore locale…';
        if(labelPhotoURL)URL.revokeObjectURL(labelPhotoURL);
        labelPhotoURL=URL.createObjectURL(file);$('label-photo').src=labelPhotoURL;$('label-photo').hidden=false;
        try{
          const result=await reader.recognize(file);
          if(ocr!==reader||sequence!==readSequence)return;
          const {candidates}=result;
          for(const key of NUTRIENTS)$('entry-'+key).value=candidates.nutrients[key]??'';
          const oldUnit=$('entry-unit').value;$('entry-unit').value=candidates.unit||'';
          if(oldUnit!==$('entry-unit').value)$('entry-unit').dispatchEvent(new Event('change',{bubbles:true}));
          $('label-text').value=result.text;$('label-text-details').hidden=false;
          labelRead=true;$('label-confirm-row').hidden=false;$('label-confirm').checked=false;
          $('label-status').textContent=`${candidates.missing.length===4?'Nessun valore leggibile con certezza.':'Controlla i valori proposti prima di salvare.'} ${candidates.warnings.join(' ')}`;preview();
        }catch(err){if(ocr===reader&&sequence===readSequence)$('label-status').textContent=err.name==='AbortError'?'Lettura annullata. Puoi inserire i valori a mano.':err.message;}
        finally{if(ocr===reader&&sequence===readSequence){ocr=null;setBusy(false);event.target.value='';}}
      };
      $('label-file').addEventListener('change',readLabel);$('label-camera').addEventListener('change',readLabel);
      $('label-cancel').addEventListener('click',()=>ocr?.cancel());
    }
    function buildFood(){
      if(labelRead&&!$('label-confirm').checked)throw new Error('Confronta i valori letti con la confezione e confermali prima di salvare.');
      const portions=[...($('portion-rows')?.querySelectorAll('[data-portion-row]')||[])].map(row=>({name:row.querySelector('[data-portion-name]').value.trim(),quantity:decimal(row.querySelector('[data-portion-quantity]').value)}));
      if(!validPortions(portions))throw new Error('Controlla le porzioni: nomi diversi di 1–60 caratteri e quantità maggiori di zero, fino a 10.000, nella stessa unità dell’alimento.');
      return makeFood({id:foodEditing?.id||item.id,name:$('entry-name').value,unit:$('entry-unit').value,nutrients:Object.fromEntries(NUTRIENTS.map(key=>[key,decimal($('entry-'+key).value,1000)])),origin:labelRead?'custom':item.origin,source:labelRead?{label:'Etichetta verificata da te',url:''}:item.source,barcode:item.barcode,portions});
    }
    async function saveOnly(){
      // Saving a reusable food does not require a diary quantity/date/meal.
      if(!['entry-name','entry-unit',...NUTRIENTS.map(key=>'entry-'+key)].every(id=>$(id).reportValidity()))return;
      const buttons=form.querySelectorAll('button[type="submit"],#entry-save-food');buttons.forEach(button=>{button.disabled=true;});
      try{
        const food=buildFood();
        await withDiaryLock(()=>store.saveFood(food,{expectedUpdatedAt:foodEditing?.updatedAt??null}));
        foodEditing=null;selected=null;read();mode='manage';manageFoods();onSaved();toast('Alimento e porzioni salvati. Puoi usarli nelle prossime aggiunte.');
      }catch(err){error(err.message);}finally{buttons.forEach(button=>{button.disabled=false;});}
    }
    $('entry-save-food')?.addEventListener('click',saveOnly);
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(foodOnly){await saveOnly();return;}
      const submit=event.submitter;if(submit?.disabled)return;if(submit)submit.disabled=true;
      try{
        const quantity=decimal($('entry-quantity').value),date=$('entry-date').value,meal=$('entry-meal').value;
        if(quantity===null||quantity<=0||!validDate(date))throw new Error('Inserisci una data valida e una quantità maggiore di zero, fino a 10.000.');
        if(existing)await withDiaryLock(()=>store.edit(item.id,{quantity,date,meal},{expectedUpdatedAt:item.updatedAt}));
        else{
          const food=editNutrition?buildFood():null,entryItem=food?foodItem(food):item;
          const entry=createEntry(entryItem,{quantity,date,meal});await withDiaryLock(()=>store.add(entry,food));
        }
        setDay(date);close();render();onSaved();toast('Voce salvata nel diario.');
      }catch(err){error(err.message);}finally{if(submit)submit.disabled=false;}
    });
    $('entry-delete')?.addEventListener('click',async()=>{
      const original={...item};
      try{await withDiaryLock(()=>store.remove(original.id,{expectedUpdatedAt:original.updatedAt}));close();render();$('diary-undo').hidden=false;$('diary-undo-label').textContent=`Rimosso: ${original.name}`;$('diary-undo-button').onclick=async()=>{try{await withDiaryLock(()=>store.add(original));$('diary-undo').hidden=true;render();}catch(err){toast(err.message);}};}catch(err){error(err.message);}
    });
  }
  function openAdd(meal){if(!read())return;activeMeal=meal;mode='foods';picker();}
  dialog.addEventListener('click',ev=>{
    if(ev.target===dialog||ev.target.closest('[data-diary-close]'))close();
    if(ev.target.closest('[data-manage-foods]')){mode='manage';picker();return;}
    if(ev.target.closest('[data-back-foods]')){mode='foods';picker();return;}
    if(ev.target.closest('[data-new-food]')){foodEditing=null;selected=blankFood();editing=null;editor(true,{foodOnly:true});return;}
    const editFood=ev.target.closest('[data-edit-food]');if(editFood){editPersonal(editFood.dataset.editFood);return;}
    const removeFood=ev.target.closest('[data-remove-food]');if(removeFood){
      const food=diary?.foods.find(item=>item.id===removeFood.dataset.removeFood);
      if(food)withDiaryLock(()=>store.removeFood(food.id,{expectedUpdatedAt:food.updatedAt??null})).then(()=>{manageFoods();onSaved();toast('Alimento rimosso. Le voci già nel diario sono conservate.');}).catch(err=>error(err.message));
      return;
    }
    const tab=ev.target.closest('[data-add-tab]');if(tab){mode=tab.dataset.addTab;picker();return;}
    if(ev.target.closest('[data-back-picker]')){picker();return;}
    const food=ev.target.closest('[data-pick-food]');if(food){selected=foodItem(allFoods().find(f=>f.id===food.dataset.pickFood));editor();return;}
    const recipe=ev.target.closest('[data-pick-recipe]');if(recipe){selected=recipeItem(data.recipes.find(r=>r.id===recipe.dataset.pickRecipe),data.foods);editor();}
  });
  dialog.addEventListener('close',stopWork);
  $('diary-meals').addEventListener('click',ev=>{
    const add=ev.target.closest('[data-add-meal]');if(add){openAdd(add.dataset.addMeal);return;}
    const edit=ev.target.closest('[data-edit-entry]');if(edit&&read()){selected=diary.entries.find(v=>v.id===edit.dataset.editEntry);if(selected){editing=selected.id;editor();}}
  });
  $('diary-date').addEventListener('change',()=>{if(validDate($('diary-date').value)){setDay($('diary-date').value);render();}});
  $('diary-prev').addEventListener('click',()=>{const next=shiftDate(day,-1);if(validDate(next)){setDay(next);render();}});
  $('diary-next').addEventListener('click',()=>{const next=shiftDate(day,1);if(validDate(next)){setDay(next);render();}});
  $('diary-today').addEventListener('click',()=>{setDay(localDate());render();});
  async function savePDF(kind){
    if(exportingPDF)return;
    const status=$('diary-report-status');exportingPDF=true;
    $('diary-pdf-day').disabled=true;$('diary-pdf-month').disabled=true;
    status.textContent='Preparazione del PDF…';
    try{const snapshot=store.read(),period=kind==='daily'?day:$('diary-report-month').value;
      const filename=await exportReport(snapshot,kind,period);status.textContent=`PDF pronto: ${filename}. Controlla i download del dispositivo.`;
    }catch(err){status.textContent=err.message;}
    finally{exportingPDF=false;$('diary-pdf-day').disabled=false;$('diary-pdf-month').disabled=false;}
  }
  $('diary-pdf-day').addEventListener('click',()=>savePDF('daily'));
  $('diary-pdf-month').addEventListener('click',()=>savePDF('monthly'));
  $('diary-recovery').addEventListener('click',()=>{try{const raw=storage.getItem(DIARY_KEY);if(!raw)throw new Error('Nessun dato recuperabile.');download(raw,'cibo-sano-diario-recupero.json');}catch(err){toast(err.message);}});
  addEventListener('cibo-sano:diary-change',render);
  addEventListener('storage',ev=>{if(ev.key===DIARY_KEY||ev.key===null)render();});
  function checkToday(){const now=localDate();if(now!==seenToday&&!dialog.open){if(day===seenToday)setDay(now);seenToday=now;render();}}
  setInterval(()=>{if(!document.hidden)checkToday();},60000);
  addEventListener('pagehide',stopWork);
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){scannerSequence++;stopScanner?.();stopScanner=null;if($('diary-camera-area'))$('diary-camera-area').hidden=true;if(ocr)ocr.cancel();return;}
    checkToday();render();
  });
  render();
  return {
    setData(incoming){data=incoming;catalog=catalogFoods(data.foods);if(dialog.open&&$('diary-search'))renderSearch();},
    getDay(){return day;},
    addItem(item,{date=day,meal='lunch',quantity=item.type==='recipe'?1:100}={}){
      if(!read())return;
      try{
        if(!validDate(date)||!Object.hasOwn(MEALS,meal)||decimal(quantity)===null||quantity<=0)throw new Error('Controlla data, pasto e quantità.');
        editing=null;foodEditing=null;activeMeal=meal;selected=item;initialEntry={date,meal,quantity};editor();
      }catch(err){toast(err.message);}
    },
    addRecipe(recipe,foods,quantities,servings){if(!read())return;try{editing=null;foodEditing=null;initialEntry=null;activeMeal='lunch';selected=recipeItem(recipe,foods,quantities,servings);editor();}catch(err){toast(err.message);}},
    render,
  };
}

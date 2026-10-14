import {escapeHTML as e, normalize} from './lib.mjs';
import {MEALS,NUTRIENTS,DIARY_KEY,DiaryStore,withDiaryLock,localDate,shiftDate,validDate,decimal,nutrientsFor,sumEntries,createEntry,foodItem,recipeItem,catalogFoods,makeFood,safeLink} from './diary.mjs';
import {lookupBarcode,normalizeBarcode} from './foods.mjs';
import {startScanner} from './scanner.js';
import {exportReport} from './report-export.js';

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
  let stopScanner=null,scannerSequence=0,lookupController=null,requestSequence=0;
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
    const entries=diary.entries.filter(v=>v.date===day),n=sumEntries(entries),goal=diary.goal;
    const remainder=goal===null?'Imposta un obiettivo se vuoi vedere quanto manca.':n.kcal<=goal?`${fmt(goal-n.kcal,0)} kcal disponibili su ${fmt(goal,0)}`:`${fmt(n.kcal-goal,0)} kcal oltre l’obiettivo di ${fmt(goal,0)}`;
    $('diary-totals').innerHTML=`<div class="daily-calories"><div><span class="eyebrow">ENERGIA REGISTRATA</span><p><strong>${fmt(n.kcal,0)}</strong> kcal</p><span>${remainder}</span></div><div class="daily-count">${entries.length}<span>${entries.length===1?'voce':'voci'}</span></div></div>${goal===null?'':`<progress value="${Math.min(n.kcal,goal)}" max="${goal}" aria-label="Calorie registrate rispetto all’obiettivo"></progress>`}<div class="daily-macros">${NUTRIENTS.slice(1).map(k=>`<div><span>${labels[k]}</span><strong>${fmt(n[k])}<small> g</small></strong></div>`).join('')}</div>`;
    $('diary-meals').innerHTML=Object.entries(MEALS).map(([key,label],index)=>{
      const list=entries.filter(v=>v.meal===key),total=sumEntries(list);
      return `<section class="meal-card" aria-labelledby="meal-${key}"><div class="meal-heading"><div><span class="meal-number">0${index+1}</span><h2 id="meal-${key}">${label}</h2></div><button class="meal-add" data-add-meal="${key}" aria-label="Aggiungi a ${label.toLowerCase()}">+ Aggiungi</button></div>${list.length?`<ul class="meal-list">${list.map(entry=>`<li><button class="diary-entry" data-edit-entry="${e(entry.id)}" aria-label="Modifica ${e(entry.name)}"><span><b>${e(entry.name)}</b><small>${fmt(entry.quantity,2)} ${entry.unit==='porzione'?(entry.quantity===1?'porzione':'porzioni'):entry.unit}</small></span><span class="entry-energy">${fmt(nutrientsFor(entry).kcal,0)}<small>kcal <span aria-hidden="true">↗</span></small></span></button></li>`).join('')}</ul><p class="meal-total">${macroLine(total)}</p>`:`<p class="meal-empty">Aggiungi una ricetta o quello che hai mangiato.</p>`}</section>`;
    }).join('');
    $('diary-goal').value=diary.goal??'';
  }
  function stopWork(){requestSequence++;lookupController?.abort();lookupController=null;scannerSequence++;stopScanner?.();stopScanner=null;}
  function close(){stopWork();dialog.close();selected=null;editing=null;}
  function shell(title,body) {
    dialog.innerHTML=`<div class="dialog-toolbar"><h2 id="diary-dialog-title">${e(title)}</h2><button type="button" class="text-button" data-diary-close>Chiudi ✕</button></div><div class="diary-dialog-body">${body}<p class="form-error" id="diary-form-error" role="alert" hidden></p></div>`;
    if(!dialog.open)dialog.showModal();
    dialog.scrollTop=0;
  }
  function picker() {
    stopWork();selected=null;editing=null;
    shell(`Aggiungi · ${MEALS[activeMeal]}`,`<div class="add-tabs" role="group" aria-label="Come aggiungere"><button type="button" data-add-tab="foods" aria-pressed="${mode==='foods'}">Alimenti</button><button type="button" data-add-tab="recipes" aria-pressed="${mode==='recipes'}">Ricette</button><button type="button" data-add-tab="barcode" aria-pressed="${mode==='barcode'}">Codice a barre</button><button type="button" data-add-tab="manual" aria-pressed="${mode==='manual'}">Da etichetta</button></div><div id="diary-picker-content"></div>`);
    const content=$('diary-picker-content');
    if(mode==='foods'||mode==='recipes') {
      content.innerHTML=`<label class="field"><span>${mode==='foods'?'Cerca un alimento':'Cerca una ricetta'}</span><input id="diary-search" type="search" autocomplete="off" placeholder="${mode==='foods'?'Es. pane, banana, yogurt':'Nome o ingrediente'}"></label><p class="muted-copy">${mode==='foods'?'Alimenti di base e prodotti già salvati. Controlla marca e stato: crudo, cotto o sgocciolato.':'Le dosi iniziali valgono per una porzione. Per cambiare i singoli ingredienti apri la ricetta nella sezione Ricette.'}</p><div id="diary-search-results" class="picker-results"></div>`;
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
    if(remembered){selected=foodItem(remembered);editor(true);return;}
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
  function editor(editNutrition=false) {
    stopWork();const item=selected;
    const existing=editing!==null,recipe=item.type==='recipe';
    const quantity=existing?item.quantity:recipe?1:100;
    shell(existing?'Modifica voce':recipe?'Aggiungi la ricetta':'Aggiungi l’alimento',`<button type="button" class="text-button" data-back-picker ${existing?'hidden':''}>← Scegli un’altra voce</button><form id="diary-entry-form"><label class="field"><span>Nome</span><input id="entry-name" value="${e(item.name)}" maxlength="200" required ${editNutrition?'':'readonly'}></label>${item.brand?`<p class="muted-copy">${e(item.brand)}</p>`:''}${item.note?`<p class="muted-copy">${e(item.note)}</p>`:''}<div class="form-grid"><label class="field"><span>Giorno</span><input id="entry-date" type="date" value="${existing?item.date:day}" min="1900-01-01" max="2200-12-31" required></label><label class="field"><span>Pasto</span><select id="entry-meal">${options(MEALS,existing?item.meal:activeMeal)}</select></label></div><div class="form-grid"><label class="field"><span>Quantità mangiata</span><input id="entry-quantity" inputmode="decimal" value="${quantity}" required autocomplete="off" aria-describedby="entry-quantity-help"></label><label class="field"><span>${recipe?'Unità':'Unità della quantità e dell’etichetta'}</span><select id="entry-unit" ${editNutrition?'':'disabled'} required>${recipe?'<option value="porzione">porzioni</option>':`<option value="">Controlla l’etichetta…</option>${options({g:'grammi · valori per 100 g',ml:'millilitri · valori per 100 ml'},item.unit)}`}</select></label></div><p id="entry-quantity-help" class="muted-copy">${recipe?'Le dosi sotto corrispondono a una porzione. Puoi registrare anche una frazione, ad esempio 0,5.':'Usa lo stesso stato dell’alimento di riferimento: crudo, cotto o sgocciolato. Grammi e millilitri non sono intercambiabili.'}</p>${editNutrition?`<fieldset class="nutrition-fields"><legend>Valori dell’etichetta per 100 g / 100 ml</legend><p class="muted-copy">Completa tutti i valori e scegli l’unità sopra. Se un valore è zero, scrivi 0.</p><div class="form-grid">${NUTRIENTS.map(k=>`<label class="field"><span>${labels[k]} (${k==='kcal'?'kcal':'g'})</span><input id="entry-${k}" inputmode="decimal" value="${item.nutrients[k]??''}" required autocomplete="off"></label>`).join('')}</div></fieldset>`:`<p class="muted-copy">Valori di riferimento: ${macroLine(item.nutrients)} ${recipe?'per porzione':`per 100 ${item.unit}`}.</p>`}<section id="entry-preview" class="entry-preview" aria-live="polite"></section><p class="source-attribution">Fonte: ${sourceHTML(item.source)}${item.origin==='off'?' · ODbL · verifica con la confezione':''}</p>${recipe&&item.ingredients?`<details class="entry-ingredients"><summary>Ingredienti della porzione registrata</summary><ul>${item.ingredients.map(i=>`<li>${e(i.name)}: ${fmt(i.grams,2)} g</li>`).join('')}</ul><p>La quantità mangiata moltiplica queste dosi. Il diario conserva questa versione della ricetta.</p></details>`:''}<div class="entry-actions"><button class="primary-button" type="submit">${existing?'Salva modifiche':'Aggiungi al diario'}</button>${existing?'<button type="button" class="secondary-button danger-button" id="entry-delete">Rimuovi voce</button>':''}</div><p class="muted-copy">Salvato solo su questo browser. Kcal e macro sono stime.</p></form>`);
    const preview=()=>{
      const q=decimal($('entry-quantity').value),unit=$('entry-unit').value;
      const n=editNutrition?Object.fromEntries(NUTRIENTS.map(k=>[k,decimal($('entry-'+k).value,1000)])):item.nutrients;
      const valid=q!==null&&q>0&&!!unit&&NUTRIENTS.every(k=>n[k]!==null);
      $('entry-preview').innerHTML=valid?`<span>Questa aggiunta</span><strong>${macroLine(nutrientsFor({quantity:q,basis:recipe?1:100,nutrients:n}))}</strong>`:'<span>Completa quantità, unità e valori per vedere il totale.</span>';
    };
    $('diary-entry-form').addEventListener('input',preview);preview();
    $('diary-entry-form').addEventListener('submit',async ev=>{
      ev.preventDefault();const submit=ev.submitter;if(submit?.disabled)return;if(submit)submit.disabled=true;
      try{
        const quantity=decimal($('entry-quantity').value),date=$('entry-date').value,meal=$('entry-meal').value;
        if(quantity===null||quantity<=0||!validDate(date))throw new Error('Inserisci una data valida e una quantità maggiore di zero, fino a 10.000.');
        if(existing){const entryId=editing;await withDiaryLock(()=>store.edit(entryId,{quantity,date,meal}));}
        else {
          let food=null,entryItem=item;
          if(editNutrition){food=makeFood({name:$('entry-name').value,unit:$('entry-unit').value,nutrients:Object.fromEntries(NUTRIENTS.map(k=>[k,decimal($('entry-'+k).value,1000)])),origin:item.origin,source:item.source,barcode:item.barcode});entryItem=foodItem(food);}
          const entry=createEntry(entryItem,{quantity,date,meal});await withDiaryLock(()=>store.add(entry,food));
        }
        day=date;close();render();onSaved();toast('Voce salvata nel diario.');
      }catch(err){error(err.message);}finally{if(submit)submit.disabled=false;}
    });
    $('entry-delete')?.addEventListener('click',async()=>{
      // Keep the original snapshot for an explicit undo after removing it.
      const original={...selected};
      try{const entryId=editing;await withDiaryLock(()=>store.remove(entryId));close();render();$('diary-undo').hidden=false;$('diary-undo-label').textContent=`Rimosso: ${original.name}`;$('diary-undo-button').onclick=async()=>{try{await withDiaryLock(()=>store.add(original));$('diary-undo').hidden=true;render();}catch(err){toast(err.message);}};}catch(err){error(err.message);}
    });
  }
  function openAdd(meal){if(!read())return;activeMeal=meal;mode='foods';picker();}
  dialog.addEventListener('click',ev=>{
    if(ev.target===dialog||ev.target.closest('[data-diary-close]'))close();
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
  $('diary-date').addEventListener('change',()=>{if(validDate($('diary-date').value)){day=$('diary-date').value;render();}});
  $('diary-prev').addEventListener('click',()=>{const next=shiftDate(day,-1);if(validDate(next)){day=next;render();}});
  $('diary-next').addEventListener('click',()=>{const next=shiftDate(day,1);if(validDate(next)){day=next;render();}});
  $('diary-today').addEventListener('click',()=>{day=localDate();render();});
  $('diary-goal-form').addEventListener('submit',async ev=>{ev.preventDefault();const input=$('diary-goal').value.trim(),goal=input===''?null:decimal(input);try{if(input!==''&&(goal===null||goal<1))throw new Error('Inserisci un obiettivo valido, oppure lascia il campo vuoto.');await withDiaryLock(()=>store.setGoal(goal));render();toast('Obiettivo aggiornato su questo dispositivo.');}catch(err){toast(err.message);}});
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
  $('diary-export').addEventListener('click',()=>{try{download(store.export(),`cibo-sano-diario-${localDate()}.json`);toast('Backup esportato. Conservalo in un luogo privato.');}catch(err){toast(err.message);}});
  $('diary-recovery').addEventListener('click',()=>{try{const raw=storage.getItem(DIARY_KEY);if(!raw)throw new Error('Nessun dato recuperabile.');download(raw,'cibo-sano-diario-recupero.json');}catch(err){toast(err.message);}});
  $('diary-import').addEventListener('change',async ev=>{const file=ev.target.files?.[0];if(!file)return;try{if(file.size>15000000)throw new Error('Backup troppo grande.');const raw=await file.text();const count=await withDiaryLock(()=>store.import(raw));render();toast(`${count} voci aggiunte. Le voci già presenti sono state conservate.`);}catch(err){toast(err.message);}finally{ev.target.value='';}});
  addEventListener('storage',ev=>{if(ev.key===DIARY_KEY||ev.key===null)render();});
  function checkToday(){const now=localDate();if(now!==seenToday&&!dialog.open){if(day===seenToday)day=now;seenToday=now;render();}}
  setInterval(()=>{if(!document.hidden)checkToday();},60000);
  addEventListener('pagehide',stopWork);
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){scannerSequence++;stopScanner?.();stopScanner=null;if($('diary-camera-area'))$('diary-camera-area').hidden=true;return;}
    checkToday();render();
  });
  render();
  return {setData(incoming){data=incoming;catalog=catalogFoods(data.foods);if(dialog.open&&$('diary-search'))renderSearch();},addRecipe(recipe,foods,quantities,servings){if(!read())return;try{editing=null;activeMeal='lunch';selected=recipeItem(recipe,foods,quantities,servings);editor();}catch(err){toast(err.message);}},render};
}

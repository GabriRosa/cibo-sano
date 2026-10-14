import {categories, categoryIcons, escapeHTML as e, filterRecipes, nutritionFor, nutrientKeys, parseGrams, scaleQuantities, validData, sourceURL, parseFavorites} from './lib.mjs';

import {initDiary} from './diary-ui.js';
import {initWeight} from './weight-ui.js';
import {initInsights} from './insights-ui.js';
import {initKitchen} from './kitchen-ui.js';
import {initRecipeVersions} from './recipe-versions-ui.js';
import {initBackup} from './backup-ui.js';
import {DiaryStore,DIARY_KEY,withDiaryLock,recipeItem} from './diary.mjs';

const $ = id => document.getElementById(id);
const heart = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.4 4.6a5.5 5.5 0 0 0-7.8 0l-.6.6-.6-.6a5.5 5.5 0 0 0-7.8 7.8L12 21l8.4-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>';
const favoriteKey = 'cibo-sano:favorites:v1';
let data = null, baseData = null, recipeMap = new Map(), favorites = new Set(), storageWarning = false;
let state = {query:'',category:'Tutte',view:'all',sort:'default'}, visibleLimit = 24;
let quantities = [], checkedIngredients = new Set();
let currentRecipe = null, servings = 1, toastTimer, installPrompt = null, registration = null;
let offlineReady = false, dataFromCache = false, initialController = !!navigator.serviceWorker?.controller;
let personalStorage=null;try{personalStorage=window.localStorage;}catch{}
const personalStore=new DiaryStore(personalStorage);
try { favorites = new Set(personalStore.read().favorites||[]); } catch { storageWarning = true; }

function toast(message) {
  $('toast').textContent = message;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4000);
}
const diaryUI=initDiary({toast,onSaved:()=>{location.hash='diario';showPage('diario');}});
const weightUI=initWeight({toast});
const insightsUI=initInsights({toast,storage:personalStorage,getDay:()=>diaryUI.getDay()});
const kitchenUI=initKitchen({toast,onOpenRecipe:id=>{location.hash='ricetta='+encodeURIComponent(id);},onLogRecipe:(item,options)=>diaryUI.addItem(item,options)});
const versionsUI=initRecipeVersions({toast,storage:personalStorage,onSaved:recipe=>{
  $('recipe-dialog').close();syncPersonalData();location.hash='ricetta='+encodeURIComponent(recipe.id);
}});
initBackup({toast,storage:personalStorage});
function syncPersonalData() {
  let personal;
  try{personal=personalStore.read();favorites=new Set(personal.favorites||[]);}catch{return;}
  if(!baseData)return;
  data={...baseData,recipes:[...(personal.personalRecipes||[]),...baseData.recipes]};
  recipeMap=new Map(data.recipes.map(r=>[r.id,r]));
  $('collection-count').textContent=`${baseData.recipes.length} ricette${personal.personalRecipes?.length?` e ${personal.personalRecipes.length} ${personal.personalRecipes.length===1?'versione personale':'versioni personali'}`:''}`;
  diaryUI.setData(data);kitchenUI.setData(data);render();updateDetailFavorite();
}
addEventListener('cibo-sano:diary-change',syncPersonalData);
addEventListener('storage',event=>{if(event.key===DIARY_KEY||event.key===null)syncPersonalData();});
function showPage(page) {
  for(const [route,id] of [['diario','diary'],['ricette','recipes'],['peso','weight'],['menu','kitchen'],['dispensa','pantry']]){
    const active=page===route;
    $(id+'-page').hidden=!active;
    if(active)$('nav-'+id).setAttribute('aria-current','page');
    else $('nav-'+id).removeAttribute('aria-current');
  }
  if(page==='peso')weightUI.render();
  if(page==='diario')diaryUI.render();
  if(page==='menu'||page==='dispensa')kitchenUI.render(page);
}
function connectionStatus() {
  $('connection').textContent = !navigator.onLine ? 'Offline' : dataFromCache ? 'Copia salvata' : offlineReady ? 'Pronto anche offline' : 'Online';
  $('offline-status').textContent = offlineReady ? 'Copia offline pronta su questo dispositivo.' : 'La copia offline sarà pronta dopo il primo caricamento online completo.';
}
async function setFavorite(id) {
  try {await withDiaryLock(()=>personalStore.update(current=>{
    const ids=new Set(current.favorites||[]);ids.has(id)?ids.delete(id):ids.add(id);return {...current,favorites:[...ids]};
  }));syncPersonalData();}
  catch(error){toast(error.message);}
}
function updateDetailFavorite() {
  if (!currentRecipe) return;
  const active = favorites.has(currentRecipe.id);
  $('recipe-favorite').innerHTML = heart;
  $('recipe-favorite').setAttribute('aria-pressed', String(active));
  $('recipe-favorite').setAttribute('aria-label', active ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti');
}
function typeLabel(recipe) {
  if(recipe.personal)return 'La tua versione';
  if (recipe.kind==='porzione') return 'Dosi proposte';
  if (recipe.completeness==='parziale') return 'Passaggi parziali';
  if (recipe.completeness==='tecnica') return 'Tecnica di cottura';
  if (!recipe.steps.length) return 'Solo ingredienti';
  return 'Con procedimento';
}
function preview(recipe) {
  return recipe.ingredients.length ? recipe.ingredients.map(i=>i.name).join(' · ') : recipe.ingredientText || 'Una tecnica da tenere a portata di mano.';
}
function card(recipe) {
  const active = favorites.has(recipe.id);
  const macros = nutritionFor(recipe, data.foods);
  return `<article class="recipe-card"><div class="card-top"><span class="category-label"><span class="category-icon" aria-hidden="true">${categoryIcons[recipe.category]}</span>${e(recipe.category)}</span><button type="button" class="icon-button card-favorite" data-favorite="${e(recipe.id)}" aria-label="${active?'Rimuovi':'Aggiungi'} ${e(recipe.title)} ${active?'dai':'ai'} preferiti" aria-pressed="${active}">${heart}</button></div><h3><button type="button" class="recipe-open" data-recipe="${e(recipe.id)}">${e(recipe.title)}</button></h3><p class="ingredient-preview">${e(preview(recipe))}</p><div class="card-bottom"><span class="${recipe.kind==='porzione'?'portion-label':'recipe-type'}">${e(recipe.portionLabel || '1 porzione')}</span>${recipe.kcal!==null?`<span class="calorie-label">≈ ${recipe.kcal} kcal</span>`:'<span aria-hidden="true">↗</span>'}</div>${macros?`<p class="card-macros" aria-label="Macronutrienti stimati per una porzione"><span title="Proteine">P <b>${fmt(macros.protein)} g</b></span><span title="Carboidrati">C <b>${fmt(macros.carbs)} g</b></span><span title="Grassi">G <b>${fmt(macros.fat)} g</b></span></p>`:''}</article>`;
}
function render() {
  if (!data) return;
  const filtered = filterRecipes(data.recipes, {...state, favorites});
  $('recipes').innerHTML = filtered.slice(0, visibleLimit).map(card).join('');
  $('favorite-count').textContent = data.recipes.filter(r=>favorites.has(r.id)).length;
  $('result-count').textContent = `${filtered.length} ${filtered.length===1?'scheda':'schede'}`;
  $('results-title').textContent = state.query ? 'Risultati della ricerca' : state.view==='personal' ? 'Le tue versioni' : state.view==='breakfast' ? 'Le tue colazioni' : state.view==='favorites' ? 'Le tue preferite' : state.view==='portions' ? 'Una porzione, già pensata' : state.category!=='Tutte' ? state.category : 'Trova la tua prossima idea';
  const collection = data.collectionNotes?.Colazioni;
  $('collection-notes').hidden = state.view!=='breakfast' || !collection;
  if (collection && state.view==='breakfast') {
    const unresolved = Array.isArray(collection.unresolved) ? collection.unresolved : [];
    $('collection-notes').innerHTML = `<summary>Da ${e(collection.sourceCount)} reel: ${e(collection.recipeCount)} ricette · ${unresolved.length} da completare</summary><p>Un reel contiene dieci idee, disponibili come schede separate. Le porzioni dei dolci indicano una fetta o un numero di pezzi; non sempre corrispondono a una colazione completa.</p>${unresolved.map(r=>`<p><b>${e(r.title)}</b> · @${e(r.author)}. ${e(r.reason)} ${sourceURL(r.url)?`<a href="${e(sourceURL(r.url))}" target="_blank" rel="noopener noreferrer">Apri il reel ↗</a>`:''}</p>`).join('')}`;
  }
  $('load-more').hidden = filtered.length <= visibleLimit;
  $('load-more').textContent = `Mostra altre ${Math.min(24, Math.max(0,filtered.length-visibleLimit))} ricette`;
  $('empty').hidden = filtered.length!==0;
  $('empty-title').textContent = state.view==='favorites' && !favorites.size ? 'Le tue preferite, tutte qui.' : 'Nessuna ricetta trovata';
  $('empty-copy').textContent = state.view==='favorites' && !favorites.size ? 'Tocca il cuore su una ricetta per ritrovarla in questa pagina.' : 'Prova un altro ingrediente o rimuovi un filtro.';
  document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed', String(b.dataset.view===state.view)));
  document.querySelectorAll('[data-category]').forEach(b=>b.setAttribute('aria-pressed', String(b.dataset.category===state.category)));
}
const fmt = (number, decimals=1) => new Intl.NumberFormat('it-IT', {maximumFractionDigits:decimals}).format(number);
function ingredientRow(i, index) {
  const note = i.name==='Uovo intero' ? 'Peso senza guscio; circa 50 g per un uovo medio.' : i.note || '';
  return `<li><input class="check" type="checkbox" id="ingredient-${index}" data-check="${index}" ${checkedIngredients.has(index)?'checked':''} aria-label="${e(i.name)} preparato"><label for="ingredient-${index}">${e(i.name)}${note?`<small>${e(note)}</small>`:''}</label><span class="gram-control"><input type="text" inputmode="decimal" autocomplete="off" class="gram-input" data-grams="${index}" value="${quantities[index]===null?'':String(quantities[index]).replace('.',',')}" aria-label="Grammi di ${e(i.name)}" aria-describedby="quantity-help" ${quantities[index]===null?'aria-invalid="true"':''}><span aria-hidden="true">g</span></span></li>`;
}
function nutritionSummary(recipe) {
  const total = nutritionFor(recipe, data.foods, quantities);
  const titles = {kcal:'kcal', protein:'Proteine', carbs:'Carboidrati', fat:'Grassi'};
  return `<p class="nutrition-title">Totale per ${servings} ${servings===1?'porzione':'porzioni'} · stima</p><div class="macro-grid">${nutrientKeys.map(key=>`<div><strong data-nutrient="${key}">${total?fmt(total[key],key==='kcal'?0:1):'—'}${key==='kcal'?'':'<small> g</small>'}</strong><span>${titles[key]}</span></div>`).join('')}</div>${total&&servings>1?`<p class="per-person">Per porzione: ${fmt(total.kcal/servings,0)} kcal · P ${fmt(total.protein/servings)} g · C ${fmt(total.carbs/servings)} g · G ${fmt(total.fat/servings)} g</p>`:''}${!total?'<p class="quantity-error">Inserisci un peso da 0 a 10.000 g per ogni ingrediente per calcolare i valori.</p>':''}`;
}
function nutritionSources(recipe) {
  return `<details class="nutrition-sources"><summary>Come sono calcolati kcal e macro</summary><p>Somma dei valori per 100 g moltiplicati per i grammi scelti. Sono stime: marca, varietà e cottura possono cambiare i valori. Le fonti si riferiscono agli alimenti crudi, salvo le indicazioni di cottura o sgocciolamento. Le calorie includono i fattori della fonte, perciò possono differire dal solo calcolo 4/4/9 dei macro.</p><p>Gli eventuali polioli sono inclusi nei carboidrati dell’etichetta, ma possono apportare meno energia dello zucchero. Sale e acqua non apportano calorie. Fonti e valori per 100 g (P: proteine, C: carboidrati, G: grassi):</p><ul>${recipe.ingredients.map(i=>{
    const f=i.food||data.foods?.[i.name]; if(!f)return `<li>${e(i.name)}: dati non disponibili.</li>`;
    let href=''; try {const u=new URL(f.url);if(u.protocol==='https:')href=u.href;} catch {}
    return `<li><b>${e(i.name)}</b>: ${fmt(f.kcal,0)} kcal · P ${fmt(f.protein)} g · C ${fmt(f.carbs)} g · G ${fmt(f.fat)} g.<br>${href?`<a href="${e(href)}" target="_blank" rel="noopener noreferrer">${e(f.source)}${f.code?' '+e(f.code):''}</a>`:e(f.source)} · ${e(f.reference)}${f.note?`<br>${e(f.note)}`:''}</li>`;
  }).join('')}</ul><p>Dati CoFID: Crown copyright, <a href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/" target="_blank" rel="noopener noreferrer">Open Government Licence v3.0</a>. Tracce conteggiate come zero. I prodotti di marca sono esempi di riferimento.</p></details>`;
}
function detail(recipe) {
  const isPortion = recipe.kind==='porzione';
  const isAdapted = recipe.quantityBasis==='adattamento';
  const additions = recipe.ingredients.some(i=>i.added);
  const basis = recipe.quantityNote || 'Quantità proposte per una persona, non indicate dall’autrice. L’olio comprende cottura e condimento.';
  const ingredientSection = `<div class="portion-controls"><h3>Ingredienti</h3><div class="stepper" aria-label="Numero di porzioni"><button type="button" id="portion-minus" aria-label="Riduci porzioni" ${servings<=1?'disabled':''}>−</button><span aria-live="polite">${servings} ${servings===1?'porzione':'porzioni'}</span><button type="button" id="portion-plus" aria-label="Aumenta porzioni" ${servings>=8?'disabled':''}>+</button></div></div><p id="quantity-help" class="quantity-help">Pesi totali per ${servings} ${servings===1?'porzione':'porzioni'}. Tocca i grammi per modificarli; usa 0 per escludere un ingrediente. Pesi a crudo e al netto degli scarti, salvo indicazioni di cottura o sgocciolamento.</p><ul class="ingredient-list">${recipe.ingredients.map((i,index)=>!i.added?ingredientRow(i,index):'').join('')}</ul>${additions?`<h3 class="section-subtitle">Per completare il pasto · aggiunte proposte</h3><ul class="ingredient-list">${recipe.ingredients.map((i,index)=>i.added?ingredientRow(i,index):'').join('')}</ul>`:''}<button type="button" id="reset-quantities" class="text-button">Ripristina dosi iniziali</button><p class="small-note">Le modifiche valgono finché questa scheda resta aperta.</p>`;
  const originalIngredients = recipe.ingredientText ? `<details class="nutrition-sources"><summary>Ingredienti e dosi riportati dalla fonte</summary><p>${e(recipe.ingredientText)}</p></details>` : '';
  const steps = recipe.steps.length ? `<h3>${isAdapted?'Preparazione con queste dosi':'Procedimento della fonte'}</h3><p class="small-note">${isAdapted?'Procedimento adattato alla porzione proposta. Tempi indicativi: controlla la cottura quando cambi le quantità.':'Il testo conserva dosi, varianti e tempi dell’autore. Per la versione calcolata usa gli ingredienti qui sopra; i tempi non cambiano automaticamente con le porzioni.'}</p><ol class="steps">${recipe.steps.map(step=>`<li><p>${e(step)}</p></li>`).join('')}</ol>` : `<div class="detail-note"><p>${isPortion?'La fonte propone il piatto senza descrivere il procedimento. Qui trovi ingredienti e dosi proposte per comporre il pasto.':'Il procedimento non è riportato nella fonte disponibile.'}</p></div>`;
  const source = sourceURL(recipe.url), extra = sourceURL(recipe.extraSource);
  const isInstagram = source && ['instagram.com','www.instagram.com'].includes(new URL(source).hostname);
  return `<div class="detail-body"><div class="detail-kicker">${e(recipe.category)}</div><h2 id="recipe-title">${e(recipe.title)}</h2><div class="detail-meta"><span>${e(typeLabel(recipe))}</span><span>${e(recipe.portionLabel || '1 porzione per persona')}</span>${recipe.sourceType==='Video e testi dell’autore'?'<span>Recuperata dal video</span>':''}</div><section id="nutrition-summary" class="nutrition-panel" aria-label="Valori nutrizionali stimati" aria-live="polite" aria-atomic="true">${nutritionSummary(recipe)}</section><div class="detail-note"><p><b>Dosi e stima nutrizionale.</b> ${e(basis)} I valori si riferiscono esclusivamente agli ingredienti pesati elencati qui sotto.</p></div>${ingredientSection}${originalIngredients}${nutritionSources(recipe)}${steps}${recipe.notes?`<div class="detail-note warning"><p>${e(recipe.notes)}</p></div>`:''}<div class="source-box"><p class="source-description">${e(recipe.sourceType)} · ${isInstagram?'@':''}${e(recipe.author)}</p>${source?`<a href="${e(source)}" target="_blank" rel="noopener noreferrer">${isInstagram?'Apri la fonte Instagram':'Apri la ricetta originale'} ↗</a>`:''}${extra?`<a href="${e(extra)}" target="_blank" rel="noopener noreferrer">Approfondimento dell’autore ↗</a>`:''}</div></div>`;
}
function renderDetail() {
  if (!currentRecipe) return;
  $('recipe-detail').innerHTML = detail(currentRecipe);
  $('recipe-detail').querySelector('#reset-quantities').insertAdjacentHTML('afterend',`<div class="recipe-personal-actions"><button type="button" id="recipe-save-version" class="secondary-button">Salva nuova versione</button><button type="button" id="recipe-plan" class="secondary-button">Aggiungi al menu</button>${currentRecipe.personal?'<button type="button" id="recipe-delete-version" class="text-button">Elimina questa versione</button>':''}</div>`);
  $('recipe-share').hidden=!!currentRecipe.personal;
  updateDetailFavorite();
}
function openRecipe(id) {
  const recipe = recipeMap.get(id);
  if (!recipe) { toast('Questa ricetta non è disponibile nel ricettario.'); return; }
  if (currentRecipe?.id!==id || JSON.stringify(currentRecipe.ingredients)!==JSON.stringify(recipe.ingredients)) { servings = 1; quantities=recipe.ingredients.map(i=>i.grams); checkedIngredients=new Set(); }
  currentRecipe = recipe;
  renderDetail();
  if (!$('recipe-dialog').open) $('recipe-dialog').showModal();
  $('recipe-dialog').scrollTop = 0;
}
function applyHash() {
  const id = new URLSearchParams(location.hash.slice(1)).get('ricetta');
  showPage(id||location.hash==='#ricette'?'ricette':location.hash==='#peso'?'peso':location.hash==='#menu'?'menu':location.hash==='#dispensa'?'dispensa':'diario');
  if (!data) return;
  if (id) openRecipe(id);
  else if ($('recipe-dialog').open) $('recipe-dialog').close();
}
function clearRecipeHash() {
  if (location.hash.startsWith('#ricetta=')) history.replaceState(null,'',location.pathname+location.search+'#ricette');
}
function resetFilters() {
  state = {query:'',category:'Tutte',view:'all',sort:'default'};
  $('search').value = ''; $('sort').value = 'default'; visibleLimit = 24; render();
}
async function loadData(manual=false) {
  $('refresh').disabled = true; $('refresh').classList.add('busy');
  try {
    const response = await fetch('./recipes.json', {cache:'no-store'});
    if (!response.ok) throw new Error('HTTP '+response.status);
    const incoming = await response.json();
    if (!validData(incoming)) throw new Error('Dati non validi');
    const previousVersion = data?.version;
    dataFromCache = response.headers.get('X-Cibo-Sano-Cache')==='fallback';
    baseData = incoming;data=incoming;recipeMap=new Map(data.recipes.map(r=>[r.id,r]));
    $('load-error').hidden = true;
    $('collection-count').textContent = `${data.recipes.length} schede da esplorare`;
    $('version-info').textContent = `Ricettario aggiornato al ${new Date(data.updatedAt+'T12:00:00').toLocaleDateString('it-IT')} · Versione ${data.version}`;
    syncPersonalData();diaryUI.setData(data);kitchenUI.setData(data);render(); applyHash();
    if (manual) toast(!navigator.onLine||dataFromCache?'Connessione non disponibile: stai usando la copia salvata.':previousVersion===data.version?'Il ricettario è già aggiornato.':'Ricettario aggiornato.');
  } catch {
    if (!data) {
      $('recipes').innerHTML = '';
      $('collection-count').textContent = 'Il ricettario ti aspetta';
      $('load-error').hidden = false;
      $('load-error-text').textContent = navigator.onLine ? 'Non riesco a caricare le ricette. Riprova tra poco.' : 'Per il primo accesso serve una connessione. Apri l’app online una volta per scaricare le ricette.';
    } else if (manual) toast('Aggiornamento non riuscito. Le ricette già caricate restano disponibili.');
  } finally {
    $('refresh').disabled = false; $('refresh').classList.remove('busy'); connectionStatus();
  }
}
async function refresh() {
  if (registration && navigator.onLine) {
    try { await registration.update(); } catch { /* Data refresh still works independently. */ }
  }
  await loadData(true);
}
async function setupOffline() {
  if (!('serviceWorker' in navigator)) { $('offline-help').textContent = 'Questo browser non supporta la copia offline. Usa Chrome aggiornato su Android.'; return; }
  try {
    registration = await navigator.serviceWorker.register('./sw.js', {scope:'./', updateViaCache:'none'});
    await navigator.serviceWorker.ready;
    offlineReady = true; connectionStatus();
    if (registration.waiting) registration.waiting.postMessage({type:'SKIP_WAITING'});
    registration.addEventListener('updatefound', ()=> {
      const worker = registration.installing;
      worker?.addEventListener('statechange', ()=> {
        if (worker.state==='installed' && navigator.serviceWorker.controller) worker.postMessage({type:'SKIP_WAITING'});
      });
    });
  } catch { $('offline-status').textContent = 'Copia offline non pronta. Riprova con una connessione stabile.'; }
}

$('categories').innerHTML = categories.map(c=>`<button type="button" class="category" data-category="${e(c)}" aria-pressed="${c==='Tutte'}"><span aria-hidden="true">${categoryIcons[c]}</span>${e(c)}</button>`).join('');
$('recipes').innerHTML = '<div class="loading-card"></div>'.repeat(6);
$('search').addEventListener('input', ()=>{state.query=$('search').value;visibleLimit=24;render();});
$('sort').addEventListener('change', ()=>{state.sort=$('sort').value;render();});
$('categories').addEventListener('click', event=>{const b=event.target.closest('[data-category]');if(b){state.category=b.dataset.category;visibleLimit=24;render();}});
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{state.view=b.dataset.view;visibleLimit=24;render();}));
$('recipes').addEventListener('click', event=>{
  const favorite = event.target.closest('[data-favorite]');
  if(favorite){const id=favorite.dataset.favorite;setFavorite(id);document.querySelector(`[data-favorite="${id}"]`)?.focus();return;}
  const button = event.target.closest('[data-recipe]');
  if(button) location.hash = 'ricetta='+encodeURIComponent(button.dataset.recipe);
});
$('load-more').addEventListener('click',()=>{const oldLimit=visibleLimit;visibleLimit+=24;render();document.querySelectorAll('.recipe-open')[oldLimit]?.focus();});
$('reset-filters').addEventListener('click',resetFilters);
document.querySelector('.brand').addEventListener('click',()=>{resetFilters();});
$('recipe-close').addEventListener('click',()=>$('recipe-dialog').close());
$('recipe-dialog').addEventListener('close',()=>{
  if($('recipe-dialog').open)return;
  const linkedId=new URLSearchParams(location.hash.slice(1)).get('ricetta');
  if(linkedId===currentRecipe?.id)clearRecipeHash();
  currentRecipe=null;
});
$('recipe-dialog').addEventListener('click', event=>{if(event.target===$('recipe-dialog')){$('recipe-dialog').close();}});
$('recipe-favorite').addEventListener('click',()=>{if(currentRecipe)setFavorite(currentRecipe.id);});
$('recipe-detail').addEventListener('click', event=>{
  if(event.target.closest('#recipe-save-version')){
    if(!nutritionFor(currentRecipe,data.foods,quantities)){toast('Completa tutti i grammi prima di salvare la versione.');return;}
    try{versionsUI.open(currentRecipe,data.foods,quantities,servings);}catch(error){toast(error.message);}return;
  }
  if(event.target.closest('#recipe-plan')){
    try{const item=recipeItem(currentRecipe,data.foods,quantities,servings);$('recipe-dialog').close();location.hash='menu';kitchenUI.planRecipe(item);}catch(error){toast(error.message);}return;
  }
  if(event.target.closest('#recipe-delete-version')){
    const id=currentRecipe.id;
    if(confirm('Eliminare questa versione dal tuo ricettario? Le voci già registrate nel diario e i pasti pianificati restano conservati.')){
      withDiaryLock(()=>personalStore.update(current=>({...current,personalRecipes:(current.personalRecipes||[]).filter(r=>r.id!==id),favorites:(current.favorites||[]).filter(value=>value!==id)}))).then(()=>{$('recipe-dialog').close();syncPersonalData();toast('Versione eliminata dal ricettario.');}).catch(error=>toast(error.message));
    }return;
  }
  const plus=event.target.closest('#portion-plus'),minus=event.target.closest('#portion-minus');
  if(plus||minus){const next=Math.max(1,Math.min(8,servings+(plus?1:-1)));quantities=scaleQuantities(quantities,servings,next);servings=next;renderDetail();$(plus?'portion-plus':'portion-minus')?.focus();}
  if(event.target.closest('#reset-quantities')){servings=1;quantities=currentRecipe.ingredients.map(i=>i.grams);renderDetail();$('reset-quantities')?.focus();}
});
$('recipe-detail').addEventListener('input',event=>{
  const field=event.target.closest('[data-grams]');if(!field||!currentRecipe)return;
  const value=parseGrams(field.value);quantities[Number(field.dataset.grams)]=value;
  field.setAttribute('aria-invalid',String(value===null));
  $('nutrition-summary').innerHTML=nutritionSummary(currentRecipe);
});
$('recipe-detail').addEventListener('change',event=>{
  const field=event.target.closest('[data-check]');if(!field)return;
  const index=Number(field.dataset.check);field.checked?checkedIngredients.add(index):checkedIngredients.delete(index);
});
$('recipe-log').addEventListener('click',()=>{
  if(!currentRecipe)return;
  if(!nutritionFor(currentRecipe,data.foods,quantities)){toast('Completa tutti i grammi prima di aggiungere la ricetta.');return;}
  const recipe=currentRecipe,weights=[...quantities],portions=servings;
  $('recipe-dialog').close();diaryUI.addRecipe(recipe,data.foods,weights,portions);
});
$('recipe-share').addEventListener('click',async()=>{
  if(!currentRecipe)return;
  const url=location.href;
  try {
    if(navigator.share) await navigator.share({title:currentRecipe.title,url});
    else {await navigator.clipboard.writeText(url);toast('Link della ricetta copiato.');}
  } catch(error) {if(error.name!=='AbortError')toast('Puoi copiare il link dalla barra degli indirizzi.');}
});
function showAbout(){$('about-dialog').showModal();}
$('about-open').addEventListener('click',showAbout);$('footer-about').addEventListener('click',showAbout);
$('about-close').addEventListener('click',()=>$('about-dialog').close());
$('about-dialog').addEventListener('click', event=>{if(event.target===$('about-dialog'))$('about-dialog').close();});
$('refresh').addEventListener('click',refresh);$('retry').addEventListener('click',()=>loadData(true));
addEventListener('hashchange',applyHash);
addEventListener('online',()=>{connectionStatus();loadData();});addEventListener('offline',connectionStatus);
document.addEventListener('keydown',event=>{if(event.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!document.querySelector('dialog[open]')){event.preventDefault();location.hash='ricette';showPage('ricette');$('search').focus();}});
addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;$('install').hidden=false;});
$('install').addEventListener('click',async()=>{if(installPrompt){await installPrompt.prompt();installPrompt=null;$('install').hidden=true;}});
addEventListener('appinstalled',()=>{$('install').hidden=true;toast('Cibo sano è stato installato.');});
$('export-favorites').addEventListener('click',()=>{
  const blob=new Blob([JSON.stringify({format:'cibo-sano-favorites-v1',favorites:[...favorites]},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='cibo-sano-preferiti.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
$('import-favorites').addEventListener('change',async event=>{
  const file=event.target.files[0];if(!file)return;
  try {
    if(file.size>1000000||!data)throw new Error();
    const imported=parseFavorites(await file.text(),new Set(recipeMap.keys()));
    await withDiaryLock(()=>personalStore.update(current=>({...current,favorites:[...new Set([...(current.favorites||[]),...imported])]})));
    syncPersonalData();toast(`${imported.size} preferiti importati.`);
  } catch {toast('Non riesco a importare il file. Usa un’esportazione dei preferiti di Cibo sano.');}
  event.target.value='';
});
if('serviceWorker' in navigator)navigator.serviceWorker.addEventListener('controllerchange',()=>{
  if(initialController)location.reload();
  initialController=true;offlineReady=true;connectionStatus();
});
applyHash();connectionStatus();loadData();setupOffline();
if(storageWarning)setTimeout(()=>toast('I preferiti non sono disponibili in questa modalità del browser.'),1000);

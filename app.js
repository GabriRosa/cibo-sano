import {categories, categoryIcons, escapeHTML as e, filterRecipes, scaledAmount, validData, sourceURL, parseFavorites} from './lib.mjs';

const $ = id => document.getElementById(id);
const heart = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.4 4.6a5.5 5.5 0 0 0-7.8 0l-.6.6-.6-.6a5.5 5.5 0 0 0-7.8 7.8L12 21l8.4-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>';
const favoriteKey = 'cibo-sano:favorites:v1';
let data = null, recipeMap = new Map(), favorites = new Set(), storageWarning = false;
let state = {query:'',category:'Tutte',view:'all',sort:'default'}, visibleLimit = 24;
let currentRecipe = null, servings = 1, toastTimer, installPrompt = null, registration = null;
let offlineReady = false, dataFromCache = false, initialController = !!navigator.serviceWorker?.controller;
try { favorites = parseFavorites(localStorage.getItem(favoriteKey) || '[]'); } catch { storageWarning = true; }

function toast(message) {
  $('toast').textContent = message;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4000);
}
function connectionStatus() {
  $('connection').textContent = !navigator.onLine ? 'Offline' : dataFromCache ? 'Copia salvata' : offlineReady ? 'Pronto anche offline' : 'Online';
  $('offline-status').textContent = offlineReady ? 'Copia offline pronta su questo dispositivo.' : 'La copia offline sarà pronta dopo il primo caricamento online completo.';
}
function setFavorite(id) {
  favorites.has(id) ? favorites.delete(id) : favorites.add(id);
  try { localStorage.setItem(favoriteKey, JSON.stringify([...favorites])); }
  catch { toast('Memoria del browser non disponibile: i preferiti dureranno fino alla chiusura.'); }
  render();
  updateDetailFavorite();
}
function updateDetailFavorite() {
  if (!currentRecipe) return;
  const active = favorites.has(currentRecipe.id);
  $('recipe-favorite').innerHTML = heart;
  $('recipe-favorite').setAttribute('aria-pressed', String(active));
  $('recipe-favorite').setAttribute('aria-label', active ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti');
}
function typeLabel(recipe) {
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
  return `<article class="recipe-card"><div class="card-top"><span class="category-label"><span class="category-icon" aria-hidden="true">${categoryIcons[recipe.category]}</span>${e(recipe.category)}</span><button type="button" class="icon-button card-favorite" data-favorite="${e(recipe.id)}" aria-label="${active?'Rimuovi':'Aggiungi'} ${e(recipe.title)} ${active?'dai':'ai'} preferiti" aria-pressed="${active}">${heart}</button></div><h3><button type="button" class="recipe-open" data-recipe="${e(recipe.id)}">${e(recipe.title)}</button></h3><p class="ingredient-preview">${e(preview(recipe))}</p><div class="card-bottom"><span class="${recipe.kind==='porzione'?'portion-label':'recipe-type'}">${recipe.kind==='porzione'?'1 persona':e(typeLabel(recipe))}</span>${recipe.kcal!==null?`<span class="calorie-label">≈ ${recipe.kcal} kcal</span>`:'<span aria-hidden="true">↗</span>'}</div></article>`;
}
function render() {
  if (!data) return;
  const filtered = filterRecipes(data.recipes, {...state, favorites});
  $('recipes').innerHTML = filtered.slice(0, visibleLimit).map(card).join('');
  $('favorite-count').textContent = data.recipes.filter(r=>favorites.has(r.id)).length;
  $('result-count').textContent = `${filtered.length} ${filtered.length===1?'scheda':'schede'}`;
  $('results-title').textContent = state.query ? 'Risultati della ricerca' : state.view==='favorites' ? 'Le tue preferite' : state.view==='portions' ? 'Una porzione, già pensata' : state.category!=='Tutte' ? state.category : 'Trova la tua prossima idea';
  $('load-more').hidden = filtered.length <= visibleLimit;
  $('load-more').textContent = `Mostra altre ${Math.min(24, Math.max(0,filtered.length-visibleLimit))} ricette`;
  $('empty').hidden = filtered.length!==0;
  $('empty-title').textContent = state.view==='favorites' && !favorites.size ? 'Le tue preferite, tutte qui.' : 'Nessuna ricetta trovata';
  $('empty-copy').textContent = state.view==='favorites' && !favorites.size ? 'Tocca il cuore su una ricetta per ritrovarla in questa pagina.' : 'Prova un altro ingrediente o rimuovi un filtro.';
  document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed', String(b.dataset.view===state.view)));
  document.querySelectorAll('[data-category]').forEach(b=>b.setAttribute('aria-pressed', String(b.dataset.category===state.category)));
}
function ingredientRow(i, index) {
  let note = i.note || '';
  if (i.name==='Uovo intero' && servings!==1) note = `Circa ${new Intl.NumberFormat('it-IT').format(i.grams*servings/50)} uova medie, senza guscio`;
  return `<li><input class="check" type="checkbox" id="ingredient-${index}" aria-label="${e(i.name)} preparato"><label for="ingredient-${index}">${e(i.name)}${note?`<small>${e(note)}</small>`:''}</label><span class="amount">${scaledAmount(i.grams, servings)}</span></li>`;
}
function detail(recipe) {
  const isPortion = recipe.kind==='porzione';
  const ingredientSection = isPortion ? `<div class="portion-controls"><h3>Ingredienti</h3><div class="stepper" aria-label="Numero di porzioni"><button type="button" id="portion-minus" aria-label="Riduci porzioni" ${servings<=1?'disabled':''}>−</button><span aria-live="polite">${servings} ${servings===1?'persona':'persone'}</span><button type="button" id="portion-plus" aria-label="Aumenta porzioni" ${servings>=8?'disabled':''}>+</button></div></div><ul class="ingredient-list">${recipe.ingredients.map((i,index)=>!i.added?ingredientRow(i,index):'').join('')}</ul><h3 class="section-subtitle">Per completare il pasto · aggiunte proposte</h3><ul class="ingredient-list">${recipe.ingredients.map((i,index)=>i.added?ingredientRow(i,index):'').join('')}</ul>` : `<h3>Ingredienti della fonte</h3><p class="ingredient-paragraph">${e(recipe.ingredientText || 'La fonte descrive una tecnica; non specifica un elenco di ingredienti.').replace(/; /g,';<br>')}</p>`;
  const steps = recipe.steps.length ? `<h3>Procedimento</h3><ol class="steps">${recipe.steps.map(step=>`<li><p>${e(step)}</p></li>`).join('')}</ol>` : `<div class="detail-note"><p>${isPortion?'La fonte propone il piatto senza descrivere il procedimento. Qui trovi ingredienti e dosi proposte per comporre il pasto.':'Il procedimento non è riportato nella fonte disponibile.'}</p></div>`;
  const source = sourceURL(recipe.url), extra = sourceURL(recipe.extraSource);
  return `<div class="detail-body"><div class="detail-kicker">${e(recipe.category)}</div><h2 id="recipe-title">${e(recipe.title)}</h2><div class="detail-meta"><span>${e(typeLabel(recipe))}</span>${isPortion?`<span>≈ ${recipe.kcal} kcal a persona</span>`:''}${recipe.sourceType==='Video e testi dell’autore'?'<span>Recuperata dal video</span>':''}</div>${isPortion?'<div class="detail-note"><p>Quantità stimate, non indicate dall’autrice. Pesi a crudo e al netto degli scarti, salvo diversa indicazione. L’olio comprende tutto il condimento. Le calorie possono variare in base al prodotto.</p></div>':''}${ingredientSection}${steps}${recipe.notes?`<div class="detail-note warning"><p>${e(recipe.notes)}</p></div>`:''}<div class="source-box"><p class="source-description">${e(recipe.sourceType)} · @${e(recipe.author)}</p>${source?`<a href="${e(source)}" target="_blank" rel="noopener noreferrer">Apri la fonte Instagram ↗</a>`:''}${extra?`<a href="${e(extra)}" target="_blank" rel="noopener noreferrer">Approfondimento dell’autore ↗</a>`:''}</div></div>`;
}
function renderDetail() {
  if (!currentRecipe) return;
  $('recipe-detail').innerHTML = detail(currentRecipe);
  updateDetailFavorite();
}
function openRecipe(id) {
  const recipe = recipeMap.get(id);
  if (!recipe) { toast('Questa ricetta non è disponibile nel ricettario.'); return; }
  if (currentRecipe?.id!==id) servings = 1;
  currentRecipe = recipe;
  renderDetail();
  if (!$('recipe-dialog').open) $('recipe-dialog').showModal();
  $('recipe-dialog').scrollTop = 0;
}
function applyHash() {
  if (!data) return;
  const id = new URLSearchParams(location.hash.slice(1)).get('ricetta');
  if (id) openRecipe(id);
  else if ($('recipe-dialog').open) $('recipe-dialog').close();
}
function clearRecipeHash() {
  if (location.hash.startsWith('#ricetta=')) history.replaceState(null,'',location.pathname+location.search);
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
    data = incoming; recipeMap = new Map(data.recipes.map(r=>[r.id,r]));
    $('load-error').hidden = true;
    $('collection-count').textContent = `${data.recipes.length} schede da esplorare`;
    $('version-info').textContent = `Ricettario aggiornato al ${new Date(data.updatedAt+'T12:00:00').toLocaleDateString('it-IT')} · Versione ${data.version}`;
    render(); applyHash();
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
$('recipe-dialog').addEventListener('close',()=>{clearRecipeHash();currentRecipe=null;});
$('recipe-dialog').addEventListener('click', event=>{if(event.target===$('recipe-dialog')){$('recipe-dialog').close();}});
$('recipe-favorite').addEventListener('click',()=>{if(currentRecipe)setFavorite(currentRecipe.id);});
$('recipe-detail').addEventListener('click', event=>{
  const plus=event.target.closest('#portion-plus'),minus=event.target.closest('#portion-minus');
  if(plus||minus){servings=Math.max(1,Math.min(8,servings+(plus?1:-1)));renderDetail();$(plus?'portion-plus':'portion-minus')?.focus();}
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
document.addEventListener('keydown',event=>{if(event.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!document.querySelector('dialog[open]')){event.preventDefault();$('search').focus();}});
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
    for(const id of imported)favorites.add(id);
    localStorage.setItem(favoriteKey,JSON.stringify([...favorites]));render();toast(`${imported.size} preferiti importati.`);
  } catch {toast('Non riesco a importare il file. Usa un’esportazione dei preferiti di Cibo sano.');}
  event.target.value='';
});
if('serviceWorker' in navigator)navigator.serviceWorker.addEventListener('controllerchange',()=>{
  if(initialController)location.reload();
  initialController=true;offlineReady=true;connectionStatus();
});
connectionStatus();loadData();setupOffline();
if(storageWarning)setTimeout(()=>toast('I preferiti non sono disponibili in questa modalità del browser.'),1000);

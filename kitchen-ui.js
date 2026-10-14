import {escapeHTML as e,normalize} from './lib.mjs';
import {DiaryStore,DIARY_KEY,withDiaryLock,localDate,validDate,decimal,recipeItem} from './diary.mjs';
import {KITCHEN_MEALS,KITCHEN_UNITS,createPlan,updatePlan,plannedRecipeItem,createPantryItem,weekStart,weekDates,shiftKitchenDate,shoppingList,shoppingCheckKey,suggestRecipes,excludesTofu} from './kitchen.mjs';

const $=id=>document.getElementById(id);
const fmt=(value,digits=1)=>new Intl.NumberFormat('it-IT',{maximumFractionDigits:digits}).format(value);
const amount=(quantity,unit)=>`${fmt(quantity,2)} ${unit}`;
const dateLabel=(date,options={day:'numeric',month:'long'})=>new Date(date+'T12:00:00').toLocaleDateString('it-IT',options);
const macros=(nutrients,multiplier=1)=>`${fmt(nutrients.kcal*multiplier,0)} kcal · P ${fmt(nutrients.protein*multiplier)} g · C ${fmt(nutrients.carbs*multiplier)} g · G ${fmt(nutrients.fat*multiplier)} g`;
const stampAfter=previous=>new Date(Math.max(Date.now(),Date.parse(previous||'')+1||0)).toISOString();

export function initKitchen({toast=()=>{},onOpenRecipe,onLogRecipe}={}) {
  let storage;try{storage=window.localStorage;}catch{}
  const store=new DiaryStore(storage);
  let catalog=null,diary=null,selectedWeek=weekStart(localDate()),page='menu',chosenItem=null,editingPlan=null,editingPantry=null,preferredDate=null,busy=false;
  const dialog=document.createElement('dialog');dialog.id='kitchen-dialog';dialog.className='kitchen-dialog';dialog.setAttribute('aria-labelledby','kitchen-dialog-title');document.body.append(dialog);

  function error(message) {
    const target=$('kitchen-form-error');
    if(dialog.open&&target){target.textContent=message;target.hidden=false;}else toast(message);
  }
  function close() {dialog.close();chosenItem=null;editingPlan=null;editingPantry=null;}
  function shell(title,body) {
    dialog.innerHTML=`<div class="dialog-toolbar"><h2 id="kitchen-dialog-title">${e(title)}</h2><button type="button" class="text-button" data-kitchen-close>Chiudi ✕</button></div><div class="kitchen-dialog-body">${body}<p id="kitchen-form-error" class="form-error" role="alert" hidden></p></div>`;
    if(!dialog.open)dialog.showModal();dialog.scrollTop=0;
  }
  function read() {
    try{diary=store.read();return true;}catch(err){diary=null;for(const id of ['kitchen-content','pantry-content'])if($(id))$(id).innerHTML=`<div class="notice" role="alert"><p>${e(err.message)}</p><p>Puoi gestire il backup dalla sezione Diario.</p></div>`;return false;}
  }
  function mount() {
    const menu=$('kitchen-page'),pantry=$('pantry-page');
    if(menu&&!menu.dataset.kitchenMounted){
      menu.dataset.kitchenMounted='true';menu.classList.add('kitchen-page');
      menu.innerHTML=`<header class="kitchen-heading"><div><p class="eyebrow">ORGANIZZA I PASTI</p><h1>Il menu della settimana</h1><p>Scegli le ricette. La lista della spesa tiene conto di quello che hai già.</p></div><button type="button" class="primary-button" data-kitchen-add-plan>+ Pianifica una ricetta</button></header><div class="kitchen-weekbar"><div class="kitchen-week-nav"><button type="button" class="secondary-button" data-kitchen-week="-1" aria-label="Settimana precedente">←</button><div><p class="kitchen-week-caption">Settimana</p><strong id="kitchen-week-label" aria-live="polite"></strong></div><button type="button" class="secondary-button" data-kitchen-week="1" aria-label="Settimana successiva">→</button></div><div class="kitchen-week-controls"><label class="field"><span>Vai alla settimana di</span><input id="kitchen-week-date" type="date" min="1900-01-01" max="2200-12-31" aria-label="Scegli un giorno della settimana"></label><button type="button" class="text-button" data-kitchen-this-week>Questa settimana</button></div></div><div id="kitchen-content"></div>`;
      menu.addEventListener('click',handleClick);
      $('kitchen-week-date').addEventListener('change',event=>{if(validDate(event.target.value)){selectedWeek=weekStart(event.target.value);render('menu');}});
      menu.addEventListener('change',event=>{if(event.target.matches('[data-shopping-check]'))saveShoppingCheck(event.target);});
    }
    if(pantry&&!pantry.dataset.kitchenMounted){
      pantry.dataset.kitchenMounted='true';pantry.classList.add('kitchen-page');
      pantry.innerHTML=`<header class="kitchen-heading"><div><p class="eyebrow">PARTI DA QUELLO CHE HAI</p><h1>La tua dispensa</h1><p>Annota gli ingredienti e trova ricette per usarli.</p></div><button type="button" class="primary-button" data-kitchen-add-pantry>+ Aggiungi ingrediente</button></header><div id="pantry-content"></div>`;
      pantry.addEventListener('click',handleClick);
      pantry.addEventListener('input',event=>{if(event.target.id==='pantry-search')renderInventory(event.target.value);});
    }
  }
  function render(nextPage=page) {
    page=String(nextPage).replace(/^#/,'')==='dispensa'||nextPage==='pantry'?'dispensa':'menu';
    mount();if(!read())return;
    if($('kitchen-content'))renderMenu();
    if($('pantry-content'))renderPantry();
  }
  function renderMenu() {
    const days=weekDates(selectedWeek),weekPlans=(diary.plans||[]).filter(plan=>plan.date>=days[0]&&plan.date<=days[6]);
    $('kitchen-week-label').textContent=`${dateLabel(days[0])} – ${dateLabel(days[6],{day:'numeric',month:'long',year:'numeric'})}`;
    $('kitchen-week-date').value=selectedWeek;
    const estimated=weekPlans.reduce((total,plan)=>total+plan.nutrients.kcal*plan.servings,0);
    const weeklySummary=weekPlans.length?`${weekPlans.length} ${weekPlans.length===1?'ricetta pianificata':'ricette pianificate'} · ${fmt(estimated,0)} kcal previste in totale`:'La settimana è libera. Aggiungi la prima ricetta.';
    $('kitchen-content').innerHTML=`<p class="kitchen-plan-note"><strong>${e(weeklySummary)}</strong><span>I pasti pianificati entrano nel diario solo quando li registri.</span></p><div class="kitchen-layout"><section class="kitchen-calendar" aria-label="Pasti della settimana">${days.map(day=>{
      const plans=weekPlans.filter(plan=>plan.date===day).sort((a,b)=>Object.keys(KITCHEN_MEALS).indexOf(a.meal)-Object.keys(KITCHEN_MEALS).indexOf(b.meal)||a.createdAt.localeCompare(b.createdAt));
      return `<section class="kitchen-day ${day===localDate()?'is-today':''}"><div class="kitchen-day-heading"><h2>${e(dateLabel(day,{weekday:'long'}))}<span>${e(dateLabel(day))}${day===localDate()?' · oggi':''}</span></h2><button type="button" class="text-button" data-kitchen-plan-day="${day}" aria-label="Pianifica per ${e(dateLabel(day,{weekday:'long',day:'numeric',month:'long'}))}">+ Aggiungi</button></div>${plans.length?`<ul class="kitchen-plan-list">${plans.map(plan=>`<li class="kitchen-plan"><div class="kitchen-plan-copy"><p class="kitchen-meal-label">${KITCHEN_MEALS[plan.meal]}</p><h3>${onOpenRecipe&&plan.recipeId&&(catalog?.recipes||[]).some(recipe=>recipe.id===plan.recipeId)?`<button type="button" data-kitchen-open-recipe="${e(plan.recipeId)}">${e(plan.name)}</button>`:e(plan.name)}</h3><p>${fmt(plan.servings,2)} ${plan.servings===1?'porzione':'porzioni'} · ${fmt(plan.nutrients.kcal*plan.servings,0)} kcal previste</p></div><div class="kitchen-plan-actions"><button type="button" class="text-button" data-kitchen-edit-plan="${e(plan.id)}" aria-label="Modifica ${e(plan.name)}">Modifica</button>${onLogRecipe?`<button type="button" class="secondary-button" data-kitchen-log-plan="${e(plan.id)}" aria-label="Registra nel diario ${e(plan.name)}">Registra nel diario</button>`:''}</div></li>`).join('')}</ul>`:'<p class="kitchen-empty-day">Nessuna ricetta pianificata.</p>'}</section>`;
    }).join('')}</section>${shoppingHTML(weekPlans)}</div>`;
  }
  function shoppingHTML(weekPlans) {
    const rows=shoppingList(weekPlans,diary.pantry||[],selectedWeek),buy=rows.filter(row=>row.toBuy>0),covered=rows.filter(row=>row.toBuy===0),checks=new Map((diary.shoppingChecks||[]).filter(check=>check.week===selectedWeek).map(check=>[shoppingCheckKey(check),check]));
    const checked=row=>{const check=checks.get(shoppingCheckKey({week:selectedWeek,name:row.name,unit:row.unit}));return !!check?.checked&&(!Object.hasOwn(check,'quantity')||check.quantity===row.toBuy);};
    const checkedCount=buy.filter(checked).length;
    return `<section class="kitchen-shopping" aria-labelledby="kitchen-shopping-title"><div class="kitchen-section-top"><div><p class="eyebrow">PER QUESTA SETTIMANA</p><h2 id="kitchen-shopping-title">Lista della spesa</h2></div><span class="kitchen-count">${buy.length}</span></div><p class="kitchen-help">Le dosi già in dispensa sono sottratte solo a parità di nome e unità. <a href="#dispensa">Aggiorna dispensa</a></p>${rows.length?`${buy.length?`<p class="kitchen-shopping-progress">${checkedCount} di ${buy.length} spuntati</p><ul class="kitchen-shopping-list">${buy.map(row=>`<li class="${checked(row)?'is-checked':''}"><label><input type="checkbox" data-shopping-check data-shopping-name="${e(row.name)}" data-shopping-unit="${e(row.unit)}" data-shopping-quantity="${row.toBuy}" ${checked(row)?'checked':''}><span><b>${e(row.name)}</b><strong>${amount(row.toBuy,row.unit)}</strong><small>${row.used>0?`${amount(row.used,row.unit)} già disponibili. `:''}${row.unquantified?'Quantità in dispensa da pesare. ':''}${row.otherUnits.length?`In dispensa anche in ${e(row.otherUnits.join(', '))}: nessuna conversione.`:''}</small></span></label></li>`).join('')}</ul><p class="kitchen-help kitchen-small">La spunta si azzera se cambia la quantità da comprare.</p>`:'<p class="kitchen-available-message">Hai già tutte le quantità necessarie in dispensa.</p>'}${covered.length?`<details class="kitchen-covered"><summary>Già disponibili · ${covered.length}</summary><ul>${covered.map(row=>`<li><span>${e(row.name)}</span><b>${amount(row.required,row.unit)}</b></li>`).join('')}</ul></details>`:''}`:'<div class="kitchen-shopping-empty"><span aria-hidden="true">⌑</span><p>La lista si compila quando pianifichi una ricetta.</p></div>'}<p class="kitchen-help kitchen-small">Spuntare la spesa non modifica la dispensa. Aggiorna le quantità quando riponi o usi gli ingredienti.</p></section>`;
  }
  function renderPantry() {
    const query=$('pantry-search')?.value||'',pantry=diary.pantry||[];
    $('pantry-content').innerHTML=`<div class="pantry-layout"><section class="pantry-inventory" aria-labelledby="pantry-list-title"><div class="kitchen-section-top"><h2 id="pantry-list-title">Ingredienti disponibili</h2><span class="kitchen-count">${pantry.length}</span></div><p class="kitchen-help">Usa i nomi suggeriti per abbinare gli ingredienti alle ricette. Grammi, millilitri e pezzi restano separati.</p>${pantry.length?`<label class="field pantry-search-field"><span>Cerca in dispensa</span><input id="pantry-search" type="search" placeholder="Es. zucca, ceci, pasta" value="${e(query)}"></label>`:''}<div id="pantry-inventory-list"></div></section><section class="pantry-suggestions" aria-labelledby="pantry-suggestions-title"><div class="kitchen-section-top"><div><p class="eyebrow">IDEE DAL RICETTARIO</p><h2 id="pantry-suggestions-title">Cosa puoi preparare</h2></div></div><p class="kitchen-help">Confronto per una porzione, dando precedenza alle dosi sufficienti. Ogni ricetta considera la dispensa attuale.</p><div id="pantry-suggestions-list"></div></section></div>`;
    renderInventory(query);renderSuggestions();
  }
  function renderInventory(query='') {
    const inventory=diary.pantry||[],rows=inventory.filter(item=>normalize(item.name).includes(normalize(query).trim())).sort((a,b)=>a.name.localeCompare(b.name,'it'));
    $('pantry-inventory-list').innerHTML=rows.length?`<ul class="pantry-stock-list">${rows.map(item=>`<li><div><h3>${e(item.name)}</h3><p>${item.quantity===null?`Da pesare · ${e(item.unit)}`:amount(item.quantity,item.unit)}${item.quantity===0?' · terminato':''}</p></div><button type="button" class="text-button" data-kitchen-edit-pantry="${e(item.id)}" aria-label="Modifica ${e(item.name)} in dispensa">Modifica</button></li>`).join('')}</ul>`:`<div class="kitchen-empty-panel"><p>${inventory.length?'Nessun ingrediente corrisponde alla ricerca.':'La dispensa è vuota. Aggiungi quello che hai in casa per ricevere idee e ridurre la spesa.'}</p>${inventory.length?'':'<button type="button" class="secondary-button" data-kitchen-add-pantry>+ Primo ingrediente</button>'}</div>`;
  }
  function renderSuggestions() {
    const suggestions=suggestRecipes(catalog?.recipes||[],diary.pantry||[],6);
    $('pantry-suggestions-list').innerHTML=suggestions.length?`<div class="kitchen-suggestion-grid">${suggestions.map(result=>{
      const recipe=result.recipe,copy=[result.partialCount?`${result.partialCount} ${result.partialCount===1?'dose parziale':'dosi parziali'}`:'',result.unquantifiedCount?`${result.unquantifiedCount} da pesare o convertire manualmente`:'',result.missingCount?`${result.missingCount} ${result.missingCount===1?'ingrediente mancante':'ingredienti mancanti'}`:''].filter(Boolean).join(' · ');
      return `<article class="kitchen-suggestion"><span class="kitchen-match ${result.complete?'is-complete':''}">${result.complete?'Tutte le dosi disponibili':`${result.sufficientCount} di ${result.ingredientCount} dosi sufficienti`}</span><h3>${onOpenRecipe?`<button type="button" data-kitchen-open-recipe="${e(recipe.id)}">${e(recipe.title)}</button>`:e(recipe.title)}</h3>${copy?`<p>${e(copy)}.</p>`:'<p>Puoi preparare una porzione con la dispensa attuale.</p>'}<details><summary>Confronta gli ingredienti</summary><ul>${result.matches.map(row=>`<li><b>${e(row.name)}</b><span>${row.status==='sufficient'?`${amount(row.required,row.unit)} disponibili`:row.status==='partial'?`${amount(row.available,row.unit)} di ${amount(row.required,row.unit)}`:row.status==='unquantified'?`Servono ${amount(row.required,row.unit)} · quantità da verificare`:`Mancano ${amount(row.required,row.unit)}`}</span></li>`).join('')}</ul></details><button type="button" class="secondary-button" data-kitchen-plan-recipe="${e(recipe.id)}">Pianifica</button></article>`;
    }).join('')}</div>`:`<div class="kitchen-empty-panel"><p>${catalog?(diary.pantry||[]).some(item=>item.quantity===null||item.quantity>0)?'Nessuna corrispondenza esatta. Scegli un nome dal ricettario quando aggiungi un ingrediente.':'Aggiungi gli ingredienti disponibili per vedere le ricette suggerite.':'Il ricettario è in caricamento.'}</p></div>`;
  }
  function selectRecipe(date=null) {
    if(!read())return;preferredDate=date;chosenItem=null;editingPlan=null;
    shell('Scegli una ricetta',`<label class="field"><span>Cerca nel ricettario</span><input id="kitchen-recipe-search" type="search" autocomplete="off" placeholder="Nome o ingrediente"></label><p class="kitchen-help">Pianifica le porzioni che vuoi preparare, anche in anticipo.</p><div id="kitchen-recipe-results" class="kitchen-picker"></div>`);
    const search=()=>{
      const query=normalize($('kitchen-recipe-search').value).trim(),recipes=(catalog?.recipes||[]).filter(recipe=>excludesTofu(recipe)&&normalize([recipe.title,...recipe.ingredients.map(item=>item.name)].join(' ')).includes(query));
      $('kitchen-recipe-results').innerHTML=recipes.slice(0,35).map(recipe=>`<button type="button" data-kitchen-pick-recipe="${e(recipe.id)}"><span><b>${e(recipe.title)}</b><small>${recipe.personal?'La tua variante':e(recipe.category)} · per una porzione</small></span><span aria-hidden="true">+</span></button>`).join('')+(recipes.length>35?'<p class="kitchen-help">Scrivi per restringere i risultati.</p>':'')+(recipes.length?'':`<p class="kitchen-help">${catalog?'Nessuna ricetta trovata.':'Ricettario in caricamento. Riprova tra poco.'}</p>`);
    };
    $('kitchen-recipe-search').addEventListener('input',search);search();
  }
  function planRecipe(value,options={}) {
    if(!read())return;
    try {
      chosenItem=value?.type==='recipe'?value:recipeItem(value,catalog?.foods||{});
      editingPlan=null;preferredDate=options.date||null;planEditor();
    }catch(err){error(err.message);}
  }
  function defaultPlanDate() {const today=localDate();return today>=selectedWeek&&today<=shiftKitchenDate(selectedWeek,6)?today:selectedWeek;}
  function planEditor(plan=null) {
    if(plan){editingPlan=plan;chosenItem=plannedRecipeItem(plan);}editingPantry=null;
    const date=plan?.date||preferredDate||defaultPlanDate(),meal=plan?.meal||'lunch',servings=plan?.servings||1,item=chosenItem;
    shell(plan?'Modifica il pasto':'Pianifica la ricetta',`<form id="kitchen-plan-form"><p class="kitchen-selected-name">${e(item.name)}</p><p class="kitchen-help">${macros(item.nutrients)} per porzione.</p><div class="form-grid"><label class="field"><span>Giorno</span><input id="kitchen-plan-date" type="date" value="${e(date)}" min="1900-01-01" max="2200-12-31" required></label><label class="field"><span>Pasto</span><select id="kitchen-plan-meal">${Object.entries(KITCHEN_MEALS).map(([key,label])=>`<option value="${key}" ${key===meal?'selected':''}>${label}</option>`).join('')}</select></label></div><label class="field"><span>Porzioni da preparare</span><input id="kitchen-plan-servings" inputmode="decimal" value="${servings}" required autocomplete="off" aria-describedby="kitchen-plan-help"></label><p id="kitchen-plan-help" class="kitchen-help">Puoi usare frazioni, ad esempio 0,5. Le dosi e i valori della ricetta restano conservati nel piano.</p><p id="kitchen-plan-preview" class="kitchen-plan-preview" aria-live="polite"></p><details class="kitchen-plan-ingredients"><summary>Ingredienti del pasto</summary><ul id="kitchen-plan-amounts"></ul></details><div class="kitchen-form-actions"><button type="submit" class="primary-button">${plan?'Salva modifiche':'Aggiungi al menu'}</button>${plan?'<button type="button" class="text-button danger-button" data-kitchen-remove-plan>Rimuovi dal menu</button>':'<button type="button" class="text-button" data-kitchen-choose-again>Scegli un’altra ricetta</button>'}</div><p class="kitchen-help kitchen-small">Il piano e la lista della spesa vengono salvati in questo browser. Il diario resta separato.</p></form>`);
    const preview=()=>{
      const count=decimal($('kitchen-plan-servings').value,100),valid=count!==null&&count>0;
      $('kitchen-plan-preview').textContent=valid?`${macros(item.nutrients,count)} previste`:'Inserisci un numero di porzioni maggiore di zero, fino a 100.';
      $('kitchen-plan-amounts').innerHTML=valid?(plan?.ingredients||item.ingredients.map(ingredient=>({name:ingredient.name,quantity:ingredient.grams,unit:'g'}))).map(ingredient=>`<li><span>${e(ingredient.name)}</span><b>${amount(ingredient.quantity*count,ingredient.unit)}</b></li>`).join(''):'';
    };
    $('kitchen-plan-servings').addEventListener('input',preview);preview();
  }
  function pantryEditor(item=null) {
    if(!read())return;editingPantry=item;editingPlan=null;chosenItem=null;
    const names=[...new Set([...(catalog?.recipes||[]).flatMap(recipe=>recipe.ingredients.map(ingredient=>ingredient.name)),...Object.keys(catalog?.foods||{})])].sort((a,b)=>a.localeCompare(b,'it'));
    shell(item?'Modifica ingrediente':'Aggiungi in dispensa',`<form id="kitchen-pantry-form"><label class="field"><span>Ingrediente</span><input id="kitchen-pantry-name" list="kitchen-ingredient-names" value="${e(item?.name||'')}" maxlength="200" required autocomplete="off" placeholder="Scegli un nome o scrivine uno"><datalist id="kitchen-ingredient-names">${names.map(name=>`<option value="${e(name)}"></option>`).join('')}</datalist></label><p class="kitchen-help">I suggerimenti usano il nome esatto dell’ingrediente, ad esempio ceci cotti e ceci secchi sono distinti.</p><div class="form-grid"><label class="field"><span>Quantità disponibile</span><input id="kitchen-pantry-quantity" inputmode="decimal" value="${item?.quantity??''}" ${item?.quantity===null?'disabled':''} autocomplete="off" aria-describedby="kitchen-pantry-help"></label><label class="field"><span>Unità</span><select id="kitchen-pantry-unit">${KITCHEN_UNITS.map(unit=>`<option value="${unit}" ${unit===(item?.unit||'g')?'selected':''}>${{g:'g · grammi',ml:'ml · millilitri',pz:'pz · pezzi'}[unit]}</option>`).join('')}</select></label></div><label class="kitchen-checkbox"><input id="kitchen-pantry-unknown" type="checkbox" ${item?.quantity===null?'checked':''}><span>Da pesare: non conosco la quantità</span></label><p id="kitchen-pantry-help" class="kitchen-help">Usa 0 per un ingrediente terminato. I pezzi e le quantità da pesare non vengono convertiti automaticamente in grammi o millilitri.</p><div class="kitchen-form-actions"><button type="submit" class="primary-button">${item?'Salva quantità':'Aggiungi ingrediente'}</button>${item?'<button type="button" class="text-button danger-button" data-kitchen-remove-pantry>Rimuovi dalla dispensa</button>':''}</div></form>`);
    $('kitchen-pantry-unknown').addEventListener('change',event=>{$('kitchen-pantry-quantity').disabled=event.target.checked;if(!event.target.checked)$('kitchen-pantry-quantity').focus();});
  }
  async function save(change,message) {
    if(busy)return;busy=true;
    dialog.querySelectorAll('button').forEach(button=>button.disabled=true);
    try {await withDiaryLock(()=>store.update(change));close();render();toast(message);}
    catch(err){error(err.message);}
    finally{busy=false;dialog.querySelectorAll('button').forEach(button=>button.disabled=false);}
  }
  function assertCurrent(records,item,label) {
    const current=records.find(record=>record.id===item.id);
    if(!current)throw new Error(`${label} è già stato rimosso in un’altra finestra.`);
    if(current.updatedAt!==item.updatedAt)throw new Error(`${label} è cambiato in un’altra finestra. Chiudi e riaprilo prima di salvare.`);
  }
  async function saveShoppingCheck(input) {
    const week=selectedWeek,name=input.dataset.shoppingName,unit=input.dataset.shoppingUnit,quantity=Number(input.dataset.shoppingQuantity),checked=input.checked;
    const restoreFocus=document.activeElement===input,scrollTop=input.closest('.kitchen-shopping-list')?.scrollTop||0;
    input.disabled=true;
    try {
      await withDiaryLock(()=>store.update(data=>{
        const checks=data.shoppingChecks||[],key=shoppingCheckKey({week,name,unit}),previous=checks.find(check=>shoppingCheckKey(check)===key);
        const next={week,name,unit,quantity,checked,updatedAt:stampAfter(previous?.updatedAt)};
        return {...data,shoppingChecks:previous?checks.map(check=>shoppingCheckKey(check)===key?next:check):[...checks,next]};
      }));render();
      const replacement=[...document.querySelectorAll('[data-shopping-check]')].find(element=>element.dataset.shoppingName===name&&element.dataset.shoppingUnit===unit);
      if(replacement){replacement.closest('.kitchen-shopping-list').scrollTop=scrollTop;if(restoreFocus)replacement.focus({preventScroll:true});}
    }catch(err){input.checked=!checked;input.disabled=false;toast(err.message);}
  }
  function handleClick(event) {
    const button=event.target.closest('button');if(!button||button.disabled)return;
    if(button.hasAttribute('data-kitchen-add-plan'))return selectRecipe();
    if(button.hasAttribute('data-kitchen-plan-day'))return selectRecipe(button.dataset.kitchenPlanDay);
    if(button.hasAttribute('data-kitchen-add-pantry'))return pantryEditor();
    if(button.hasAttribute('data-kitchen-this-week')){selectedWeek=weekStart(localDate());render('menu');return;}
    if(button.hasAttribute('data-kitchen-week')){const next=shiftKitchenDate(selectedWeek,Number(button.dataset.kitchenWeek)*7);if(validDate(next)&&validDate(shiftKitchenDate(next,6))){selectedWeek=next;render('menu');}return;}
    if(button.hasAttribute('data-kitchen-open-recipe')){onOpenRecipe?.(button.dataset.kitchenOpenRecipe);return;}
    if(button.hasAttribute('data-kitchen-plan-recipe')){preferredDate=null;const recipe=catalog?.recipes.find(item=>item.id===button.dataset.kitchenPlanRecipe);if(recipe)planRecipe(recipe);return;}
    if(button.hasAttribute('data-kitchen-edit-plan')){if(read()){const plan=(diary.plans||[]).find(item=>item.id===button.dataset.kitchenEditPlan);if(plan)planEditor(plan);}return;}
    if(button.hasAttribute('data-kitchen-log-plan')){if(read()){const plan=(diary.plans||[]).find(item=>item.id===button.dataset.kitchenLogPlan);if(plan)onLogRecipe?.(plannedRecipeItem(plan),{date:plan.date,meal:plan.meal,quantity:plan.servings});}return;}
    if(button.hasAttribute('data-kitchen-edit-pantry')){if(read()){const item=(diary.pantry||[]).find(item=>item.id===button.dataset.kitchenEditPantry);if(item)pantryEditor(item);}}
  }
  dialog.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button||button.disabled)return;
    if(button.hasAttribute('data-kitchen-close')){close();return;}
    if(button.hasAttribute('data-kitchen-pick-recipe')){const recipe=catalog?.recipes.find(item=>item.id===button.dataset.kitchenPickRecipe);if(recipe)planRecipe(recipe,{date:preferredDate});return;}
    if(button.hasAttribute('data-kitchen-choose-again')){selectRecipe(preferredDate);return;}
    if(button.hasAttribute('data-kitchen-remove-plan')&&editingPlan){const original=editingPlan;save(data=>{assertCurrent(data.plans||[],original,'Il pasto');return {...data,plans:(data.plans||[]).filter(item=>item.id!==original.id)};},'Pasto rimosso dal menu.');return;}
    if(button.hasAttribute('data-kitchen-remove-pantry')&&editingPantry){const original=editingPantry;save(data=>{assertCurrent(data.pantry||[],original,'L’ingrediente');return {...data,pantry:(data.pantry||[]).filter(item=>item.id!==original.id)};},'Ingrediente rimosso dalla dispensa.');}
  });
  dialog.addEventListener('submit',event=>{
    event.preventDefault();if(busy)return;
    try {
      if(event.target.id==='kitchen-plan-form') {
        const options={date:$('kitchen-plan-date').value,meal:$('kitchen-plan-meal').value,servings:decimal($('kitchen-plan-servings').value,100)},original=editingPlan;
        const plan=original?updatePlan(original,options):createPlan(chosenItem,options);
        save(data=>{if(original)assertCurrent(data.plans||[],original,'Il pasto');return {...data,plans:original?(data.plans||[]).map(item=>item.id===original.id?plan:item):[...(data.plans||[]),plan]};},original?'Pasto aggiornato.':'Ricetta aggiunta al menu.');
      } else if(event.target.id==='kitchen-pantry-form') {
        const original=editingPantry,unknown=$('kitchen-pantry-unknown').checked,quantity=unknown?null:decimal($('kitchen-pantry-quantity').value,1000000);
        if(!unknown&&quantity===null)throw new Error('Inserisci una quantità da 0 a 1.000.000, oppure seleziona “Da pesare”.');
        const created=createPantryItem({name:$('kitchen-pantry-name').value,quantity,unit:$('kitchen-pantry-unit').value}),item=original?{...created,id:original.id,updatedAt:stampAfter(original.updatedAt)}:created;
        save(data=>{if(original)assertCurrent(data.pantry||[],original,'L’ingrediente');return {...data,pantry:original?(data.pantry||[]).map(record=>record.id===original.id?item:record):[...(data.pantry||[]),item]};},original?'Dispensa aggiornata.':'Ingrediente aggiunto alla dispensa.');
      }
    }catch(err){error(err.message);}
  });
  window.addEventListener('storage',event=>{if(event.key===DIARY_KEY||event.key===null)render();});
  window.addEventListener('cibo-sano:diary-change',()=>render());
  mount();
  return {setData(data){catalog=data;render();},render,planRecipe};
}

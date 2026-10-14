import {escapeHTML as e, nutrientKeys, nutritionFor, parseGrams} from './lib.mjs';
import {DiaryStore, withDiaryLock} from './diary.mjs';
import {makePersonalRecipe, recipeFoodSnapshot} from './personal-recipes.mjs';

export function initRecipeVersions({toast,onSaved,storage=globalThis.localStorage}) {
  const store=new DiaryStore(storage),dialog=document.createElement('dialog');
  dialog.id='recipe-version-dialog';dialog.setAttribute('aria-labelledby','version-heading');document.body.append(dialog);
  let source,rows=[],choices=[];
  const $=id=>document.getElementById(id);
  const fmt=n=>new Intl.NumberFormat('it-IT',{maximumFractionDigits:1}).format(n);
  function preview() {
    const total=nutritionFor({ingredients:rows},{});
    $('version-total').textContent=total?`Per una porzione: ${Math.round(total.kcal)} kcal · P ${fmt(total.protein)} g · C ${fmt(total.carbs)} g · G ${fmt(total.fat)} g`:'Completa tutti i pesi per calcolare kcal e macro.';
  }
  function renderRows() {
    $('version-ingredients').innerHTML=rows.map((row,index)=>`<div class="version-ingredient"><label class="field"><span>Ingrediente ${index+1}</span><select data-version-food="${index}">${choices.map((choice,c)=>`<option value="${c}" ${c===row.choice?'selected':''}>${e(choice.label)}</option>`).join('')}</select></label><label class="field"><span>Grammi per porzione</span><input data-version-grams="${index}" inputmode="decimal" value="${row.grams??''}" required></label><button type="button" class="text-button" data-version-remove="${index}" aria-label="Rimuovi ingrediente ${index+1}">Rimuovi</button></div>`).join('');preview();
  }
  function open(recipe,foods,quantities,servings) {
    source=recipe;
    const saved=store.read();
    choices=Object.entries(foods).map(([name,food])=>({name,label:name,food:recipeFoodSnapshot({name},foods)}));
    for(const food of saved.foods.filter(f=>f.unit==='g'))choices.push({name:food.name,label:food.name+' · prodotto personale',food:{...food.nutrients,source:food.source.label,url:food.source.url,reference:'Prodotto personale'}});
    rows=recipe.ingredients.map((ingredient,index)=>{
      const food=recipeFoodSnapshot(ingredient,foods);
      const choice=choices.length;choices.push({name:ingredient.name,label:ingredient.name+' · valori della ricetta',food});
      return {name:ingredient.name,grams:quantities[index]/servings,food,choice};
    });
    dialog.innerHTML=`<div class="dialog-toolbar"><h2 id="version-heading">Salva una nuova versione</h2><button type="button" class="text-button" data-version-close>Chiudi ✕</button></div><form id="version-form" class="diary-dialog-body"><p>Le dosi qui sotto sono per <strong>una porzione</strong>. La ricetta di partenza resta disponibile. Puoi sostituire ingredienti, cambiare pesi e adattare i passaggi.</p><label class="field"><span>Nome della tua versione</span><input id="version-title" maxlength="200" required value="${e((recipe.title+' · mia versione').slice(0,200))}"></label><div id="version-ingredients"></div><button type="button" id="version-add" class="secondary-button">+ Ingrediente</button><p class="small-note">Per sostituire un ingrediente usa gli alimenti del ricettario o i tuoi prodotti salvati in grammi. I prodotti in ml richiedono una conversione di densità e non sono inclusi qui.</p><p id="version-total" class="entry-preview" aria-live="polite"></p><label class="field"><span>Procedimento (un passaggio per riga)</span><textarea id="version-steps" rows="7" maxlength="30000">${e(recipe.steps.join('\n'))}</textarea></label><label class="field"><span>Le tue note</span><textarea id="version-notes" rows="3" maxlength="10000" placeholder="Tempi, sostituzioni, consigli…">${e(recipe.personal?recipe.notes:'')}</textarea></label><p id="version-error" class="form-error" role="alert" hidden></p><button type="submit" class="primary-button">Salva nel mio ricettario</button><p class="small-note">La versione resta su questo dispositivo ed è inclusa nel backup completo.</p></form>`;
    renderRows();dialog.showModal();
    $('version-form').addEventListener('submit',async event=>{
      event.preventDefault();const button=event.submitter;if(button.disabled)return;button.disabled=true;
      try {
        if(rows.some(row=>row.grams===null))throw new Error('Inserisci un peso valido per ogni ingrediente.');
        const version=makePersonalRecipe(source,{title:$('version-title').value,notes:$('version-notes').value,steps:$('version-steps').value.split('\n'),ingredients:rows});
        await withDiaryLock(()=>store.update(data=>({...data,personalRecipes:[...(data.personalRecipes||[]),version]})));
        dialog.close();toast('Nuova versione salvata nel tuo ricettario.');onSaved(version);
      }catch(error){$('version-error').textContent=error.message;$('version-error').hidden=false;}finally{button.disabled=false;}
    });
  }
  dialog.addEventListener('click',event=>{
    if(event.target===dialog||event.target.closest('[data-version-close]'))dialog.close();
    const remove=event.target.closest('[data-version-remove]');if(remove){rows.splice(Number(remove.dataset.versionRemove),1);renderRows();}
    if(event.target.closest('#version-add')){const c=choices[0];rows.push({name:c.name,food:{...c.food},grams:100,choice:0});renderRows();}
  });
  dialog.addEventListener('change',event=>{
    const field=event.target.closest('[data-version-food]');if(field){const index=Number(field.dataset.versionFood),choice=Number(field.value),food=choices[choice];rows[index]={...rows[index],name:food.name,food:{...food.food},choice};preview();}
  });
  dialog.addEventListener('input',event=>{
    const field=event.target.closest('[data-version-grams]');if(field){rows[Number(field.dataset.versionGrams)].grams=parseGrams(field.value);preview();}
  });
  return {open};
}

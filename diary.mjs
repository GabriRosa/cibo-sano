import {validInsightFields,mergeInsightFields} from './targets.mjs';
import {validKitchenFields,mergeKitchenFields} from './kitchen.mjs';
import {validPersonalFields,mergePersonalFields,validFavorites,FAVORITES_KEY} from './personal-recipes.mjs';
import {validPortions} from './portions.mjs';
import {validWaterEntry,validWaterFields,mergeWaterFields} from './water.mjs';

export const MEALS = {breakfast:'Colazione', snack:'Spuntino', lunch:'Pranzo', dinner:'Cena'};
export const NUTRIENTS = ['kcal','protein','carbs','fat'];
export const DIARY_KEY = 'cibo-sano:diary:v1';
export const BACKUP_FORMAT = 'cibo-sano-diary-v1';
export const FULL_BACKUP_FORMAT = 'cibo-sano-full-v1';
export async function withDiaryLock(operation, locks=globalThis.navigator?.locks) {
  return locks ? locks.request(DIARY_KEY,{mode:'exclusive'},operation) : operation();
}
const MAX_ENTRIES = 30000;
const text = (v, max=200) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const number = (v, max=10000) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max;
export function decimal(value, max=10000) {
  const s=String(value).trim().replace(',','.');
  return /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(s) && number(Number(s),max) ? Number(s) : null;
}
export function localDate(date=new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function validDate(s) {
  if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
  const d=new Date(`${s}T12:00:00`);
  return !Number.isNaN(d.valueOf()) && localDate(d)===s && s>='1900-01-01' && s<='2200-12-31';
}
export function shiftDate(s, days) {
  if(!validDate(s))throw new Error('Data non valida.');
  const d=new Date(`${s}T12:00:00`);d.setDate(d.getDate()+days);return localDate(d);
}
export function validNutrients(v, max=100000) {
  return !!v && NUTRIENTS.every(k=>number(v[k],max));
}
export function safeLink(value) {
  try {const u=new URL(value);return u.protocol==='https:' && !u.username && !u.password ? u.href : '';}
  catch{return '';}
}
function validSource(s) {return !!s && typeof s.label==='string' && s.label.length<=300 && typeof s.url==='string' && s.url.length<=2000 && (!s.url||!!safeLink(s.url));}
export function validFood(f) {
  return !!f && text(f.id) && text(f.name) && ['g','ml'].includes(f.unit) && validNutrients(f.nutrients,1000) && ['catalog','custom','off'].includes(f.origin) && validSource(f.source) && (!f.barcode||/^\d{8,14}$/.test(f.barcode)) && (!Object.hasOwn(f,'portions')||validPortions(f.portions)) && (!Object.hasOwn(f,'updatedAt')||(typeof f.updatedAt==='string'&&Number.isFinite(Date.parse(f.updatedAt))));
}
export function validEntry(v) {
  return !!v && text(v.id) && validDate(v.date) && Object.hasOwn(MEALS,v.meal) && text(v.name) && ['food','recipe'].includes(v.type) && ['g','ml','porzione'].includes(v.unit) && number(v.quantity) && v.quantity>0 && validNutrients(v.nutrients) && v.basis===(v.type==='recipe'?1:100) && (v.type==='recipe'?v.unit==='porzione':['g','ml'].includes(v.unit)) && validSource(v.source) && typeof v.createdAt==='string' && typeof v.updatedAt==='string' && Number.isFinite(Date.parse(v.createdAt)) && Number.isFinite(Date.parse(v.updatedAt)) && (!v.ingredients || (Array.isArray(v.ingredients)&&v.ingredients.length<=200&&v.ingredients.every(i=>text(i.name)&&number(i.grams))));
}
export function validWeight(record) {
  return !!record && validDate(record.date) && number(record.kg,500) && record.kg>=1 && typeof record.updatedAt==='string' && Number.isFinite(Date.parse(record.updatedAt));
}
function validWeights(records) {
  return Array.isArray(records) && records.length<=30000 && records.every(validWeight) && new Set(records.map(record=>record.date)).size===records.length;
}
export function emptyDiary() {return {schemaVersion:1,entries:[],foods:[],goal:null,weights:[]};}
export function validDiary(data) {
  return !!data && data.schemaVersion===1 && validInsightFields(data) && validKitchenFields(data) && validPersonalFields(data) && validWaterFields(data) && (!Object.hasOwn(data,'weights') || validWeights(data.weights)) && Array.isArray(data.entries) && data.entries.length<=MAX_ENTRIES && data.entries.every(validEntry) && new Set(data.entries.map(e=>e.id)).size===data.entries.length && Array.isArray(data.foods) && data.foods.length<=5000 && data.foods.every(validFood) && new Set(data.foods.map(f=>f.id)).size===data.foods.length && (data.goal===null || (number(data.goal,10000)&&data.goal>=1));
}
export function nutrientsFor(entry) {
  return Object.fromEntries(NUTRIENTS.map(k=>[k,entry.nutrients[k]*entry.quantity/entry.basis]));
}
export function sumEntries(entries) {
  return entries.reduce((s,entry)=>{const n=nutrientsFor(entry);for(const k of NUTRIENTS)s[k]+=n[k];return s;},Object.fromEntries(NUTRIENTS.map(k=>[k,0])));
}
function id() {return globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;}
export function createEntry(item, {date,meal,quantity=1}, now=new Date()) {
  const stamp=now.toISOString();
  const entry={id:id(),date,meal,quantity,name:item.name,type:item.type,unit:item.unit,basis:item.type==='recipe'?1:100,nutrients:{...item.nutrients},source:{...item.source},createdAt:stamp,updatedAt:stamp};
  if(item.recipeId)entry.recipeId=item.recipeId;
  if(item.ingredients)entry.ingredients=item.ingredients.map(i=>({name:i.name,grams:i.grams}));
  if(item.barcode)entry.barcode=item.barcode;
  if(!validEntry(entry))throw new Error('Controlla data, pasto, quantità e valori nutrizionali.');
  return entry;
}
export function foodItem(food) {return {...food,type:'food',basis:100};}
export function recipeItem(recipe,foods,quantities=recipe.ingredients.map(i=>i.grams),servings=1) {
  if(!number(servings,100)||servings<=0||quantities.length!==recipe.ingredients.length||quantities.some(q=>!number(q)))throw new Error('Controlla i grammi della ricetta.');
  const nutrients=Object.fromEntries(NUTRIENTS.map(k=>[k,0]));
  recipe.ingredients.forEach((i,index)=>{
    const food=i.food||foods[i.name];
    if(!validNutrients(food))throw new Error('Valori nutrizionali non disponibili.');
    for(const key of NUTRIENTS)nutrients[key]+=food[key]*quantities[index]/100/servings;
  });
  return {name:recipe.title,type:'recipe',recipeId:recipe.id,unit:'porzione',basis:1,nutrients,ingredients:recipe.ingredients.map((i,index)=>({name:i.name,grams:quantities[index]/servings})),source:{label:'Ricetta · '+(recipe.author||'Cibo sano'),url:safeLink(recipe.url)}};
}
export function catalogFoods(foods={}) {
  return Object.entries(foods).map(([name,f])=>({id:'catalog:'+name,name,unit:'g',origin:'catalog',nutrients:Object.fromEntries(NUTRIENTS.map(k=>[k,f[k]])),source:{label:f.source||'Ricettario',url:safeLink(f.url)},note:f.note||''})).filter(validFood).sort((a,b)=>a.name.localeCompare(b.name,'it'));
}
export function makeFood({id:foodId,name,unit,nutrients,source,origin='custom',barcode,portions}) {
  const food={id:foodId||(origin==='off'&&barcode?'off:'+barcode:id()),name:name.trim(),unit,nutrients:{...nutrients},source:source||{label:'Etichetta inserita da te',url:''},origin};
  if(barcode)food.barcode=barcode;
  if(portions!==undefined)food.portions=portions.map(p=>({...p}));
  if(!validFood(food))throw new Error('Completa il nome e tutti i valori per 100 g o 100 ml.');
  return food;
}
export function parseBackup(raw) {
  if(typeof raw!=='string'||raw.length>15000000)throw new Error('File troppo grande.');
  let value;try {value=JSON.parse(raw);}catch{throw new Error('Il file non è un backup JSON valido.');}
  if(!value||typeof value!=='object'||Array.isArray(value)||![BACKUP_FORMAT,FULL_BACKUP_FORMAT].includes(value.format)||!validDiary(value.data))throw new Error('Backup del diario non valido o versione non supportata.');
  return value.data;
}
export function mergeDiary(current,incoming) {
  if(!validDiary(current)||!validDiary(incoming))throw new Error('Dati del diario non validi.');
  const existing=new Set(current.entries.map(e=>e.id)),foodIds=new Set(current.foods.map(f=>f.id));
  const added=incoming.entries.filter(e=>!existing.has(e.id));
  const weightDates=new Set((current.weights||[]).map(record=>record.date));
  const weightsAdded=(incoming.weights||[]).filter(record=>!weightDates.has(record.date));
  const waterIds=new Set((current.waterEntries||[]).map(entry=>entry.id));
  const waterAdded=(incoming.waterEntries||[]).filter(entry=>!waterIds.has(entry.id)).length;
  const result={...current,...mergeInsightFields(current,incoming),...mergeKitchenFields(current,incoming),...mergePersonalFields(current,incoming),...mergeWaterFields(current,incoming),weights:[...(current.weights||[]),...weightsAdded],entries:[...current.entries,...added],foods:[...current.foods,...incoming.foods.filter(f=>!foodIds.has(f.id))],goal:current.goal??incoming.goal};
  if(!validDiary(result))throw new Error('Il diario risultante supera i limiti di memoria previsti.');
  return {data:result,added:added.length+weightsAdded.length+waterAdded,entriesAdded:added.length,weightsAdded:weightsAdded.length,waterAdded};
}
export class DiaryStore {
  constructor(storage) {this.storage=storage;}
  read() {
    let raw;try {raw=this.storage.getItem(DIARY_KEY);}catch{throw new Error('Memoria del browser non accessibile. Il diario non può essere salvato.');}
    let data;try{data=raw===null?emptyDiary():JSON.parse(raw);}catch{}
    if(!validDiary(data))throw new Error('Il diario salvato non è leggibile. I dati originali sono conservati: esporta una copia di recupero prima di intervenire.');
    if(!Object.hasOwn(data,'favorites')){
      try{const legacy=JSON.parse(this.storage.getItem(FAVORITES_KEY)||'null');if(validFavorites(legacy))data={...data,favorites:legacy};}catch{}
    }
    return data;
  }
  update(change) {
    const next=change(this.read());
    if(!validDiary(next))throw new Error('Dati non validi: nessuna modifica salvata.');
    try {this.storage.setItem(DIARY_KEY,JSON.stringify(next));}
    catch{throw new Error('Salvataggio non riuscito: memoria piena o non disponibile. Esporta il diario e libera spazio prima di riprovare.');}
    if(typeof globalThis.dispatchEvent==='function')queueMicrotask(()=>globalThis.dispatchEvent(new Event('cibo-sano:diary-change')));
    return next;
  }
  add(entry,food=null) {
    return this.update(data=>({...data,entries:[...data.entries,entry],foods:food?(data.foods.some(f=>f.id===food.id)?data.foods.map(f=>f.id===food.id?food:f):[...data.foods,food]):data.foods}));
  }
  saveFood(food,options={}) {
    if(!validFood(food))throw new Error('Prodotto non valido. Controlla tutti i valori.');
    return this.update(data=>{
      const previous=data.foods.find(f=>f.id===food.id);
      if(Object.hasOwn(options,'expectedUpdatedAt')&&(previous?.updatedAt??null)!==options.expectedUpdatedAt)throw new Error('Il prodotto è cambiato in un’altra finestra. Riaprilo prima di salvare.');
      const updatedAt=new Date(Math.max(Date.now(),previous?.updatedAt?Date.parse(previous.updatedAt)+1:0)).toISOString();
      const saved={...food,updatedAt};
      return {...data,foods:previous?data.foods.map(f=>f.id===food.id?saved:f):[...data.foods,saved]};
    });
  }
  removeFood(foodId,options={}) {
    return this.update(data=>{
      const previous=data.foods.find(f=>f.id===foodId);if(!previous)throw new Error('Prodotto già rimosso.');
      if(Object.hasOwn(options,'expectedUpdatedAt')&&(previous.updatedAt??null)!==options.expectedUpdatedAt)throw new Error('Il prodotto è cambiato in un’altra finestra. Riaprilo prima di rimuoverlo.');
      return {...data,foods:data.foods.filter(f=>f.id!==foodId)};
    });
  }
  edit(entryId,patch,options={}) {
    return this.update(data=>{
      const previous=data.entries.find(entry=>entry.id===entryId);
      if(!previous)throw new Error('Questa voce è stata rimossa in un’altra finestra.');
      if(Object.hasOwn(options,'expectedUpdatedAt')&&previous.updatedAt!==options.expectedUpdatedAt)throw new Error('La voce è cambiata in un’altra finestra. Chiudi e riapri la voce prima di modificarla.');
      const updatedAt=new Date(Math.max(Date.now(),Date.parse(previous.updatedAt)+1)).toISOString();
      return {...data,entries:data.entries.map(entry=>entry.id===entryId?{...entry,...patch,id:entry.id,updatedAt}:entry)};
    });
  }
  remove(entryId,options={}) {
    return this.update(data=>{
      if(Object.hasOwn(options,'expectedUpdatedAt')){
        const previous=data.entries.find(entry=>entry.id===entryId);
        if(!previous)throw new Error('Questa voce è già stata rimossa in un’altra finestra.');
        if(previous.updatedAt!==options.expectedUpdatedAt)throw new Error('La voce è cambiata in un’altra finestra. Chiudi e riapri la voce prima di rimuoverla.');
      }
      return {...data,entries:data.entries.filter(entry=>entry.id!==entryId)};
    });
  }
  saveWeight(date,kg,options={}) {
    if(!validDate(date)||date>localDate())throw new Error('Scegli una data valida, non successiva a oggi.');
    if(!number(kg,500)||kg<1)throw new Error('Inserisci un peso da 1 a 500 kg.');
    return this.update(data=>{
      const records=data.weights||[],previous=records.find(record=>record.date===date);
      if(Object.hasOwn(options,'expectedUpdatedAt')&&(previous?.updatedAt??null)!==options.expectedUpdatedAt)throw new Error('La pesata è cambiata in un’altra finestra. Seleziona di nuovo la data prima di salvarla.');
      const updatedAt=new Date(Math.max(Date.now(),previous?Date.parse(previous.updatedAt)+1:0)).toISOString();
      const record={date,kg:Math.round(kg*100)/100,updatedAt};
      return {...data,weights:previous?records.map(item=>item.date===date?record:item):[...records,record]};
    });
  }
  removeWeight(date,options={}) {
    return this.update(data=>{
      const records=data.weights||[],previous=records.find(record=>record.date===date);
      if(!previous)throw new Error('Questa pesata è già stata rimossa.');
      if(Object.hasOwn(options,'expectedUpdatedAt')&&previous.updatedAt!==options.expectedUpdatedAt)throw new Error('La pesata è cambiata in un’altra finestra. Controlla il valore aggiornato prima di rimuoverla.');
      return {...data,weights:records.filter(record=>record.date!==date)};
    });
  }
  restoreWeight(record) {
    if(!validWeight(record))throw new Error('Pesata non valida.');
    return this.update(data=>{
      if((data.weights||[]).some(item=>item.date===record.date))throw new Error('Quella data ha già una pesata. Il valore attuale è stato conservato.');
      return {...data,weights:[...(data.weights||[]),{...record}]};
    });
  }
  addWater(entry) {
    if(!validWaterEntry(entry))throw new Error('Registrazione dell’acqua non valida.');
    return this.update(data=>({...data,waterEntries:[...(data.waterEntries||[]),{...entry}]}));
  }
  editWater(entryId,patch,options={}) {
    if(!patch||typeof patch!=='object'||Array.isArray(patch))throw new Error('Registrazione dell’acqua non valida.');
    return this.update(data=>{
      const entries=data.waterEntries||[],previous=entries.find(entry=>entry.id===entryId);
      if(!previous)throw new Error('Questa registrazione dell’acqua è stata rimossa in un’altra finestra.');
      if(Object.hasOwn(options,'expectedUpdatedAt')&&previous.updatedAt!==options.expectedUpdatedAt)throw new Error('La registrazione dell’acqua è cambiata in un’altra finestra. Chiudi e riaprila prima di modificarla.');
      const updated={...previous,date:Object.hasOwn(patch,'date')?patch.date:previous.date,ml:Object.hasOwn(patch,'ml')?patch.ml:previous.ml,updatedAt:new Date(Math.max(Date.now(),Date.parse(previous.updatedAt)+1)).toISOString()};
      if(!validWaterEntry(updated))throw new Error('Inserisci una data valida e una quantità d’acqua da 1 a 10.000 ml.');
      return {...data,waterEntries:entries.map(entry=>entry.id===entryId?updated:entry)};
    });
  }
  removeWater(entryId,options={}) {
    return this.update(data=>{
      const entries=data.waterEntries||[],previous=entries.find(entry=>entry.id===entryId);
      if(!previous)throw new Error('Questa registrazione dell’acqua è già stata rimossa.');
      if(Object.hasOwn(options,'expectedUpdatedAt')&&previous.updatedAt!==options.expectedUpdatedAt)throw new Error('La registrazione dell’acqua è cambiata in un’altra finestra. Chiudi e riaprila prima di rimuoverla.');
      return {...data,waterEntries:entries.filter(entry=>entry.id!==entryId)};
    });
  }
  restoreWater(entry) {
    if(!validWaterEntry(entry))throw new Error('Registrazione dell’acqua non valida.');
    return this.update(data=>{
      if((data.waterEntries||[]).some(item=>item.id===entry.id))throw new Error('Questa registrazione dell’acqua è già presente. I dati attuali sono stati conservati.');
      return {...data,waterEntries:[...(data.waterEntries||[]),{...entry}]};
    });
  }
  setGoal(goal) {return this.update(data=>({...data,goal}));}
  export() {return JSON.stringify({format:FULL_BACKUP_FORMAT,exportedAt:new Date().toISOString(),data:this.read()},null,2);}
  import(raw) {const incoming=parseBackup(raw);let count=0;this.update(data=>{const merged=mergeDiary(data,incoming);count=merged.added;return merged.data;});return count;}
}

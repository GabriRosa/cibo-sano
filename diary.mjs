export const MEALS = {breakfast:'Colazione', snack:'Spuntino', lunch:'Pranzo', dinner:'Cena'};
export const NUTRIENTS = ['kcal','protein','carbs','fat'];
export const DIARY_KEY = 'cibo-sano:diary:v1';
export const BACKUP_FORMAT = 'cibo-sano-diary-v1';
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
  return !!f && text(f.id) && text(f.name) && ['g','ml'].includes(f.unit) && validNutrients(f.nutrients,1000) && ['catalog','custom','off'].includes(f.origin) && validSource(f.source) && (!f.barcode||/^\d{8,14}$/.test(f.barcode));
}
export function validEntry(v) {
  return !!v && text(v.id) && validDate(v.date) && Object.hasOwn(MEALS,v.meal) && text(v.name) && ['food','recipe'].includes(v.type) && ['g','ml','porzione'].includes(v.unit) && number(v.quantity) && v.quantity>0 && validNutrients(v.nutrients) && v.basis===(v.type==='recipe'?1:100) && (v.type==='recipe'?v.unit==='porzione':['g','ml'].includes(v.unit)) && validSource(v.source) && typeof v.createdAt==='string' && typeof v.updatedAt==='string' && Number.isFinite(Date.parse(v.createdAt)) && Number.isFinite(Date.parse(v.updatedAt)) && (!v.ingredients || (Array.isArray(v.ingredients)&&v.ingredients.length<=200&&v.ingredients.every(i=>text(i.name)&&number(i.grams))));
}
export function emptyDiary() {return {schemaVersion:1,entries:[],foods:[],goal:null};}
export function validDiary(data) {
  return !!data && data.schemaVersion===1 && Array.isArray(data.entries) && data.entries.length<=MAX_ENTRIES && data.entries.every(validEntry) && new Set(data.entries.map(e=>e.id)).size===data.entries.length && Array.isArray(data.foods) && data.foods.length<=5000 && data.foods.every(validFood) && new Set(data.foods.map(f=>f.id)).size===data.foods.length && (data.goal===null || (number(data.goal,10000)&&data.goal>=1));
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
    if(!validNutrients(foods[i.name]))throw new Error('Valori nutrizionali non disponibili.');
    for(const key of NUTRIENTS)nutrients[key]+=foods[i.name][key]*quantities[index]/100/servings;
  });
  return {name:recipe.title,type:'recipe',recipeId:recipe.id,unit:'porzione',basis:1,nutrients,ingredients:recipe.ingredients.map((i,index)=>({name:i.name,grams:quantities[index]/servings})),source:{label:'Ricetta · '+(recipe.author||'Cibo sano'),url:safeLink(recipe.url)}};
}
export function catalogFoods(foods={}) {
  return Object.entries(foods).map(([name,f])=>({id:'catalog:'+name,name,unit:'g',origin:'catalog',nutrients:Object.fromEntries(NUTRIENTS.map(k=>[k,f[k]])),source:{label:f.source||'Ricettario',url:safeLink(f.url)},note:f.note||''})).filter(validFood).sort((a,b)=>a.name.localeCompare(b.name,'it'));
}
export function makeFood({name,unit,nutrients,source,origin='custom',barcode}) {
  const food={id:origin==='off'&&barcode?'off:'+barcode:id(),name:name.trim(),unit,nutrients:{...nutrients},source:source||{label:'Etichetta inserita da te',url:''},origin};
  if(barcode)food.barcode=barcode;
  if(!validFood(food))throw new Error('Completa il nome e tutti i valori per 100 g o 100 ml.');
  return food;
}
export function parseBackup(raw) {
  if(typeof raw!=='string'||raw.length>15000000)throw new Error('File troppo grande.');
  let value;try {value=JSON.parse(raw);}catch{throw new Error('Il file non è un backup JSON valido.');}
  if(value.format!==BACKUP_FORMAT||!validDiary(value.data))throw new Error('Backup del diario non valido o versione non supportata.');
  return value.data;
}
export function mergeDiary(current,incoming) {
  if(!validDiary(current)||!validDiary(incoming))throw new Error('Dati del diario non validi.');
  const existing=new Set(current.entries.map(e=>e.id)),foodIds=new Set(current.foods.map(f=>f.id));
  const added=incoming.entries.filter(e=>!existing.has(e.id));
  const result={...current,entries:[...current.entries,...added],foods:[...current.foods,...incoming.foods.filter(f=>!foodIds.has(f.id))],goal:current.goal??incoming.goal};
  if(!validDiary(result))throw new Error('Il diario risultante supera i limiti di memoria previsti.');
  return {data:result,added:added.length};
}
export class DiaryStore {
  constructor(storage) {this.storage=storage;}
  read() {
    let raw;try {raw=this.storage.getItem(DIARY_KEY);}catch{throw new Error('Memoria del browser non accessibile. Il diario non può essere salvato.');}
    if(raw===null)return emptyDiary();
    let data;try{data=JSON.parse(raw);}catch{}
    if(!validDiary(data))throw new Error('Il diario salvato non è leggibile. I dati originali sono conservati: esporta una copia di recupero prima di intervenire.');
    return data;
  }
  update(change) {
    const next=change(this.read());
    if(!validDiary(next))throw new Error('Dati non validi: nessuna modifica salvata.');
    try {this.storage.setItem(DIARY_KEY,JSON.stringify(next));}
    catch{throw new Error('Salvataggio non riuscito: memoria piena o non disponibile. Esporta il diario e libera spazio prima di riprovare.');}
    return next;
  }
  add(entry,food=null) {
    return this.update(data=>({...data,entries:[...data.entries,entry],foods:food?(data.foods.some(f=>f.id===food.id)?data.foods.map(f=>f.id===food.id?food:f):[...data.foods,food]):data.foods}));
  }
  edit(entryId,patch) {
    return this.update(data=>{if(!data.entries.some(e=>e.id===entryId))throw new Error('Questa voce è stata rimossa in un’altra finestra.');return {...data,entries:data.entries.map(e=>e.id===entryId?{...e,...patch,id:e.id,updatedAt:new Date().toISOString()}:e)};});
  }
  remove(entryId) {return this.update(data=>({...data,entries:data.entries.filter(e=>e.id!==entryId)}));}
  setGoal(goal) {return this.update(data=>({...data,goal}));}
  export() {return JSON.stringify({format:BACKUP_FORMAT,exportedAt:new Date().toISOString(),data:this.read()},null,2);}
  import(raw) {const incoming=parseBackup(raw);let count=0;this.update(data=>{const merged=mergeDiary(data,incoming);count=merged.added;return merged.data;});return count;}
}

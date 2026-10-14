// Optional diary/backup fields (omission means an empty array):
// pantry: [{id,name,quantity:number|null,unit:'g'|'ml'|'pz',updatedAt}]
// plans: [{id,name,recipeId?,date,meal,servings,nutrients,source,
//          ingredients:[{name,quantity,unit}],createdAt,updatedAt}]
// shoppingChecks: [{week,name,unit,checked,quantity?,updatedAt}]
// A plan's ingredients and nutrients describe ONE serving; servings is the
// planned multiplier. Check.quantity captures the amount shown when checked.
// This module has no dependency on diary.mjs: the diary validator imports it.
export const KITCHEN_MEALS = {breakfast:'Colazione', snack:'Spuntino', lunch:'Pranzo', dinner:'Cena'};
export const KITCHEN_UNITS = ['g','ml','pz'];
const NUTRIENTS = ['kcal','protein','carbs','fat'];
const MAX_ROWS = 30000;
const MAX_QUANTITY = 1000000;
const has = (object,key) => Object.prototype.hasOwnProperty.call(object,key);
const text = (value,max=200) => typeof value==='string' && value.trim().length>0 && value.length<=max;
const number = (value,max=MAX_QUANTITY) => typeof value==='number' && Number.isFinite(value) && value>=0 && value<=max;
const stamp = value => typeof value==='string' && Number.isFinite(Date.parse(value));
const round = value => Math.round((value+Number.EPSILON)*10000)/10000;
const newId = () => globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export function normalizeIngredientName(name) {
  return String(name??'').toLocaleLowerCase('it').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ');
}
export function ingredientKey(name,unit) {return JSON.stringify([normalizeIngredientName(name),unit]);}
function validDate(value) {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||value<'1900-01-01'||value>'2200-12-31')return false;
  const date=new Date(value+'T12:00:00Z');
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0,10)===value;
}
export function shiftKitchenDate(value,days) {
  if(!validDate(value)||!Number.isInteger(days))throw new Error('Data non valida.');
  const date=new Date(value+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+days);
  return date.toISOString().slice(0,10);
}
export function weekStart(value) {
  if(!validDate(value))throw new Error('Data non valida.');
  const weekday=new Date(value+'T12:00:00Z').getUTCDay();
  return shiftKitchenDate(value,-((weekday+6)%7));
}
export function weekDates(value) {
  const start=weekStart(value);return Array.from({length:7},(_,index)=>shiftKitchenDate(start,index));
}
function validSource(source) {
  if(!source||typeof source.label!=='string'||source.label.length>300||typeof source.url!=='string'||source.url.length>2000)return false;
  if(!source.url)return true;
  try {const url=new URL(source.url);return url.protocol==='https:'&&!url.username&&!url.password;}catch{return false;}
}
function validNutrients(value) {return !!value&&NUTRIENTS.every(key=>number(value[key],100000));}
export function validPantryItem(item) {
  return !!item && text(item.id) && text(item.name) && KITCHEN_UNITS.includes(item.unit) && (item.quantity===null||number(item.quantity)) && stamp(item.updatedAt);
}
export function validPlan(plan) {
  return !!plan && text(plan.id) && text(plan.name) && (!has(plan,'recipeId')||text(plan.recipeId)) && validDate(plan.date) && has(KITCHEN_MEALS,plan.meal) && number(plan.servings,100) && plan.servings>0 && validNutrients(plan.nutrients) && validSource(plan.source) && stamp(plan.createdAt) && stamp(plan.updatedAt) && Array.isArray(plan.ingredients) && plan.ingredients.length>0 && plan.ingredients.length<=200 && plan.ingredients.every(item=>!!item&&text(item.name)&&KITCHEN_UNITS.includes(item.unit)&&number(item.quantity));
}
export function shoppingCheckKey(check) {return JSON.stringify([check.week,normalizeIngredientName(check.name),check.unit]);}
function validShoppingCheck(check) {
  return !!check&&validDate(check.week)&&weekStart(check.week)===check.week&&text(check.name)&&KITCHEN_UNITS.includes(check.unit)&&typeof check.checked==='boolean'&&(!has(check,'quantity')||number(check.quantity,1000000000000))&&stamp(check.updatedAt);
}
function validRows(rows,validator,key) {
  return Array.isArray(rows)&&rows.length<=MAX_ROWS&&rows.every(validator)&&new Set(rows.map(key)).size===rows.length;
}
/** Missing optional arrays are accepted so existing diary backups stay valid. */
export function validKitchenFields(data) {
  return !!data && typeof data==='object' &&
    (!has(data,'pantry')||validRows(data.pantry,validPantryItem,item=>item.id)) &&
    (!has(data,'plans')||validRows(data.plans,validPlan,item=>item.id)) &&
    (!has(data,'shoppingChecks')||validRows(data.shoppingChecks,validShoppingCheck,shoppingCheckKey));
}
/** Return only the three kitchen fields. Existing local IDs/check keys win. */
export function mergeKitchenFields(current,incoming) {
  if(!validKitchenFields(current)||!validKitchenFields(incoming))throw new Error('Piano o dispensa non validi.');
  const merge=(field,key)=>{
    const local=current[field]||[],known=new Set(local.map(key));
    return [...local,...(incoming[field]||[]).filter(item=>!known.has(key(item)))];
  };
  const fields={pantry:merge('pantry',item=>item.id),plans:merge('plans',item=>item.id),shoppingChecks:merge('shoppingChecks',shoppingCheckKey)};
  if(!validKitchenFields(fields))throw new Error('Piano e dispensa superano i limiti di memoria previsti.');
  return fields;
}

/** item is a diary-compatible recipe item; amounts and nutrients are per serving. */
export function createPlan(item,{date,meal,servings=1},now=new Date()) {
  const time=now.toISOString();
  const plan={id:newId(),name:item.name,date,meal,servings,nutrients:{...item.nutrients},source:{...item.source},ingredients:(item.ingredients||[]).map(ingredient=>({name:ingredient.name,quantity:ingredient.grams??ingredient.quantity,unit:ingredient.unit||'g'})),createdAt:time,updatedAt:time};
  if(item.recipeId)plan.recipeId=item.recipeId;
  if(item.type!=='recipe'||!validPlan(plan))throw new Error('Controlla la ricetta, la data, il pasto e le porzioni (massimo 100).');
  return plan;
}
/** Editing a plan changes its schedule/servings while preserving its recipe snapshot. */
export function updatePlan(plan,{date=plan.date,meal=plan.meal,servings=plan.servings},now=new Date()) {
  const updated={...plan,date,meal,servings,updatedAt:new Date(Math.max(now.valueOf(),Date.parse(plan.updatedAt)+1)).toISOString()};
  if(!validPlan(updated))throw new Error('Controlla la data, il pasto e le porzioni (massimo 100).');
  return updated;
}
/** No diary entry is created here. The caller opens its confirmation editor. */
export function plannedRecipeItem(plan) {
  if(!validPlan(plan))throw new Error('Pasto pianificato non valido.');
  const item={name:plan.name,type:'recipe',unit:'porzione',basis:1,nutrients:{...plan.nutrients},source:{...plan.source}};
  if(plan.recipeId)item.recipeId=plan.recipeId;
  // The diary's ingredient format is grams only: never invent a conversion.
  if(plan.ingredients.every(ingredient=>ingredient.unit==='g'))item.ingredients=plan.ingredients.map(ingredient=>({name:ingredient.name,grams:ingredient.quantity}));
  return item;
}
export function createPantryItem({name,quantity,unit},now=new Date()) {
  const item={id:newId(),name:String(name??'').trim(),quantity,unit,updatedAt:now.toISOString()};
  if(!validPantryItem(item))throw new Error('Inserisci un nome, un’unità e una quantità valida, oppure indica “Da pesare”.');
  return item;
}

/** Aggregate one week; matching is exact after case/accent/space normalization.
 * No conversion is made between grams, millilitres and pieces. Unknown amounts
 * are reported separately and never reduce a required quantity.
 */
export function shoppingList(plans,pantry=[],week=null) {
  const start=week===null?null:weekStart(week),end=start===null?null:shiftKitchenDate(start,6),rows=new Map();
  for(const plan of plans) {
    if(start!==null&&(plan.date<start||plan.date>end))continue;
    for(const ingredient of plan.ingredients) {
      const amount=ingredient.quantity*plan.servings;if(amount<=0)continue;
      const key=ingredientKey(ingredient.name,ingredient.unit);
      if(!rows.has(key))rows.set(key,{key,name:ingredient.name,unit:ingredient.unit,required:0});
      rows.get(key).required+=amount;
    }
  }
  return [...rows.values()].map(row=>{
    const stock=pantry.filter(item=>normalizeIngredientName(item.name)===normalizeIngredientName(row.name));
    const same=stock.filter(item=>item.unit===row.unit);
    const available=round(same.reduce((total,item)=>total+(item.quantity??0),0));
    const required=round(row.required),used=round(Math.min(required,available));
    return {...row,required,available,used,toBuy:round(Math.max(0,required-available)),unquantified:same.some(item=>item.quantity===null),otherUnits:[...new Set(stock.filter(item=>item.unit!==row.unit&&(item.quantity===null||item.quantity>0)).map(item=>item.unit))]};
  }).sort((a,b)=>a.name.localeCompare(b.name,'it')||a.unit.localeCompare(b.unit));
}
export function excludesTofu(recipe) {
  return !/\btofu\b/u.test(normalizeIngredientName([recipe.title||recipe.name,...(recipe.ingredients||[]).map(item=>item.name)].join(' ')));
}
/** Each recipe is evaluated independently for one serving, without reserving stock. */
export function suggestRecipes(recipes,pantry,limit=6) {
  return recipes.filter(recipe=>excludesTofu(recipe)&&recipe.ingredients?.length).map(recipe=>{
    const matches=shoppingList([{servings:1,ingredients:recipe.ingredients.map(item=>({name:item.name,quantity:item.grams??item.quantity,unit:item.unit||'g'}))}],pantry).map(row=>({...row,status:row.toBuy===0?'sufficient':row.available>0?'partial':row.unquantified||row.otherUnits.length?'unquantified':'missing'}));
    const count=status=>matches.filter(row=>row.status===status).length;
    const sufficientCount=count('sufficient'),partialCount=count('partial'),unquantifiedCount=count('unquantified'),missingCount=count('missing');
    const ingredientCount=matches.length,coverage=ingredientCount?matches.reduce((total,row)=>total+Math.min(1,row.available/row.required),0)/ingredientCount:0;
    return {recipe,matches,ingredientCount,sufficientCount,partialCount,unquantifiedCount,missingCount,coverage,complete:ingredientCount>0&&sufficientCount===ingredientCount};
  }).filter(result=>result.ingredientCount>0&&(result.sufficientCount+result.partialCount+result.unquantifiedCount)>0).sort((a,b)=>Number(b.complete)-Number(a.complete)||(b.sufficientCount/b.ingredientCount-a.sufficientCount/a.ingredientCount)||b.coverage-a.coverage||(b.unquantifiedCount/b.ingredientCount-a.unquantifiedCount/a.ingredientCount)||a.recipe.title.localeCompare(b.recipe.title,'it')).slice(0,Math.max(0,limit));
}

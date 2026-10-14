import {categories, nutrientKeys, nutritionFor} from './lib.mjs';

export const FAVORITES_KEY = 'cibo-sano:favorites:v1';
const text = (value,max=200) => typeof value==='string' && value.trim().length>0 && value.length<=max;
const stamp = value => typeof value==='string' && Number.isFinite(Date.parse(value));
const safeURL = value => {try {const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}};
export function validFavorites(value) {
  return Array.isArray(value) && value.length<=10000 && value.every(id=>typeof id==='string'&&/^[a-z0-9-]{1,200}$/.test(id)) && new Set(value).size===value.length;
}
export function validIngredientFood(food) {
  return !!food && nutrientKeys.every(k=>typeof food[k]==='number'&&Number.isFinite(food[k])&&food[k]>=0&&food[k]<=1000) &&
    text(food.source,300) && typeof food.url==='string' && food.url.length<=2000 && (!food.url||safeURL(food.url)) &&
    typeof food.reference==='string' && food.reference.length<=2000;
}
export function validPersonalRecipe(recipe) {
  return !!recipe && recipe.personal===true && /^local-[a-z0-9-]{1,190}$/.test(recipe.id) && text(recipe.title) &&
    categories.slice(1).includes(recipe.category) && recipe.kind==='originale' && text(recipe.originalId) &&
    typeof recipe.ingredientText==='string' && recipe.ingredientText.length<=20000 && typeof recipe.notes==='string' && recipe.notes.length<=10000 &&
    typeof recipe.author==='string' && recipe.author.length<=200 && typeof recipe.url==='string' && (!recipe.url||safeURL(recipe.url)) &&
    stamp(recipe.createdAt) && stamp(recipe.updatedAt) &&
    Array.isArray(recipe.ingredients) && recipe.ingredients.length>0 && recipe.ingredients.length<=100 && recipe.ingredients.every(i=>
      text(i.name)&&typeof i.grams==='number'&&Number.isFinite(i.grams)&&i.grams>0&&i.grams<=10000&&validIngredientFood(i.food)) &&
    Array.isArray(recipe.steps) && recipe.steps.length<=100 && recipe.steps.every(s=>text(s,5000)) &&
    typeof recipe.kcal==='number'&&Number.isFinite(recipe.kcal)&&recipe.kcal>=0;
}
export function validPersonalFields(data) {
  return (!Object.hasOwn(data,'favorites')||validFavorites(data.favorites)) &&
    (!Object.hasOwn(data,'personalRecipes')||(Array.isArray(data.personalRecipes)&&data.personalRecipes.length<=1000&&data.personalRecipes.every(validPersonalRecipe)&&new Set(data.personalRecipes.map(r=>r.id)).size===data.personalRecipes.length));
}
export function mergePersonalFields(current,incoming) {
  const result={};
  if(current.favorites||incoming.favorites)result.favorites=[...new Set([...(current.favorites||[]),...(incoming.favorites||[])])];
  if(current.personalRecipes||incoming.personalRecipes){
    const ids=new Set((current.personalRecipes||[]).map(r=>r.id));
    result.personalRecipes=[...(current.personalRecipes||[]),...(incoming.personalRecipes||[]).filter(r=>!ids.has(r.id))];
  }
  return result;
}
export function makePersonalRecipe(source,{title,notes='',steps=source.steps,ingredients},now=new Date()) {
  const timestamp=now.toISOString();
  const recipe={
    id:'local-'+(globalThis.crypto?.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`),
    personal:true,originalId:source.originalId||source.id,title:title.trim(),category:source.category,kind:'originale',
    ingredientText:source.ingredientText||'',notes:notes.trim(),author:source.author||'',url:source.url||'',
    sourceType:'Variante personale',quantityBasis:'adattamento',quantityNote:'Ingredienti e dosi della tua versione, per una porzione. I valori nutrizionali sono conservati al momento del salvataggio.',
    portionLabel:'1 porzione · versione personale',collection:source.collection||'',
    ingredients:ingredients.filter(i=>i.grams>0).map(i=>({name:i.name,grams:i.grams,added:false,note:'',food:{...i.food}})),
    steps:steps.map(s=>s.trim()).filter(Boolean),createdAt:timestamp,updatedAt:timestamp,kcal:0
  };
  const n=nutritionFor(recipe,{});if(n)recipe.kcal=Math.round(n.kcal);
  if(!n||!validPersonalRecipe(recipe))throw new Error('Controlla nome, ingredienti e dosi della tua versione.');
  return recipe;
}
export function recipeFoodSnapshot(ingredient,foods) {
  const food=ingredient.food||foods[ingredient.name];
  const result={...Object.fromEntries(nutrientKeys.map(k=>[k,food?.[k]])),source:food?.source||'Ricettario',url:food?.url||'',reference:food?.reference||'',note:food?.note||''};
  if(!validIngredientFood(result))throw new Error('Valori nutrizionali mancanti per '+ingredient.name);
  return result;
}

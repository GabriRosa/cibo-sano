export const categories = ['Tutte', 'Carne', 'Pesce', 'Pasta e cereali', 'Vegetali e legumi', 'Dolci e colazioni', 'Salse e basi'];
export const categoryIcons = {'Tutte':'✦', 'Carne':'🥘', 'Pesce':'🐟', 'Pasta e cereali':'🍝', 'Vegetali e legumi':'🥬', 'Dolci e colazioni':'🍐', 'Salse e basi':'🥣'};
export const normalize = text => String(text ?? '').toLocaleLowerCase('it').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
export const escapeHTML = text => String(text ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
export function searchableText(recipe) {
  return normalize([recipe.title, recipe.category, recipe.ingredientText, ...recipe.ingredients.map(i => i.name), recipe.author].join(' '));
}
export function filterRecipes(recipes, {query='', category='Tutte', view='all', favorites=new Set(), sort='default'}={}) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  const rows = recipes.filter(r => (category==='Tutte' || r.category===category) &&
    (view!=='favorites' || favorites.has(r.id)) && (view!=='portions' || r.kind==='porzione') &&
    (view!=='breakfast' || r.collection==='Colazioni') &&
    terms.every(term => searchableText(r).split(/[^\p{L}\p{N}]+/u).some(word => word.startsWith(term))));
  const byTitle = (a,b) => a.title.localeCompare(b.title, 'it');
  if (sort==='az') rows.sort(byTitle);
  if (sort==='kcal') rows.sort((a,b) => (a.kcal ?? Infinity) - (b.kcal ?? Infinity) || byTitle(a,b));
  return rows;
}
export function scaledAmount(grams, servings=1) {
  return new Intl.NumberFormat('it-IT', {maximumFractionDigits:1}).format(grams * servings) + ' g';
}
export const nutrientKeys = ['kcal', 'protein', 'carbs', 'fat'];
export function parseGrams(value) {
  const text = String(value).trim().replace(',', '.');
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return null;
  const grams = Number(text);
  return Number.isFinite(grams) && grams >= 0 && grams <= 10000 ? grams : null;
}
export function nutritionFor(recipe, foods, quantities=recipe.ingredients.map(i=>i.grams)) {
  if (!recipe.ingredients.length || quantities.length!==recipe.ingredients.length) return null;
  const total = Object.fromEntries(nutrientKeys.map(key=>[key,0]));
  for (let index=0; index<recipe.ingredients.length; index++) {
    const grams=quantities[index], food=foods?.[recipe.ingredients[index].name];
    if (typeof grams!=='number' || !Number.isFinite(grams) || grams<0 || grams>10000 ||
        !food || nutrientKeys.some(key=>typeof food[key]!=='number' || !Number.isFinite(food[key]) || food[key]<0)) return null;
    for (const key of nutrientKeys) total[key]+=food[key]*grams/100;
  }
  return total;
}
export function scaleQuantities(quantities, previousServings, nextServings) {
  return quantities.map(grams=>grams===null ? null : Math.round(grams*nextServings/previousServings*10000)/10000);
}
export function validData(data) {
  if (data?.schemaVersion!==1 || typeof data.version!=='string' || !Array.isArray(data.recipes) || !data.recipes.length) return false;
  const ids = new Set();
  for (const r of data.recipes) {
    if (!r || typeof r.id!=='string' || !/^[a-z0-9-]+$/.test(r.id) || ids.has(r.id) ||
        typeof r.title!=='string' || !categories.includes(r.category) ||
        !['originale','porzione'].includes(r.kind) || typeof r.ingredientText!=='string' ||
        !Array.isArray(r.ingredients) || !Array.isArray(r.steps) || !r.steps.every(s=>typeof s==='string') ||
        (r.kcal!==null && (typeof r.kcal!=='number' || !Number.isFinite(r.kcal) || r.kcal<=0)) ||
        r.ingredients.some(i=>typeof i.name!=='string' || typeof i.grams!=='number' || !Number.isFinite(i.grams) || i.grams<=0)) return false;
    if (!nutritionFor(r,data.foods)) return false;
    ids.add(r.id);
  }
  return true;
}
export function sourceURL(value) {
  try {
    const url = new URL(value);
    return url.protocol==='https:' && ['www.instagram.com','instagram.com','cheftara.substack.com'].includes(url.hostname) ? url.href : null;
  } catch { return null; }
}
export function parseFavorites(text, knownIDs=null) {
  const parsed = JSON.parse(text);
  const ids = Array.isArray(parsed) ? parsed : parsed?.favorites;
  if (!Array.isArray(ids) || ids.some(id=>typeof id!=='string' || !/^[a-z0-9-]+$/.test(id))) throw new Error('Formato dei preferiti non valido');
  return new Set(ids.filter(id=>!knownIDs || knownIDs.has(id)));
}

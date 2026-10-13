import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {nutritionFor, nutrientKeys, parseGrams, scaleQuantities, validData} from '../lib.mjs';
const data=JSON.parse(readFileSync(new URL('../recipes.json',import.meta.url),'utf8'));
const chicken=data.recipes.find(r=>r.id==='idea-01');
const close=(a,b)=>assert(Math.abs(a-b)<0.00001,`${a} != ${b}`);
test('every quantified recipe has complete sourced nutrition and matching card calories',()=>{
  for(const recipe of data.recipes) {
    const total=nutritionFor(recipe,data.foods);
    assert(total); assert.equal(recipe.kcal,Math.round(total.kcal));
    for(const ingredient of recipe.ingredients) {
      const f=data.foods[ingredient.name];assert(f.reference);assert(f.source);
      assert.equal(new URL(f.url).protocol,'https:');
    }
  }
  assert.equal(data.recipes.length,187);
  assert.equal(data.recipes.filter(r=>r.kind==='originale').length,142);
});
test('chicken meal sums weighed raw foods; doubling portions doubles every total',()=>{
  const total=nutritionFor(chicken,data.foods);
  close(total.kcal,534);
  close(total.protein,50.32);
  close(total.carbs,54.54);
  close(total.fat,14.05);
  const grams=chicken.ingredients.map(i=>i.grams);
  const doubled=nutritionFor(chicken,data.foods,scaleQuantities(grams,1,2));
  for(const key of nutrientKeys)close(doubled[key],total[key]*2);
});
test('editing only oil changes energy and fat without changing protein or carbohydrates',()=>{
  const grams=chicken.ingredients.map(i=>i.grams),base=nutritionFor(chicken,data.foods);
  const oil=chicken.ingredients.findIndex(i=>i.name==='Olio EVO');grams[oil]=20;
  const changed=nutritionFor(chicken,data.foods,grams);
  close(changed.kcal-base.kcal,89.9);close(changed.fat-base.fat,9.99);
  close(changed.protein,base.protein);close(changed.carbs,base.carbs);
  const scaled=scaleQuantities(grams,1,3);
  close(scaled[oil],60);close(scaleQuantities(scaled,3,1)[oil],20);
});
test('zero excludes ingredients, comma decimals work, blank and invalid amounts never imply zero',()=>{
  assert.equal(parseGrams('12,5'),12.5);assert.equal(parseGrams('0'),0);
  for(const bad of ['', ' ', '-2', 'Infinity', '12abc', '1e2','10001','1,2,3'])assert.equal(parseGrams(bad),null);
  const grams=chicken.ingredients.map(()=>0);
  assert.deepEqual(nutritionFor(chicken,data.foods,grams),{kcal:0,protein:0,carbs:0,fat:0});
  grams[0]=null;assert.equal(nutritionFor(chicken,data.foods,grams),null);
  assert.equal(scaleQuantities(grams,1,2)[0],null);
  const damaged=structuredClone(data);delete damaged.foods['Olio EVO'].protein;
  assert.equal(validData(damaged),false);
});

test('source recipes preserve source text and declare the calculated portion and assumptions',()=>{
  for(const r of data.recipes.filter(r=>r.kind==='originale')){
    assert(r.ingredientText.length>0,r.id); assert(r.quantityNote.length>20,r.id);
    assert(r.portionLabel,r.id); assert.equal(r.servings,1);
  }
  for(const [source,count] of [['fonte-003',3],['fonte-007',2],['fonte-031',6],['fonte-053',3]]) {
    const variants=data.recipes.filter(r=>r.sourceRecipeId===source);
    assert.equal(variants.length,count);
    assert.equal(new Set(variants.map(r=>JSON.stringify(r.ingredients))).size,count);
  }
});
test('original recipes recalculate individual ingredients and portions; missing nutrition fails validation',()=>{
  const recipe=data.recipes.find(r=>r.id==='fonte-056');
  const grams=recipe.ingredients.map(i=>i.grams),base=nutritionFor(recipe,data.foods);
  const doubled=nutritionFor(recipe,data.foods,scaleQuantities(grams,1,2));
  for(const key of nutrientKeys)close(doubled[key],base[key]*2);
  const oil=recipe.ingredients.findIndex(i=>i.name==='Olio EVO');
  grams[oil]+=5;
  const changed=nutritionFor(recipe,data.foods,grams);
  close(changed.kcal-base.kcal,44.95);close(changed.protein,base.protein);
  const missing=structuredClone(data);missing.recipes.find(r=>r.id===recipe.id).ingredients=[];
  assert.equal(validData(missing),false);
  delete missing.foods; assert.equal(validData(missing),false);
});
test('sauces and batch recipes are expressed per portion, not per whole batch',()=>{
  const sauce=data.recipes.find(r=>r.id==='fonte-023');
  close(nutritionFor(sauce,data.foods).kcal,26.75);
  assert.equal(sauce.ingredients.find(i=>i.name==='Uovo intero').grams,20);
  const burrito=data.recipes.find(r=>r.id==='fonte-065');
  assert.equal(burrito.ingredients.find(i=>i.name==='Uovo intero').grams,100);
  assert.equal(burrito.ingredients.find(i=>i.name==='Tortilla di frumento').grams,60);
});

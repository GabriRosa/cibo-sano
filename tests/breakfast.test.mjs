import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {filterRecipes, nutritionFor, nutrientKeys, scaleQuantities} from '../lib.mjs';
const data=JSON.parse(readFileSync(new URL('../recipes.json',import.meta.url),'utf8'));
const breakfast=data.recipes.filter(r=>r.collection==='Colazioni');
test('breakfast collection covers 43 recovered reels, ten variants and one declared unresolved source',()=>{
  assert.equal(breakfast.length,52);
  assert.equal(new Set(breakfast.map(r=>r.url)).size,43);
  assert.equal(breakfast.filter(r=>r.sourceRecipeId==='colazione-026').length,10);
  assert.equal(data.collectionNotes.Colazioni.sourceCount,44);
  assert.equal(data.collectionNotes.Colazioni.unresolved.length,1);
  assert(!breakfast.some(r=>r.id==='colazione-004'));
});
test('breakfast filter excludes other collections and combines with ingredient search',()=>{
  assert.deepEqual(filterRecipes(data.recipes,{view:'breakfast'}),breakfast);
  const matches=filterRecipes(data.recipes,{view:'breakfast',query:'chia'});
  assert(matches.length>0); assert(matches.every(r=>r.collection==='Colazioni'));
  assert.equal(filterRecipes(data.recipes,{view:'breakfast',category:'Pesce'}).length,0);
});
test('breakfast nutrition responds to portions and individual ingredient changes',()=>{
  for(const recipe of breakfast){
    const grams=recipe.ingredients.map(i=>i.grams), base=nutritionFor(recipe,data.foods);
    const doubled=nutritionFor(recipe,data.foods,scaleQuantities(grams,1,2));
    for(const key of nutrientKeys)assert(Math.abs(doubled[key]-2*base[key])<1e-6,recipe.id);
    grams[0]=0;
    const edited=nutritionFor(recipe,data.foods,grams),food=data.foods[recipe.ingredients[0].name];
    for(const key of nutrientKeys)assert(Math.abs(edited[key]-(base[key]-food[key]*recipe.ingredients[0].grams/100))<1e-6,recipe.id);
    assert(recipe.quantityNote.length>30); assert(recipe.portionLabel);
  }
});

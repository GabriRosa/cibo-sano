import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {nutritionFor} from '../lib.mjs';
import {DiaryStore,DIARY_KEY,FULL_BACKUP_FORMAT,createEntry,recipeItem,makeFood,foodItem,nutrientsFor,parseBackup,emptyDiary} from '../diary.mjs';
import {makePersonalRecipe,recipeFoodSnapshot,FAVORITES_KEY,validPersonalRecipe} from '../personal-recipes.mjs';
import {createPantryItem,createPlan} from '../kitchen.mjs';
const catalog=JSON.parse(readFileSync(new URL('../recipes.json',import.meta.url)));
const memory=()=>{const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};};
function version(){const source=catalog.recipes[0];return makePersonalRecipe(source,{title:'La mia versione',notes:'Test',ingredients:source.ingredients.map(i=>({name:i.name,grams:i.grams/2,food:recipeFoodSnapshot(i,catalog.foods)}))});}

test('personal recipe snapshots keep nutrition after catalog or source quantities change',()=>{
  const recipe=version(),original=nutritionFor(catalog.recipes[0],catalog.foods),total=nutritionFor(recipe,{});
  assert(validPersonalRecipe(recipe));assert.equal(total.kcal,original.kcal/2);
  const foods=structuredClone(catalog.foods);for(const food of Object.values(foods))food.kcal=999;
  assert.deepEqual(nutritionFor(recipe,foods),total);
  const entry=createEntry(recipeItem(recipe,foods),{date:'2026-10-14',meal:'lunch',quantity:2});
  recipe.ingredients[0].food.kcal=0;recipe.ingredients[0].grams=0;
  assert.equal(nutrientsFor(entry).kcal,original.kcal);
});
test('version creation removes explicitly excluded ingredients but rejects empty and missing nutrition',()=>{
  const recipe=version(),args={title:'Zero',ingredients:recipe.ingredients.map(i=>({...i,grams:0}))};
  assert.throws(()=>makePersonalRecipe(recipe,args));
  assert.throws(()=>makePersonalRecipe(recipe,{...args,ingredients:[{name:'Ignoto',grams:100,food:{kcal:0}}]}));
  assert.throws(()=>makePersonalRecipe(recipe,{title:'',ingredients:recipe.ingredients}));
});
test('complete backup restores all feature fields and old favorites using one diary write',()=>{
  const backing=memory(),store=new DiaryStore(backing),recipe=version();
  backing.setItem(FAVORITES_KEY,JSON.stringify([catalog.recipes[0].id]));
  const food=makeFood({name:'Yogurt',unit:'g',nutrients:{kcal:60,protein:10,carbs:4,fat:0},portions:[{name:'vasetto',quantity:170}]});
  store.saveFood(food);const plan=createPlan(recipeItem(recipe,{}),{date:'2026-10-14',meal:'dinner',servings:2});
  store.update(data=>({...data,personalRecipes:[recipe],pantry:[createPantryItem({name:'Riso',quantity:300,unit:'g'})],plans:[plan],shoppingChecks:[{week:'2026-10-12',name:'Riso',unit:'g',checked:true,updatedAt:new Date().toISOString()}],targets:[{date:'2026-10-14',kcal:1800,protein:120,carbs:null,fat:60}],completeDays:['2026-10-13']}));
  const raw=store.export();assert.equal(JSON.parse(raw).format,FULL_BACKUP_FORMAT);
  const restored=new DiaryStore(memory());restored.import(raw);
  assert.deepEqual(restored.read(),store.read());
  assert.deepEqual(restored.read().favorites,[catalog.recipes[0].id]);
  restored.import(raw);assert.equal(restored.read().personalRecipes.length,1);assert.equal(restored.read().plans.length,1);
});
test('invalid new fields reject the entire backup before any write',()=>{
  const storage=memory(),store=new DiaryStore(storage);store.setGoal(1900);
  const before=storage.getItem(DIARY_KEY),valid=JSON.parse(store.export());
  for(const field of ['personalRecipes','pantry','plans','targets','completeDays','favorites','shoppingChecks']){
    const bad=structuredClone(valid);bad.data[field]=[{}];
    assert.throws(()=>store.import(JSON.stringify(bad)),field);assert.equal(storage.getItem(DIARY_KEY),before);
  }
  const unsafe=version();unsafe.ingredients[0].food.url='javascript:alert(1)';
  assert.throws(()=>parseBackup(JSON.stringify({...valid,data:{...valid.data,personalRecipes:[unsafe]}})));
  assert.deepEqual(parseBackup(JSON.stringify({format:'cibo-sano-diary-v1',data:emptyDiary()})),emptyDiary());
});
test('JSON values without a backup envelope produce a readable error and preserve stored data',()=>{
  const storage=memory(),store=new DiaryStore(storage);store.setGoal(1900);
  const before=storage.getItem(DIARY_KEY);
  for(const raw of ['null','true','123','"backup"','[]','{}']){
    assert.throws(()=>store.import(raw),{name:'Error',message:'Backup del diario non valido o versione non supportata.'});
    assert.equal(storage.getItem(DIARY_KEY),before);
  }
});
test('editing personal products changes future choices while preserving prior diary snapshots',()=>{
  const storage=memory(),store=new DiaryStore(storage);
  let food=makeFood({name:'Latte',unit:'ml',nutrients:{kcal:50,protein:3,carbs:5,fat:2},portions:[{name:'bicchiere',quantity:200}]});
  store.saveFood(food,{expectedUpdatedAt:null});food=store.read().foods[0];
  store.add(createEntry(foodItem(food),{date:'2026-10-14',meal:'breakfast',quantity:200}));
  store.saveFood({...food,nutrients:{...food.nutrients,kcal:100}},{expectedUpdatedAt:food.updatedAt});
  assert.equal(nutrientsFor(store.read().entries[0]).kcal,100);assert.equal(store.read().foods[0].nutrients.kcal,100);
  assert.throws(()=>store.saveFood(food,{expectedUpdatedAt:food.updatedAt}),/cambiato/);
  assert.throws(()=>store.removeFood(food.id,{expectedUpdatedAt:food.updatedAt}),/cambiato/);
  store.removeFood(food.id,{expectedUpdatedAt:store.read().foods[0].updatedAt});assert.equal(store.read().entries.length,1);
});

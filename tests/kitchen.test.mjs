import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {KITCHEN_UNITS,normalizeIngredientName,ingredientKey,weekStart,weekDates,shiftKitchenDate,validKitchenFields,validPlan,createPlan,updatePlan,plannedRecipeItem,createPantryItem,shoppingList,shoppingCheckKey,mergeKitchenFields,suggestRecipes} from '../kitchen.mjs';

const now=new Date('2026-10-14T09:00:00Z');
const nutrients={kcal:300,protein:20,carbs:40,fat:10};
const recipeItem={type:'recipe',recipeId:'ricetta-a',name:'Zucca e ceci',unit:'porzione',nutrients,source:{label:'Ricetta di prova',url:''},ingredients:[{name:'Zucca',grams:200},{name:'Ceci cotti',grams:150},{name:'Olio EVO',grams:10}]};
const plan=(options={})=>createPlan(recipeItem,{date:'2026-10-14',meal:'lunch',servings:1,...options},now);
const pantry=(name,quantity,unit='g')=>createPantryItem({name,quantity,unit},now);
const check=(overrides={})=>({week:'2026-10-12',name:'Zucca',unit:'g',checked:true,quantity:200,updatedAt:now.toISOString(),...overrides});

test('optional fields preserve old diary backups; present fields are validated',()=>{
  assert.equal(validKitchenFields({}),true);
  assert.equal(validKitchenFields({pantry:[],plans:[],shoppingChecks:[]}),true);
  assert.equal(validKitchenFields({pantry:null}),false);
  assert.equal(validKitchenFields({plans:[plan()],pantry:[pantry('Zucca',null)],shoppingChecks:[check()]}),true);
  assert.equal(validKitchenFields({pantry:[pantry('Zucca',1),{...pantry('Ceci',1),unit:'kg'}]}),false);
  assert.equal(validKitchenFields({plans:[{...plan(),date:'2026-02-30'}]}),false);
  assert.equal(validKitchenFields({plans:[{...plan(),meal:'__proto__'}]}),false);
  assert.equal(validKitchenFields({plans:[{...plan(),servings:0}]}),false);
  assert.equal(validKitchenFields({shoppingChecks:[check({week:'2026-10-14'})]}),false);
  assert.equal(validKitchenFields({shoppingChecks:[check({quantity:NaN})]}),false);
});

test('kitchen arrays require unique record or normalized shopping keys',()=>{
  const stock=pantry('Zucca',100),meal=plan();
  assert.equal(validKitchenFields({pantry:[stock,{...stock,quantity:200}]}),false);
  assert.equal(validKitchenFields({plans:[meal,{...meal,date:'2026-10-15'}]}),false);
  assert.equal(validKitchenFields({shoppingChecks:[check(),check({name:'  ZÙCCA  ',checked:false})]}),false);
  assert.equal(validKitchenFields({shoppingChecks:[check(),check({unit:'pz'})]}),true);
});

test('calendar uses Monday weeks across year and daylight-saving boundaries',()=>{
  assert.equal(weekStart('2026-10-18'),'2026-10-12');
  assert.equal(weekStart('2027-01-01'),'2026-12-28');
  assert.deepEqual(weekDates('2026-10-25'),['2026-10-19','2026-10-20','2026-10-21','2026-10-22','2026-10-23','2026-10-24','2026-10-25']);
  assert.equal(shiftKitchenDate('2024-02-28',1),'2024-02-29');
  assert.throws(()=>weekStart('2026-02-30'),/Data non valida/);
});

test('shopping aggregates normalized ingredients for the selected week and serving counts',()=>{
  const meals=[plan({servings:2}),createPlan({...recipeItem,ingredients:[{name:'  ZÙCCA ',grams:100}]},{date:'2026-10-18',meal:'dinner',servings:.5},now),plan({date:'2026-10-19',servings:20})];
  const rows=shoppingList(meals,[],'2026-10-14');
  assert.equal(rows.find(row=>row.name==='Zucca').required,450);
  assert.equal(rows.find(row=>row.name==='Ceci cotti').required,300);
  assert.equal(rows.find(row=>row.name==='Olio EVO').required,20);
  assert.equal(rows.length,3);
  assert.equal(normalizeIngredientName(' CÈCI   cotti '),'ceci cotti');
  assert.equal(ingredientKey('Cèci  cotti','g'),ingredientKey('ceci cotti','g'));
  assert.notEqual(ingredientKey('Ceci cotti','g'),ingredientKey('Ceci secchi','g'));
});

test('pantry stock subtracts once after aggregation and never creates a negative purchase',()=>{
  const before=[plan(),plan({meal:'dinner'})],stock=[pantry('zucca',250),pantry('Zucca',100),pantry('Ceci cotti',1000),pantry('Olio EVO',4)];
  const untouched=JSON.stringify({before,stock});
  const rows=shoppingList(before,stock,'2026-10-12');
  assert.deepEqual(rows.find(row=>row.name==='Zucca'),{key:ingredientKey('Zucca','g'),name:'Zucca',unit:'g',required:400,available:350,used:350,toBuy:50,unquantified:false,otherUnits:[]});
  assert.equal(rows.find(row=>row.name==='Ceci cotti').toBuy,0);
  assert.equal(rows.find(row=>row.name==='Ceci cotti').used,300);
  assert.equal(rows.find(row=>row.name==='Olio EVO').toBuy,16);
  assert.equal(JSON.stringify({before,stock}),untouched);
});

test('grams, millilitres, pieces and unknown amounts remain distinct',()=>{
  const meal={...plan(),ingredients:[{name:'Latte',quantity:200,unit:'ml'},{name:'Latte',quantity:50,unit:'g'},{name:'Uova',quantity:2,unit:'pz'},{name:'Zucca',quantity:300,unit:'g'}]};
  const rows=shoppingList([meal],[pantry('Latte',100,'ml'),pantry('Latte',900,'pz'),pantry('Uova',1,'pz'),pantry('Zucca',2,'pz'),pantry('Zucca',null)],'2026-10-12');
  assert.equal(rows.find(row=>row.name==='Latte'&&row.unit==='ml').toBuy,100);
  assert.equal(rows.find(row=>row.name==='Latte'&&row.unit==='g').toBuy,50);
  assert.equal(rows.find(row=>row.name==='Uova').toBuy,1);
  const pumpkin=rows.find(row=>row.name==='Zucca');
  assert.equal(pumpkin.toBuy,300);
  assert.equal(pumpkin.unquantified,true);
  assert.deepEqual(pumpkin.otherUnits,['pz']);
  assert.deepEqual(KITCHEN_UNITS,['g','ml','pz']);
});

test('snapshots are detached from recipes; planning and editing do not record eaten food',()=>{
  const source=structuredClone(recipeItem),meal=createPlan(source,{date:'2026-10-14',meal:'lunch',servings:2},now),original=JSON.stringify(meal);
  source.ingredients[0].grams=999;source.nutrients.kcal=999;source.source.label='Changed';
  assert.equal(meal.ingredients[0].quantity,200);
  assert.equal(meal.nutrients.kcal,300);
  assert.equal(meal.source.label,'Ricetta di prova');
  const edited=updatePlan(meal,{date:'2026-10-16',meal:'dinner',servings:3},now);
  assert.equal(JSON.stringify(meal),original);
  assert.equal(edited.ingredients[0].quantity,200);
  assert.equal(edited.servings,3);
  assert.equal(edited.nutrients.kcal,300);
  assert.ok(edited.updatedAt>meal.updatedAt);
  const diary={entries:[],foods:[],plans:[meal]};
  const item=plannedRecipeItem(edited);
  assert.equal(diary.entries.length,0);
  assert.equal(Object.hasOwn(item,'date'),false);
  assert.equal(Object.hasOwn(item,'quantity'),false);
  assert.deepEqual(item.ingredients,[{name:'Zucca',grams:200},{name:'Ceci cotti',grams:150},{name:'Olio EVO',grams:10}]);
  assert.equal(item.nutrients.kcal,300);
  item.nutrients.kcal=100;item.ingredients[0].grams=5;
  assert.equal(edited.nutrients.kcal,300);assert.equal(edited.ingredients[0].quantity,200);
  assert.equal(validPlan(edited),true);
});

test('non-gram snapshots can be planned without inventing diary ingredient conversions',()=>{
  const meal={...plan(),ingredients:[{name:'Latte',quantity:200,unit:'ml'}]};
  assert.equal(validPlan(meal),true);
  const item=plannedRecipeItem(meal);
  assert.equal(Object.hasOwn(item,'ingredients'),false);
  assert.equal(item.nutrients.kcal,300);
});

test('backup merge preserves local plan, pantry stock and unchecked boxes; imports unique rows',()=>{
  const stock=pantry('Zucca',50),meal=plan(),localCheck=check({checked:false});
  const current={pantry:[stock],plans:[meal],shoppingChecks:[localCheck],entries:[{untouched:true}]};
  const importedStock=pantry('Ceci cotti',100),importedMeal=plan({date:'2026-10-15'}),nextWeek=check({week:'2026-10-19'});
  const incoming={pantry:[{...stock,quantity:900},importedStock],plans:[{...meal,servings:50},importedMeal],shoppingChecks:[{...localCheck,checked:true},nextWeek]};
  const frozen=JSON.stringify({current,incoming}),merged=mergeKitchenFields(current,incoming);
  assert.equal(merged.pantry.length,2);assert.equal(merged.plans.length,2);assert.equal(merged.shoppingChecks.length,2);
  assert.equal(merged.pantry[0].quantity,50);assert.equal(merged.plans[0].servings,1);assert.equal(merged.shoppingChecks[0].checked,false);
  assert.equal(JSON.stringify({current,incoming}),frozen);
  assert.deepEqual(mergeKitchenFields({},{}),{pantry:[],plans:[],shoppingChecks:[]});
  assert.deepEqual(Object.keys(merged),['pantry','plans','shoppingChecks']);
  assert.equal(shoppingCheckKey(localCheck),shoppingCheckKey({...localCheck,name:' ZÙCCA '}));
});

test('suggestions rank sufficient exact matches above partial and unquantified recipes',()=>{
  const recipe=(id,title,ingredients)=>({id,title,ingredients:ingredients.map(([name,grams])=>({name,grams}))});
  const recipes=[recipe('partial','Una dose parziale',[['Zucca',400]]),recipe('unknown','Due ingredienti, quantità ignota',[['Latte',100],['Ceci cotti',100]]),recipe('complete','Una dose sufficiente',[['Zucca',100]]),recipe('wrong','Alimento diverso',[['Ceci secchi',100]]),recipe('tofu','Tofu e zucca',[['Tofu',100],['Zucca',100]]),recipe('soy','Salsa di soia e zucca',[['Salsa di soia',5],['Zucca',100]])];
  const stock=[pantry('ZÙCCA',200),pantry('Latte',null,'ml'),pantry('Ceci cotti',100),pantry('Salsa di soia',10),pantry('Tofu',500)];
  const suggestions=suggestRecipes(recipes,stock,10);
  assert.deepEqual(suggestions.slice(0,2).map(result=>result.recipe.id).sort(),['complete','soy']);
  const partial=suggestions.find(result=>result.recipe.id==='partial'),unknown=suggestions.find(result=>result.recipe.id==='unknown');
  assert.equal(partial.partialCount,1);assert.equal(partial.complete,false);assert.equal(partial.coverage,.5);
  assert.equal(unknown.sufficientCount,1);assert.equal(unknown.unquantifiedCount,1);assert.equal(unknown.complete,false);
  assert.equal(suggestions.some(result=>result.recipe.id==='wrong'),false);
  assert.equal(suggestions.some(result=>result.recipe.id==='tofu'),false);
  assert.deepEqual(suggestRecipes(recipes,[]),[]);
});

test('real recipe catalog produces bounded, tofu-free suggestions using ingredient snapshots',()=>{
  const data=JSON.parse(fs.readFileSync(new URL('../recipes.json',import.meta.url),'utf8')),recipe=data.recipes[0];
  const stock=recipe.ingredients.map(ingredient=>pantry(ingredient.name,ingredient.grams));
  const suggestions=suggestRecipes(data.recipes,stock,6);
  assert.ok(suggestions.length>0&&suggestions.length<=6);
  assert.ok(suggestions.find(result=>result.recipe.id===recipe.id)?.complete);
  assert.ok(suggestions.every(result=>!result.recipe.ingredients.some(ingredient=>/\btofu\b/i.test(ingredient.name))));
});

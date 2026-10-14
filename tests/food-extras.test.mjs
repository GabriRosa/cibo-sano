import test from 'node:test';
import assert from 'node:assert/strict';
import {validPortions,portionQuantity} from '../portions.mjs';
import {parseNutritionLabel,createLabelOCR,OCR_ASSETS} from '../label-ocr.mjs';
import {makeFood,foodItem,createEntry,nutrientsFor,DiaryStore} from '../diary.mjs';

const label=`Valori nutrizionali medi per 100 g
Energia 1600 kJ / 382 kcal
Grassi 12,5 g
di cui acidi grassi saturi 2,1 g
Carboidrati 48,3 g
di cui zuccheri 9,0 g
Fibre 8,2 g
Proteine 14,7 g
Sale 0,25 g`;

test('Italian label parses decimal comma totals and ignores sugars/saturated fat',()=>{
  const parsed=parseNutritionLabel(label);
  assert.equal(parsed.unit,'g');
  assert.deepEqual(parsed.nutrients,{kcal:382,protein:14.7,carbs:48.3,fat:12.5});
  assert.deepEqual(parsed.missing,[]);
  assert(!parsed.evidence.fat.includes('saturi'));
});

test('millilitre labels and split energy lines remain in their declared unit',()=>{
  const parsed=parseNutritionLabel(`Per 100 ml\nEnergia 168 kJ\n40 kcal\nGrassi 1.2 g\nCarboidrati 4.5 g\nProteine 2.8 g`);
  assert.equal(parsed.unit,'ml');
  assert.deepEqual(parsed.nutrients,{kcal:40,protein:2.8,carbs:4.5,fat:1.2});
});

test('kJ never becomes kcal and incomplete rows stay unknown',()=>{
  const parsed=parseNutritionLabel(`Per 100 g\nEnergia 1600 kJ\nGrassi 10 g\nCarboidrati —\nProteine 0 g`);
  assert.equal(parsed.nutrients.kcal,null);
  assert.equal(parsed.nutrients.carbs,null);
  assert.equal(parsed.nutrients.protein,0);
  assert.deepEqual(parsed.missing,['kcal','carbs']);
});

test('OCR cannot propose more than 100 grams of a macro per 100 g and never guesses a missing separator',()=>{
  const parsed=parseNutritionLabel(`Per 100 g\nEnergia 44 kcal\nGrassi 159\nCarboidrati 409\nProteine 359`);
  assert.deepEqual(parsed.nutrients,{kcal:44,protein:null,carbs:null,fat:null});
  assert.deepEqual(parsed.missing,['protein','carbs','fat']);
  assert.equal(parseNutritionLabel('Per 100 g\nCarboidrati 100 g').nutrients.carbs,100);
  assert.equal(parseNutritionLabel('Per 100 ml\nCarboidrati 116 g').nutrients.carbs,116);
});

test('two columns select per-100 values with either labelled column order',()=>{
  const first=parseNutritionLabel(`Per 100 g | Per porzione (30 g)\nEnergia 1600 kJ 382 kcal 480 kJ 115 kcal\nGrassi 12,5 g 3,75 g\nCarboidrati 48,3 g 14,49 g\nProteine 14,7 g 4,41 g`);
  assert.deepEqual(first.nutrients,{kcal:382,protein:14.7,carbs:48.3,fat:12.5});
  const second=parseNutritionLabel(`Per porzione (30 g) | Per 100 g\nEnergia 480 kJ 115 kcal 1600 kJ 382 kcal\nGrassi 3,75 g 12,5 g\nCarboidrati 14,49 g 48,3 g\nProteine 4,41 g 14,7 g`);
  assert.deepEqual(second.nutrients,first.nutrients);
});

test('energy kJ/kcal column pairs do not use kJ as kcal',()=>{
  const parsed=parseNutritionLabel(`Per 100 g | Per porzione (30 g)\nEnergia (kJ/kcal) 1600/382 480/115\nGrassi 12,5 3,75\nCarboidrati 48,3 14,49\nProteine 14,7 4,41`);
  assert.equal(parsed.nutrients.kcal,382);
});

test('unlabelled duplicate columns, uncertain comparators and conflicting totals remain blank',()=>{
  const duplicate=parseNutritionLabel(`Per 100 g\nEnergia 382 kcal 115 kcal\nGrassi 12,5 g 3,75 g\nCarboidrati <0,5 g\nProteine 14,7 g\nProteine 12,1 g`);
  assert.deepEqual(duplicate.nutrients,{kcal:null,protein:null,carbs:null,fat:null});
  const portionOnly=parseNutritionLabel(`Per porzione (30 g)\nEnergia 115 kcal\nGrassi 3,75 g\nCarboidrati 14,49 g\nProteine 4,41 g`);
  assert.equal(portionOnly.unit,null);
  assert(Object.values(portionOnly.nutrients).every(value=>value===null));
  const mixed=parseNutritionLabel(`Per 100 g / 100 ml\nGrassi 2 g`);
  assert.equal(mixed.unit,null);
  assert.equal(mixed.nutrients.fat,null);
});

test('inline sugar and saturated subrows never replace totals; percentages are not quantities',()=>{
  const parsed=parseNutritionLabel(`Per 100 g\nEnergia 200 kcal 10%\nGrassi 6 g di cui saturi 2 g\nCarboidrati 20 g di cui zuccheri 4 g\nProteine 8 g 16%`);
  assert.deepEqual(parsed.nutrients,{kcal:200,protein:8,carbs:20,fat:6});
  const subrows=parseNutritionLabel(`Per 100 g\ndi cui acidi grassi saturi 2 g\ndi cui zuccheri 4 g\nProteine 8 g`);
  assert.equal(subrows.nutrients.fat,null);assert.equal(subrows.nutrients.carbs,null);
});

test('portions are optional, bounded, distinct, and cannot carry a conflicting unit',()=>{
  assert(validPortions(undefined));assert(validPortions([]));
  assert(validPortions([{name:'Vasetto',quantity:125},{name:'Mezzo vasetto',quantity:62.5}]));
  for(const portions of [null,{},[{name:'',quantity:1}],[{name:'x',quantity:0}],[{name:'x',quantity:10001}],[{name:'x',quantity:NaN}],[{name:'x',quantity:Infinity}],[{name:'x',quantity:'100'}],[{name:'x',quantity:10,unit:'ml'}],[{name:'a'.repeat(61),quantity:1}],[{name:'Vasetto',quantity:125},{name:' vasetto ',quantity:62.5}],Array.from({length:21},(_,index)=>({name:String(index),quantity:1}))]) assert.equal(validPortions(portions),false);
});

test('fractional counts produce the real g/ml quantity and dynamic nutrients',()=>{
  const portion={name:'Vasetto',quantity:125};
  assert.equal(portionQuantity(portion,'2'),250);
  assert.equal(portionQuantity(portion,'0,5'),62.5);
  for(const count of ['','0','-1','1e3','2 g','Infinity','81'])assert.equal(portionQuantity(portion,count),null);
  const food=makeFood({name:'Yogurt',unit:'g',portions:[portion],nutrients:{kcal:60,protein:4,carbs:5,fat:2}});
  const entry=createEntry(foodItem(food),{quantity:portionQuantity(portion,'2'),date:'2026-10-14',meal:'breakfast'});
  assert.equal(entry.unit,'g');assert.deepEqual(nutrientsFor(entry),{kcal:150,protein:10,carbs:12.5,fat:5});
});

test('saved portion edits only affect future entries, and saveFood needs no diary entry',()=>{
  const values=new Map(),store=new DiaryStore({getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)});
  const original=makeFood({name:'Latte',unit:'ml',portions:[{name:'Bicchiere',quantity:200}],nutrients:{kcal:40,protein:3,carbs:5,fat:1}});
  store.saveFood(original,{expectedUpdatedAt:null});
  assert.equal(store.read().entries.length,0);
  const saved=store.read().foods[0];
  const entry=createEntry(foodItem(saved),{quantity:portionQuantity(saved.portions[0],1),date:'2026-10-14',meal:'breakfast'});store.add(entry);
  store.saveFood({...saved,portions:[{name:'Bicchiere',quantity:250}],nutrients:{...saved.nutrients,kcal:50}},{expectedUpdatedAt:saved.updatedAt});
  assert.equal(store.read().entries[0].quantity,200);assert.equal(store.read().entries[0].nutrients.kcal,40);
  assert.equal(store.read().foods[0].portions[0].quantity,250);
});

test('OCR loads only pinned same-app asset paths and disposes its worker after recognition',async()=>{
  const file=new Blob(['local image'],{type:'image/png'});let options,terminated=0;
  const reader=createLabelOCR({engineLoader:async()=>({createWorker:async(language,oem,configuration)=>{
    assert.equal(language,'ita');assert.equal(oem,1);options=configuration;
    return {setParameters:async()=>{},recognize:async image=>{assert.equal(image,file);return {data:{text:label,confidence:96}};},terminate:async()=>{terminated++;}};
  }})});
  const result=await reader.recognize(file);
  assert.equal(result.candidates.nutrients.kcal,382);assert.equal(terminated,1);
  assert.equal(options.workerPath,OCR_ASSETS.worker);assert.equal(options.langPath,OCR_ASSETS.language);assert.equal(options.corePath,OCR_ASSETS.core);
  assert.equal(options.workerBlobURL,false);assert.equal(options.gzip,false);assert.equal(options.cacheMethod,'none');
  assert(Object.values(OCR_ASSETS).every(path=>path.includes('/vendor/tesseract/')));
});

test('cancelling OCR during initialization prevents recognition and terminates the eventual worker',async()=>{
  let resolveWorker,started,terminated=0,recognized=0;
  const ready=new Promise(resolve=>{started=resolve;});
  const reader=createLabelOCR({engineLoader:async()=>({createWorker:()=>{started();return new Promise(resolve=>{resolveWorker=resolve;});}})});
  const operation=reader.recognize(new Blob(['image'],{type:'image/jpeg'}));await ready;
  reader.cancel();await assert.rejects(operation,error=>error.name==='AbortError');
  resolveWorker({setParameters:async()=>{},recognize:async()=>{recognized++;return {data:{text:label}};},terminate:async()=>{terminated++;}});
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(recognized,0);assert.equal(terminated,1);
});

test('OCR rejects unsupported/oversized files before creating a worker',async()=>{
  let loaded=0;
  const reader=createLabelOCR({engineLoader:async()=>{loaded++;}});
  await assert.rejects(reader.recognize(new Blob(['x'],{type:'image/heic'})),/JPEG/);
  await assert.rejects(reader.recognize({type:'image/png',size:15000001}),/15 MB/);
  assert.equal(loaded,0);
});

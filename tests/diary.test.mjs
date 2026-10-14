import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DiaryStore,DIARY_KEY,emptyDiary,createEntry,foodItem,recipeItem,catalogFoods,makeFood,nutrientsFor,sumEntries,decimal,validDate,shiftDate,localDate,parseBackup,mergeDiary} from '../diary.mjs';
import {normalizeBarcode,parseProduct,lookupBarcode} from '../foods.mjs';
const data=JSON.parse(readFileSync(new URL('../recipes.json',import.meta.url)));
const nutrition={kcal:100,protein:8,carbs:12,fat:2};
const food=()=>makeFood({name:'Alimento prova',unit:'g',nutrients:nutrition});
const entry=(item=foodItem(food()),quantity=150)=>createEntry(item,{date:'2026-10-14',meal:'lunch',quantity});
function storage(){const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),values};}

test('food gram and millilitre quantities scale all nutrition without premature rounding',()=>{
  const a=entry(),b=entry({...foodItem(food()),unit:'ml'},37.5);
  assert.deepEqual(nutrientsFor(a),{kcal:150,protein:12,carbs:18,fat:3});
  assert.deepEqual(sumEntries([a,b]),{kcal:187.5,protein:15,carbs:22.5,fat:3.75});
  for(const invalid of ['',-1,'1e3','NaN','Infinity','12g'])assert.equal(decimal(invalid),null);
  assert.equal(decimal('12,5'),12.5);
});
test('recipe snapshot divides current batch once and stays immutable after recipe edits',()=>{
  const recipe=structuredClone(data.recipes[0]),foods=structuredClone(data.foods);
  const q=recipe.ingredients.map(i=>i.grams*2),item=recipeItem(recipe,foods,q,2);
  const single=recipeItem(recipe,foods),saved=entry(item,0.5);
  assert.deepEqual(item.nutrients,single.nutrients);
  const before=structuredClone(saved);
  recipe.title='changed';recipe.ingredients[0].grams=999;foods[recipe.ingredients[0].name].kcal=999;
  assert.deepEqual(saved,before);
  assert.equal(nutrientsFor(saved).kcal,single.nutrients.kcal/2);
  assert.equal(saved.ingredients[0].grams,q[0]/2);
});
test('all existing recipes and ingredient foods can be logged with complete nutrition',()=>{
  assert.equal(data.recipes.length,195);
  for(const r of data.recipes)assert.doesNotThrow(()=>entry(recipeItem(r,data.foods),1));
  const catalog=catalogFoods(data.foods);
  assert.equal(catalog.length,Object.keys(data.foods).length);
  for(const f of catalog)assert.doesNotThrow(()=>entry(foodItem(f),100));
});
test('local dates handle leap years and DST calendar boundaries',()=>{
  assert(validDate('2024-02-29'));assert(!validDate('2026-02-29'));assert(!validDate('2026-04-31'));
  assert.equal(shiftDate('2026-03-29',1),'2026-03-30');assert.equal(shiftDate('2026-10-25',-1),'2026-10-24');
  assert.equal(localDate(new Date(2026,0,1,0,1)),'2026-01-01');
});
test('store reloads latest state, persists edits, restores backups and preserves snapshots',()=>{
  const backing=storage(),a=new DiaryStore(backing),b=new DiaryStore(backing),one=entry(),two=entry();
  a.add(one);b.add(two);assert.equal(a.read().entries.length,2);
  a.edit(one.id,{quantity:50,meal:'dinner'});assert.equal(b.read().entries[0].quantity,50);
  assert.deepEqual(b.read().entries[0].nutrients,nutrition);
  a.setGoal(2000);const backup=a.export(),target=new DiaryStore(storage());
  assert.equal(target.import(backup),2);assert.equal(target.import(backup),0);assert.equal(target.read().goal,2000);
  target.remove(two.id);assert.equal(target.read().entries.length,1);
});
test('invalid or unsupported imports leave saved data unchanged',()=>{
  const backing=storage(),store=new DiaryStore(backing);store.add(entry());const raw=backing.getItem(DIARY_KEY);
  for(const mutate of [d=>d.entries[0].quantity=-1,d=>d.entries[0].nutrients.protein=null,d=>d.entries[0].date='2026-02-30',d=>d.entries[0].source.url='javascript:alert(1)',d=>d.schemaVersion=2,d=>d.entries.push(d.entries[0])]){
    const backup=JSON.parse(store.export());mutate(backup.data);assert.throws(()=>store.import(JSON.stringify(backup)));assert.equal(backing.getItem(DIARY_KEY),raw);
  }
  assert.throws(()=>parseBackup('{bad'));
});
test('corrupt storage and write failures never overwrite or report success',()=>{
  const backing=storage();backing.setItem(DIARY_KEY,'broken');const store=new DiaryStore(backing);
  assert.throws(()=>store.add(entry()),/non è leggibile/);assert.equal(backing.getItem(DIARY_KEY),'broken');
  const failed=new DiaryStore({getItem:()=>null,setItem:()=>{throw new Error('quota');}});
  assert.throws(()=>failed.add(entry()),/Salvataggio non riuscito/);
});
test('merge keeps local versions of existing IDs and adds distinct entries',()=>{
  const existing=entry(),local={...emptyDiary(),entries:[existing],goal:1900};
  const incoming={...emptyDiary(),entries:[{...existing,quantity:999},entry()],goal:2100};
  const merged=mergeDiary(local,incoming);
  assert.equal(merged.added,1);assert.equal(merged.data.entries[0].quantity,150);assert.equal(merged.data.goal,1900);
});
test('EAN/UPC accepts valid check digits, rejects malformed input and keeps leading zeros',()=>{
  assert.equal(normalizeBarcode('3017620422003'),'3017620422003');assert.equal(normalizeBarcode('0 12345 67890 5'),'012345678905');
  assert.equal(normalizeBarcode('3017620422004'),null);assert.equal(normalizeBarcode('123'),null);assert.equal(normalizeBarcode('javascript:1'),null);
});
test('product import keeps unknown nutrients unknown and requires explicit g/ml selection',()=>{
  const parsed=parseProduct({status:1,product:{product_name:'Bevanda',quantity:'1 L',nutriments:{'energy-kcal_100g':40,proteins_100g:0,fat_100g:1}}},'3017620422003');
  assert.equal(parsed.unit,null);assert.equal(parsed.nutrients.protein,0);assert.equal(parsed.nutrients.carbs,null);assert.deepEqual(parsed.missing,['carbs']);
  assert.throws(()=>makeFood({...parsed,origin:'off'}));
  assert.equal(parseProduct({status:0},'3017620422003'),null);
});
test('barcode lookup handles not found, rate limit, cancellation and excludes credentials',async()=>{
  let request;
  const result=await lookupBarcode('3017620422003',{fetcher:async(url,options)=>{request={url,options};return {ok:false,status:404};}});
  assert.equal(result,null);assert.equal(request.options.credentials,'omit');assert.equal(request.options.referrerPolicy,'no-referrer');assert(request.url.startsWith('https://world.openfoodfacts.org/api/'));
  await assert.rejects(lookupBarcode('3017620422003',{fetcher:async()=>({status:429,ok:false})}),/troppe richieste/);
  await assert.rejects(lookupBarcode('3017620422003',{fetcher:async()=>{throw new DOMException('Aborted','AbortError');}}),/interrotta/);
});

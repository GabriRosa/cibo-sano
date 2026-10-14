import test from 'node:test';
import assert from 'node:assert/strict';
import {parseWaterAmount, validWaterDate, validWaterEntry, validWaterFields, createWaterEntry, mergeWaterFields, waterDaySummary, waterRangeSummary, MAX_WATER_ENTRIES} from '../water.mjs';
import {DiaryStore, DIARY_KEY, emptyDiary, validDiary, createEntry, makeFood, foodItem, sumEntries, parseBackup, mergeDiary} from '../diary.mjs';
import {weeklySummary} from '../targets.mjs';

const stamp = '2026-10-14T10:00:00.000Z';
const row = (id, date, ml) => ({id, date, ml, createdAt: stamp, updatedAt: stamp});
const memory = () => {
  const values = new Map();
  return {getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value)};
};

test('water quantities convert litres and Italian decimal commas to integer millilitres', () => {
  for (const [value, unit, ml] of [[250,'ml',250],['500','ml',500],['0,25','L',250],['1.5','L',1500],['0,001','L',1],['10','L',10000],['.3','L',300]]) {
    assert.equal(parseWaterAmount(value, unit), ml);
  }
  for (const [value, unit] of [['','ml'],['0','ml'],['-250','ml'],['250,5','ml'],['0,0005','L'],['10.001','L'],['10001','ml'],['1e3','ml'],['250 ml','ml'],['Infinity','L'],[NaN,'ml'],[null,'ml'],[true,'ml'],['1','g']]) {
    assert.equal(parseWaterAmount(value, unit), null, `${value} ${unit}`);
  }
});

test('water schema remains optional and rejects malformed amounts, dates, timestamps and duplicate IDs', () => {
  const valid = row('water-a', '2026-10-14', 250);
  assert(validWaterFields(emptyDiary())); assert(validWaterEntry(valid));
  assert(validWaterFields({waterEntries: []}));
  for (const patch of [{id:''},{date:'2026-02-30'},{date:'1899-12-31'},{ml:0},{ml:10001},{ml:1.5},{ml:NaN},{ml:'250'},{createdAt:'bad'},{updatedAt:null}]) {
    assert.equal(validWaterEntry({...valid, ...patch}), false);
  }
  for (const value of [null, {}, 'water', Array(1), [valid,valid], Array.from({length: MAX_WATER_ENTRIES + 1}, (_, i) => ({...valid,id:String(i)}))]) {
    assert.equal(validWaterFields({waterEntries:value}), false);
  }
  assert.equal(validWaterFields(null),false);
  assert(validWaterDate('2024-02-29')); assert.equal(validWaterDate('2025-02-29'),false);
});

test('water creation preserves the given day and stores detached records with timestamps', () => {
  const args = {date:'2026-10-13',ml:500};
  const entry = createWaterEntry(args,new Date(stamp));
  args.ml = 100;
  assert(validWaterEntry(entry)); assert.equal(entry.ml,500);
  assert.equal(entry.date,'2026-10-13'); assert.equal(entry.createdAt,stamp); assert.equal(entry.updatedAt,stamp);
  assert.notEqual(createWaterEntry({date:'2026-10-13',ml:500}).id,entry.id);
  assert.throws(()=>createWaterEntry({date:'2026-10-14',ml:0}),/quantità/);
});

test('water totals distinguish missing days and average only days with registrations', () => {
  const data = {...emptyDiary(),waterEntries:[row('a','2026-10-13',750),row('b','2026-10-14',250),row('c','2026-10-14',500),row('d','2026-10-14',333),row('outside','2026-10-19',1000)]};
  const before=structuredClone(data), summary=waterRangeSummary(data,'2026-10-12','2026-10-18');
  assert.deepEqual(waterDaySummary(data,'2026-10-14'),{date:'2026-10-14',recorded:true,entryCount:3,totalMl:1083});
  assert.deepEqual(waterDaySummary(data,'2026-10-12'),{date:'2026-10-12',recorded:false,entryCount:0,totalMl:0});
  assert.equal(summary.totalMl,1833); assert.equal(summary.entryCount,4);
  assert.equal(summary.recordedDays,2); assert.equal(summary.missingDays,5); assert.equal(summary.averageMl,916.5);
  assert.deepEqual(data,before);
  const empty=waterRangeSummary(emptyDiary(),'2026-10-12','2026-10-18');
  assert.equal(empty.averageMl,null);assert.equal(empty.totalMl,0);assert.equal(empty.recordedDays,0);
});

test('water date ranges are inclusive across month, leap-day and daylight-saving boundaries', () => {
  for(const [start,end,expected] of [['2024-02-28','2024-03-01',['2024-02-28','2024-02-29','2024-03-01']],['2026-10-24','2026-10-26',['2026-10-24','2026-10-25','2026-10-26']]]){
    assert.deepEqual(waterRangeSummary({},start,end).days.map(day=>day.date),expected);
  }
  assert.throws(()=>waterRangeSummary({},'2026-10-14','2026-10-13'),/Intervallo/);
  assert.throws(()=>waterRangeSummary({},'2026-02-30','2026-03-01'),/Intervallo/);
  assert.throws(()=>waterRangeSummary({waterEntries:[{}]},'2026-10-13','2026-10-14'),/Registrazioni/);
});

test('water merge preserves local IDs, adds new entries and preserves absence in old backups', () => {
  const local=row('same','2026-10-14',250), other=row('new','2026-10-14',500);
  assert.deepEqual(mergeWaterFields({},{}),{});
  assert.deepEqual(mergeWaterFields({waterEntries:[]},{}),{waterEntries:[]});
  const result=mergeWaterFields({waterEntries:[local]},{waterEntries:[{...local,ml:1000},other]});
  assert.deepEqual(result.waterEntries,[local,other]);
  result.waterEntries[0].ml=999;assert.equal(local.ml,250);
});

test('water writes leave food, nutrition averages, complete days and weights unchanged', () => {
  const storage=memory(),store=new DiaryStore(storage);
  const food=makeFood({name:'Yogurt DEMO',unit:'g',nutrients:{kcal:60,protein:10,carbs:4,fat:0}});
  store.add(createEntry(foodItem(food),{date:'2026-10-14',meal:'breakfast',quantity:200}),food);
  store.update(data=>({...data,completeDays:['2026-10-14'],weights:[{date:'2026-10-14',kg:72,updatedAt:stamp}]}));
  const before=store.read(),nutrition=weeklySummary(before,'2026-10-14');
  store.addWater(row('water','2026-10-14',500));
  const after=store.read();assert(validDiary(after));
  assert.deepEqual(after.entries,before.entries);assert.deepEqual(after.foods,before.foods);assert.deepEqual(after.weights,before.weights);
  assert.deepEqual(after.completeDays,before.completeDays);assert.deepEqual(weeklySummary(after,'2026-10-14'),nutrition);
  assert.deepEqual(sumEntries(after.entries),{kcal:120,protein:20,carbs:8,fat:0});
});

test('stale water edits and removals cannot overwrite another tab; timestamps advance', () => {
  const storage=memory(),first=new DiaryStore(storage),second=new DiaryStore(storage);
  first.addWater(row('water','2026-10-14',250));const old=second.read().waterEntries[0];
  first.editWater(old.id,{ml:500},{expectedUpdatedAt:old.updatedAt});
  const saved=first.read().waterEntries[0];assert.equal(saved.ml,500);assert(Date.parse(saved.updatedAt)>Date.parse(old.updatedAt));
  const current=storage.getItem(DIARY_KEY);
  assert.throws(()=>second.editWater(old.id,{ml:1000},{expectedUpdatedAt:old.updatedAt}),/cambiata/);
  assert.throws(()=>second.removeWater(old.id,{expectedUpdatedAt:old.updatedAt}),/cambiata/);
  assert.equal(storage.getItem(DIARY_KEY),current);
  first.editWater(old.id,{date:'2026-10-13',ml:750,id:'different',createdAt:'bad'},{expectedUpdatedAt:saved.updatedAt});
  const moved=first.read().waterEntries[0];assert.equal(moved.id,'water');assert.equal(moved.createdAt,stamp);assert.equal(moved.date,'2026-10-13');
  for(const ml of [0,null,10001,2.5])assert.throws(()=>first.editWater(old.id,{ml}),/quantità/);
});

test('water removal and undo preserve records and refuse conflicting or missing IDs', () => {
  const store=new DiaryStore(memory()),entry=row('water','2026-10-14',500);
  store.addWater(entry);store.removeWater(entry.id,{expectedUpdatedAt:entry.updatedAt});
  assert.equal(waterDaySummary(store.read(),entry.date).recorded,false);
  store.restoreWater(entry);assert.deepEqual(store.read().waterEntries,[entry]);
  assert.throws(()=>store.restoreWater({...entry,ml:200}),/già presente/);
  assert.throws(()=>store.addWater(entry),/Dati non validi/);
  store.removeWater(entry.id);assert.throws(()=>store.editWater(entry.id,{ml:100}),/rimossa/);
  assert.throws(()=>store.removeWater(entry.id),/rimossa/);
});

test('full backups restore and merge water without breaking old diary backups', () => {
  const original=new DiaryStore(memory());original.addWater(row('a','2026-10-14',250));original.addWater(row('b','2026-10-15',500));
  const raw=original.export(),restored=new DiaryStore(memory());assert.equal(restored.import(raw),2);
  assert.deepEqual(restored.read().waterEntries,original.read().waterEntries);assert.equal(restored.import(raw),0);
  restored.editWater('a',{ml:750});restored.import(raw);assert.equal(restored.read().waterEntries.find(e=>e.id==='a').ml,750);
  const legacy=JSON.stringify({format:'cibo-sano-diary-v1',data:emptyDiary()});
  assert(validDiary(parseBackup(legacy)));restored.import(legacy);assert.equal(restored.read().waterEntries.length,2);
  assert.equal(Object.hasOwn(mergeDiary(emptyDiary(),emptyDiary()).data,'waterEntries'),false);
});

test('invalid water backups and storage failures never overwrite saved data', () => {
  const storage=memory(),store=new DiaryStore(storage);store.setGoal(1900);
  const before=storage.getItem(DIARY_KEY),backup=JSON.parse(store.export());
  for(const waterEntries of [null,{},[row('x','2026-10-14',0)],[row('x','2026-02-30',500)]]){
    assert.throws(()=>store.import(JSON.stringify({...backup,data:{...backup.data,waterEntries}})),/Backup/);
    assert.equal(storage.getItem(DIARY_KEY),before);
  }
  const failing=new DiaryStore({getItem:storage.getItem,setItem(){throw new Error('quota');}});
  assert.throws(()=>failing.addWater(row('x','2026-10-14',500)),/Salvataggio non riuscito/);
  assert.equal(storage.getItem(DIARY_KEY),before);
});

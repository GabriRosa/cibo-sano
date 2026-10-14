import test from 'node:test';
import assert from 'node:assert/strict';
import {DiaryStore,DIARY_KEY,emptyDiary,validDiary,mergeDiary,parseBackup,localDate,shiftDate} from '../diary.mjs';
function storage(){const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),values};}
const record=(date,kg=80)=>({date,kg,updatedAt:'2026-01-01T12:00:00.000Z'});

test('legacy diaries and JSON backups remain readable; adding weight preserves old data',()=>{
  const backing=storage(),legacy={schemaVersion:1,entries:[],foods:[],goal:1800};
  backing.setItem(DIARY_KEY,JSON.stringify(legacy));const store=new DiaryStore(backing);
  assert.deepEqual(store.read(),legacy);assert(validDiary(legacy));
  assert.deepEqual(parseBackup(JSON.stringify({format:'cibo-sano-diary-v1',data:legacy})),legacy);
  store.saveWeight('2026-01-01',80.25,{expectedUpdatedAt:null});
  assert.equal(store.read().goal,1800);assert.equal(store.read().weights[0].kg,80.25);
  assert.deepEqual(store.read().entries,legacy.entries);assert.deepEqual(store.read().foods,legacy.foods);
});
test('weight entries persist, replace only their date, and retain centesimal precision',()=>{
  const backing=storage(),store=new DiaryStore(backing);
  store.saveWeight('2026-01-01',80.125);store.saveWeight('2026-01-02',79.9);
  const previous=store.read().weights[0];store.saveWeight('2026-01-01',80.1,{expectedUpdatedAt:previous.updatedAt});
  const saved=new DiaryStore(backing).read().weights;
  assert.equal(saved.length,2);assert.equal(saved[0].kg,80.1);assert.equal(saved[1].kg,79.9);
  assert(Date.parse(saved[0].updatedAt)>Date.parse(previous.updatedAt));
  assert.throws(()=>store.saveWeight('2026-01-01',80,{expectedUpdatedAt:previous.updatedAt}),/cambiata/);
  assert.throws(()=>store.saveWeight('2026-01-01',80,{expectedUpdatedAt:null}),/cambiata/);
  assert.equal(store.read().weights[0].kg,80.1);
});
test('invalid, future or unreadable weight data never overwrite persisted content',()=>{
  const backing=storage(),store=new DiaryStore(backing);store.saveWeight('2026-01-01',80);
  const before=backing.getItem(DIARY_KEY);
  for(const kg of [0,0.9,501,-1,NaN,Infinity,'80'])assert.throws(()=>store.saveWeight('2026-01-01',kg));
  for(const date of ['2026-02-30','2026-1-1',shiftDate(localDate(),1)])assert.throws(()=>store.saveWeight(date,80));
  assert.equal(backing.getItem(DIARY_KEY),before);
  for(const weights of [null,{},[record('2026-01-01',0)],[record('2026-01-01'),record('2026-01-01')],[{...record('2026-01-01'),updatedAt:'invalid'}]]){
    const bad={...emptyDiary(),weights};assert(!validDiary(bad));
    assert.throws(()=>store.import(JSON.stringify({format:'cibo-sano-diary-v1',data:bad})));
    assert.equal(backing.getItem(DIARY_KEY),before);
  }
  backing.setItem(DIARY_KEY,'broken');assert.throws(()=>store.saveWeight('2026-01-01',80),/non è leggibile/);
  assert.equal(backing.getItem(DIARY_KEY),'broken');
});
test('deletion and undo avoid clobbering another saved value',()=>{
  const store=new DiaryStore(storage());store.saveWeight('2026-01-01',80);
  const original=store.read().weights[0];store.saveWeight('2026-01-01',81);
  assert.throws(()=>store.removeWeight(original.date,{expectedUpdatedAt:original.updatedAt}),/cambiata/);
  const current=store.read().weights[0];store.removeWeight(current.date,{expectedUpdatedAt:current.updatedAt});
  assert.equal(store.read().weights.length,0);store.restoreWeight(current);
  assert.deepEqual(store.read().weights[0],current);
  assert.throws(()=>store.restoreWeight(original),/già una pesata/);assert.equal(store.read().weights[0].kg,81);
});
test('backup restores weight along with diary and merges dates without duplication or rollback',()=>{
  const store=new DiaryStore(storage());store.setGoal(1900);store.saveWeight('2026-01-01',80);store.saveWeight('2026-01-02',79.5);
  const backup=store.export(),restored=new DiaryStore(storage());
  assert.equal(restored.import(backup),2);assert.deepEqual(restored.read().weights,store.read().weights);
  restored.saveWeight('2026-01-01',81);assert.equal(restored.import(backup),0);assert.equal(restored.read().weights[0].kg,81);
  assert.equal(restored.read().goal,1900);
  const legacy={schemaVersion:1,entries:[],foods:[],goal:null};
  assert.equal(mergeDiary(restored.read(),legacy).data.weights.length,2);
});
test('weight save reports storage failure and reads other instance changes before writing',()=>{
  const backing=storage(),a=new DiaryStore(backing),b=new DiaryStore(backing);
  a.saveWeight('2026-01-01',80);b.saveWeight('2026-01-02',79);assert.equal(a.read().weights.length,2);
  const failed=new DiaryStore({getItem:()=>null,setItem:()=>{throw new Error('quota');}});
  assert.throws(()=>failed.saveWeight('2026-01-01',80),/Salvataggio non riuscito/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {DiaryStore,DIARY_KEY,createEntry,foodItem,makeFood} from '../diary.mjs';

function storage(){
  const values=new Map();
  return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
}
function entry(){
  const food=makeFood({name:'Yogurt',unit:'g',nutrients:{kcal:60,protein:4,carbs:6,fat:2}});
  return createEntry(foodItem(food),{date:'2026-10-14',meal:'breakfast',quantity:100},new Date('2026-10-14T10:00:00.000Z'));
}

test('a stale editor cannot revert another editor’s saved meal or other diary data',()=>{
  const backing=storage(),a=new DiaryStore(backing),b=new DiaryStore(backing),original=entry(),other=entry();
  a.add(original);a.add(other);a.setGoal(1800);
  const editorA=a.read().entries[0],editorB=b.read().entries[0];
  a.edit(editorA.id,{quantity:editorA.quantity,date:editorA.date,meal:'snack'},{expectedUpdatedAt:editorA.updatedAt});
  const saved=backing.getItem(DIARY_KEY);
  assert.throws(()=>b.edit(editorB.id,{quantity:150,date:editorB.date,meal:editorB.meal},{expectedUpdatedAt:editorB.updatedAt}),/Chiudi e riapri/);
  assert.equal(backing.getItem(DIARY_KEY),saved);
  const reloaded=b.read().entries[0];
  b.edit(reloaded.id,{quantity:150,date:reloaded.date,meal:reloaded.meal},{expectedUpdatedAt:reloaded.updatedAt});
  const current=a.read();
  assert.equal(current.entries[0].meal,'snack');assert.equal(current.entries[0].quantity,150);
  assert.deepEqual(current.entries[1],other);assert.equal(current.goal,1800);
});

test('stale removal preserves the current entry and undo restores the removed version',()=>{
  const backing=storage(),a=new DiaryStore(backing),b=new DiaryStore(backing),original=entry();
  a.add(original);const stale=a.read().entries[0];
  b.edit(original.id,{quantity:250},{expectedUpdatedAt:original.updatedAt});
  const saved=backing.getItem(DIARY_KEY);
  assert.throws(()=>a.remove(stale.id,{expectedUpdatedAt:stale.updatedAt}),/Chiudi e riapri/);
  assert.equal(backing.getItem(DIARY_KEY),saved);
  const removed=a.read().entries[0];
  a.remove(removed.id,{expectedUpdatedAt:removed.updatedAt});
  assert.equal(a.read().entries.length,0);
  const afterRemoval=backing.getItem(DIARY_KEY);
  assert.throws(()=>b.edit(removed.id,{quantity:300},{expectedUpdatedAt:removed.updatedAt}),/rimossa/);
  assert.throws(()=>b.remove(removed.id,{expectedUpdatedAt:removed.updatedAt}),/rimossa/);
  assert.equal(backing.getItem(DIARY_KEY),afterRemoval);
  a.add(removed);
  assert.deepEqual(a.read().entries,[removed]);
  assert.equal(a.read().entries[0].quantity,250);
});

test('edit timestamps advance even when writes share a millisecond or the clock moves back',t=>{
  const store=new DiaryStore(storage()),original=entry();
  store.add(original);
  t.mock.method(Date,'now',()=>Date.parse(original.updatedAt)-1000);
  store.edit(original.id,{quantity:150},{expectedUpdatedAt:original.updatedAt});
  const first=store.read().entries[0];
  assert.equal(Date.parse(first.updatedAt),Date.parse(original.updatedAt)+1);
  store.edit(first.id,{quantity:200},{expectedUpdatedAt:first.updatedAt});
  const second=store.read().entries[0];
  assert.equal(Date.parse(second.updatedAt),Date.parse(first.updatedAt)+1);
  assert.throws(()=>store.edit(first.id,{quantity:300},{expectedUpdatedAt:first.updatedAt}),/cambiata/);
});

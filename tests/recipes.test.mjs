import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {filterRecipes,scaledAmount,validData,sourceURL,parseFavorites} from '../lib.mjs';
const root=new URL('../',import.meta.url);
const data=JSON.parse(readFileSync(new URL('recipes.json',root),'utf8'));
test('all recipe cards are valid, uniquely identified, and source-linked',()=>{
  assert.equal(validData(data),true);
  assert(data.recipes.length>=125);
  for(let i=1;i<=45;i++)assert(data.recipes.some(r=>r.id===`idea-${String(i).padStart(2,'0')}`));
  assert(data.recipes.filter(r=>r.sourceType==='Video e testi dell’autore').length>=12);
  assert(data.recipes.every(r=>sourceURL(r.url)));
});
test('public export excludes private collection references and personal diet targets',()=>{
  const raw=JSON.stringify(data);
  for(const value of ['/saved/','peso_dichiarato','obiettivo_utente','/Users/'])assert(!raw.includes(value),value);
  assert(!/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(raw));
});
test('search supports multiple ingredients, accents and word prefixes without matching cipollotti as pollo',()=>{
  const result=filterRecipes(data.recipes,{query:'pollo limone'});
  assert(result.some(r=>r.id==='idea-01'));
  assert(!result.some(r=>r.id==='fonte-015'));
  assert(filterRecipes(data.recipes,{query:'ragu'}).some(r=>r.id==='fonte-002'));
  assert(filterRecipes(data.recipes,{query:'zucch'}).length>0);
});
test('category, portion and favorite filters compose; calorie sorting places unknown values last',()=>{
  const result=filterRecipes(data.recipes,{category:'Pesce',view:'favorites',favorites:new Set(['idea-02','idea-01'])});
  assert.deepEqual(result.map(r=>r.id),['idea-02']);
  assert.equal(filterRecipes(data.recipes,{view:'portions'}).length,data.recipes.filter(r=>r.kind==='porzione').length);
  const sorted=filterRecipes(data.recipes,{sort:'kcal'});
  assert.equal(sorted[0].kcal,Math.min(...data.recipes.filter(r=>r.kcal!==null).map(r=>r.kcal)));
  assert(sorted.every(r=>Number.isFinite(r.kcal)));
  assert.equal(sorted.at(-1).kcal,Math.max(...data.recipes.map(r=>r.kcal)));
});
test('only structured quantities are scaled and decimal grams remain readable',()=>{
  assert.equal(scaledAmount(160,2),'320 g');
  assert.equal(scaledAmount(2.5,1),'2,5 g');
  assert(data.recipes.every(r=>r.ingredients.length>0));
});
test('malformed data, script URLs and invalid favorites are rejected',()=>{
  assert.equal(validData({...data,recipes:[data.recipes[0],data.recipes[0]]}),false);
  assert.equal(validData({...data,recipes:[{...data.recipes[0],ingredients:[{name:'x',grams:-1}]}]}),false);
  assert.equal(sourceURL('javascript:alert(1)'),null);
  assert.equal(sourceURL('https://evil.example/'),null);
  assert.throws(()=>parseFavorites('{"favorites":[1]}'));
  assert.deepEqual([...parseFavorites('{"favorites":["idea-01","gone-01"]}',new Set(['idea-01']))],['idea-01']);
});
test('selected web recipes retain working source links without widening the URL allowlist',()=>{
  const selected=data.recipes.filter(r=>r.id.startsWith('scelta-fit-'));
  assert.deepEqual(selected.map(r=>r.id).sort(),['scelta-fit-02','scelta-fit-03','scelta-fit-04','scelta-fit-06']);
  for(const r of selected){
    assert.equal(sourceURL(r.url),r.url);
    assert.equal(r.quantityBasis,'adattamento');
    assert(r.steps.length>0);
  }
  assert.equal(sourceURL('https://www.bbcgoodfood.com.evil.example/recipes/test'),null);
  assert.equal(sourceURL('http://www.skinnytaste.com/recipe/'),null);
  for(const domain of ['www.cucinabotanica.com','www.diet-health.info']) {
    assert.equal(sourceURL(`https://${domain}/recipes/example`),`https://${domain}/recipes/example`);
    assert.equal(sourceURL(`https://${domain}.evil.example/recipes/example`),null);
    assert.equal(sourceURL(`http://${domain}/recipes/example`),null);
  }
});
test('install manifest and offline asset paths work below a GitHub Pages project path',()=>{
  const manifest=JSON.parse(readFileSync(new URL('manifest.webmanifest',root),'utf8'));
  assert.equal(manifest.start_url,'./');assert.equal(manifest.scope,'./');
  assert(manifest.icons.some(i=>i.sizes==='512x512'&&i.purpose==='maskable'));
  for(const icon of manifest.icons)assert(existsSync(new URL(icon.src,root)));
  const sw=readFileSync(new URL('sw.js',root),'utf8');
  const files=JSON.parse(sw.match(/const FILES = (\[[^\n]+\]);/)[1].replaceAll("'",'"'));
  for(const file of files)assert(existsSync(new URL(file,root)),file);
});

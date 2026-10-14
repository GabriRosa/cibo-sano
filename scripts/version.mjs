import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {nutritionFor} from '../lib.mjs';
const root=new URL('../',import.meta.url);
const recipeURL=new URL('recipes.json',root);
const data=JSON.parse(readFileSync(recipeURL,'utf8'));
for (const recipe of data.recipes) {
  const nutrition=nutritionFor(recipe,data.foods);
  if(nutrition)recipe.kcal=Math.round(nutrition.kcal);
}
const dataVersion=createHash('sha256').update(JSON.stringify({recipes:data.recipes,foods:data.foods,nutritionInfo:data.nutritionInfo,collectionNotes:data.collectionNotes})).digest('hex').slice(0,12);
if(dataVersion!==data.version){
  data.version=dataVersion;
  data.updatedAt=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome'}).format(new Date());
  writeFileSync(recipeURL,JSON.stringify(data,null,2)+'\n');
}
const files=['index.html','style.css','app.js','lib.mjs','diary.mjs','diary-ui.js','foods.mjs','scanner.js','diary.css','vendor/zxing-browser.min.js','reports.mjs','report-export.js','vendor/jspdf.umd.min.js','manifest.webmanifest','icons/icon.svg','icons/icon-192.png','icons/icon-512.png','icons/icon-maskable-512.png'];
const hash=createHash('sha256');
for(const file of files)hash.update(readFileSync(new URL(file,root)));
const sw=new URL('sw.js',root);
const source=readFileSync(sw,'utf8');
hash.update(source.replace(/const CACHE = '[^']+';/,"const CACHE = 'VERSION';"));
const version=hash.digest('hex').slice(0,12);
writeFileSync(sw,source.replace(/const CACHE = '[^']+';/,`const CACHE = 'cibo-sano-${version}';`));
console.log(`Cache offline: ${version}`);

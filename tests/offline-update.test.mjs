import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

test('a new offline version bypasses stale HTTP cache for every precached asset',async()=>{
  const listeners={}, requests=[];
  let installed, claimed=false;
  const scope='https://example.github.io/cibo-sano/';
  runInNewContext(readFileSync(new URL('../sw.js',import.meta.url),'utf8'),{
    URL, Request,
    self:{registration:{scope},addEventListener:(name,handler)=>listeners[name]=handler,skipWaiting:()=>{claimed=true;}},
    caches:{open:async()=>({addAll:async items=>requests.push(...items)})}
  });
  listeners.install({waitUntil:promise=>installed=promise});
  await installed;
  assert.equal(claimed,true);
  assert(requests.some(r=>r.url===scope+'app.js'));
  assert(requests.some(r=>r.url===scope+'recipes.json'));
  assert(requests.every(r=>r.cache==='reload'&&r.url.startsWith(scope)));
});

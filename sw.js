const CACHE = 'cibo-sano-e09f52e81471';
const FILES = ['./','./index.html','./style.css','./app.js','./lib.mjs','./recipes.json','./manifest.webmanifest','./icons/icon.svg','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable-512.png'];
const base = self.registration.scope;
const dataURL = new URL('recipes.json',base).href;
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES.map(path=>new Request(new URL(path,base).href,{cache:'reload'})))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('cibo-sano-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(base))return;
  if(url.href===dataURL){
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE);
      try {
        const response=await fetch(request,{cache:'no-store'});
        if(!response.ok)throw new Error('Fetch failed');
        const content=await response.clone().json();
        if(content?.schemaVersion!==1||!Array.isArray(content.recipes)||!content.recipes.length)throw new Error('Invalid data');
        await cache.put(dataURL,response.clone());
        return response;
      } catch(error) {
        const stored=await cache.match(dataURL);
        if(stored){
          const headers=new Headers(stored.headers);
          headers.set('X-Cibo-Sano-Cache','fallback');
          return new Response(stored.body,{status:stored.status,statusText:stored.statusText,headers});
        }
        throw error;
      }
    })());
    return;
  }
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    const stored=await cache.match(request);
    if(stored)return stored;
    if(request.mode==='navigate')return (await cache.match(new URL('index.html',base).href))||fetch(request);
    return fetch(request);
  })());
});

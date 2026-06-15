const CACHE='burnaverse-v3-core';
const RUNTIME='burnaverse-v3-runtime';
const CORE=[
  './','./index.html','./tokenomics.html','./impact.html','./roadmap.html','./faq.html','./contact.html','./community.html','./civic.html','./entertainment.html','./sports.html','./academics.html',
  './offline.html','./manifest.webmanifest','./assets/styles.css','./assets/advanced.css','./assets/app.js','./assets/ui.js','./assets/advanced.js','./assets/logo.png','./assets/logo_badge.png','./assets/favicon.svg','./assets/og.svg','./assets/whitepaper.pdf'
];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>![CACHE,RUNTIME].includes(k)).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
async function cacheFirst(req){
  const cached=await caches.match(req); if(cached) return cached;
  const res=await fetch(req); const copy=res.clone(); caches.open(RUNTIME).then(c=>c.put(req,copy)); return res;
}
async function networkFirst(req){
  try{
    const res=await fetch(req); const copy=res.clone(); caches.open(RUNTIME).then(c=>c.put(req,copy)); return res;
  }catch(_){
    return (await caches.match(req)) || (await caches.match('./offline.html')) || (await caches.match('./index.html'));
  }
}
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  const url=new URL(e.request.url);
  if(url.origin!==location.origin) return;
  if(e.request.mode==='navigate'){ e.respondWith(networkFirst(e.request)); return; }
  const isAsset=/\.(css|js|png|jpg|jpeg|svg|webp|pdf|webmanifest)$/i.test(url.pathname);
  e.respondWith(isAsset ? cacheFirst(e.request) : networkFirst(e.request));
});
self.addEventListener('message',e=>{
  if(!e.data || e.data.type!=='CACHE_NOW') return;
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>{e.ports[0]&&e.ports[0].postMessage({ok:true,cache:CACHE});}).catch(()=>{e.ports[0]&&e.ports[0].postMessage({ok:false});}));
});

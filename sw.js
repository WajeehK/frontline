const C='fl-v3';
const FILES=['./','index.html','style.css','app.js','manifest.webmanifest','vendor/three.module.min.js','vendor/OrbitControls.js','geo/theatres.json','geo/us-iran.png','geo/us-iran.json','icons/icon-192.png','icons/icon-512.png','icons/favicon-32.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>Promise.all(FILES.map(f=>fetch(new Request(f,{cache:'reload'})).then(r=>{if(r.ok)return c.put(f,r);}).catch(()=>{})))));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))));self.clients.claim();});
const FRESH=/(\/|index\.html|app\.js|style\.css|\.json|manifest\.webmanifest)$/;
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;const u=new URL(e.request.url);if(u.origin!==location.origin)return;
 if(e.request.mode==='navigate'||FRESH.test(u.pathname)){e.respondWith(fetch(e.request,{cache:'no-cache'}).then(res=>{if(res.ok){const cl=res.clone();caches.open(C).then(c=>c.put(u.pathname.endsWith('.json')?u.pathname:e.request,cl));}return res;}).catch(()=>caches.match(u.pathname.endsWith('.json')?u.pathname:e.request,{ignoreSearch:true}).then(r=>r||caches.match('index.html'))));return;}
 e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(r=>r||fetch(e.request).then(res=>{if(res.ok){const cl=res.clone();caches.open(C).then(c=>c.put(e.request,cl));}return res;})));});

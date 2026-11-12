// activate deletes old caches except the push log
const C='fl-v12';
const FILES=['./','index.html','style.css','app.js','manifest.webmanifest','vendor/three.module.min.js','vendor/OrbitControls.js','geo/theatres.json','geo/us-iran.png','geo/us-iran.json','icons/icon-192.png','icons/icon-512.png','icons/favicon-32.png','icons/logo.svg'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>Promise.all(FILES.map(f=>fetch(new Request(f,{cache:'reload'})).then(r=>{if(r.ok)return c.put(f,r);}).catch(()=>{})))));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C&&k!=='fl-pushlog').map(k=>caches.delete(k)))));self.clients.claim();});
const FRESH=/(\/|index\.html|app\.js|style\.css|\.json|manifest\.webmanifest)$/;
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;const u=new URL(e.request.url);if(u.origin!==location.origin)return;
 if(e.request.mode==='navigate'||FRESH.test(u.pathname)){e.respondWith(fetch(e.request,{cache:'no-cache'}).then(res=>{if(res.ok){const cl=res.clone();caches.open(C).then(c=>c.put(u.pathname.endsWith('.json')?u.pathname:e.request,cl));}return res;}).catch(()=>caches.match(u.pathname.endsWith('.json')?u.pathname:e.request,{ignoreSearch:true}).then(r=>r||caches.match('index.html'))));return;}
 e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(r=>r||fetch(e.request).then(res=>{if(res.ok){const cl=res.clone();caches.open(C).then(c=>c.put(e.request,cl));}return res;})));});

self.addEventListener('push',e=>{let d={};try{d=e.data.json()}catch(_){d={title:'Frontline',body:e.data&&e.data.text()}}
 e.waitUntil(Promise.all([self.registration.showNotification(d.title||'Frontline',{body:d.body||'',tag:d.tag,icon:'icons/icon-192.png',badge:'icons/favicon-32.png',data:{url:d.url||'./'}}),
  caches.open('fl-pushlog').then(c=>c.put('last-push',new Response(JSON.stringify({at:Date.now(),d})))),
  clients.matchAll({type:'window'}).then(cs=>cs.forEach(c=>c.postMessage({type:'pushed',d})))]))});
self.addEventListener('notificationclick',e=>{e.notification.close();const url=new URL((e.notification.data&&e.notification.data.url)||'./',self.registration.scope).href;
 e.waitUntil((async()=>{const cs=await clients.matchAll({type:'window',includeUncontrolled:true});for(const c of cs){if(c.url.startsWith(self.registration.scope)){await c.focus();c.postMessage({type:'open',url});return}}return clients.openWindow(url)})())});

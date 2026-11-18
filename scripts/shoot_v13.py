#!/usr/bin/env python3
import sys, time, os
from pathlib import Path
from playwright.sync_api import sync_playwright

U = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8939/'
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else '/workspace/frontline-shots-v13')
OUT.mkdir(parents=True, exist_ok=True)
VP = {'width': 412, 'height': 915}

def ctx_page(pw, boot=False):
    b = pw._browser
    ctx = b.new_context(viewport=VP, device_scale_factor=2, is_mobile=True, has_touch=True, service_workers='block')
    if not boot:
        ctx.add_init_script("try{sessionStorage.setItem('fl_boot13','1')}catch(e){}")
    pg = ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append('PAGEERR ' + str(e)))
    pg.on('console', lambda m: errs.append(m.type + ': ' + m.text) if m.type in ('error',) else None)
    return ctx, pg, errs

def wait_app(pg, timeout=60000, quiet=True):
    pg.wait_for_function("window.__fl && document.querySelector('#boot') && document.querySelector('#boot').classList.contains('gone')", timeout=timeout)
    if quiet:
        pg.evaluate("""() => { const S=__fl.S; S.brkQ=[]; S.queue=[]; S.live=[]; S.nextAt=1e12;
          const b=document.getElementById('brk'); if(b){ b.className=''; b.innerHTML=''; }
          const m=document.getElementById('brkMini'); if(m) m.classList.remove('on');
          const tk=document.getElementById('ticker'); if(tk) tk.classList.add('hide'); }""")
    time.sleep(0.5)

def shot(pg, name):
    path = OUT / name
    pg.screenshot(path=str(path), animations='disabled') if False else pg.screenshot(path=str(path))
    print('wrote', path, path.stat().st_size)
    return path

with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pw._browser = browser

    # --- startup frames (held, staged) ---
    ctx, pg, errs = ctx_page(pw, boot=True)
    pg.add_init_script("window.__flHoldIntro=true")
    pg.goto(U + '?boot=1#t=us-iran', wait_until='domcontentloaded')
    time.sleep(0.55)
    pg.evaluate("""() => { window.__flHoldIntro=true; const i=document.getElementById('intro');
      i.classList.remove('out','quick','stage-bio','stage-clear','stage-lock'); }""")
    time.sleep(0.35); shot(pg, '01-startup-1-terminal.png')
    pg.evaluate("() => document.getElementById('intro').classList.add('stage-bio')")
    time.sleep(0.35); shot(pg, '02-startup-2-retina.png')
    pg.evaluate("() => { const i=document.getElementById('intro'); i.classList.remove('stage-bio'); i.classList.add('stage-clear','stage-lock'); }")
    time.sleep(0.35); shot(pg, '03-startup-3-clearance.png')
    print('boot errors', errs[:8])
    ctx.close()

    # --- region-locked theatre + fullscreen layout ---
    ctx, pg, errs = ctx_page(pw)
    pg.goto(U + '#t=us-iran', wait_until='load')
    wait_app(pg)
    # collapse nothing; let terrain settle
    time.sleep(1.8)
    shot(pg, '05-theatre-us-iran.png')
    # fullscreen-ish: hide chrome briefly? User wants full-screen layout of the app itself.
    # show a clean layout with HUD
    shot(pg, '10-fullscreen-layout.png')
    print('theatre errors', errs[:8])

    # --- news list with live timestamps ---
    pg.evaluate("__fl.go(1)")
    time.sleep(0.8)
    shot(pg, '07-news-list.png')

    # --- breaking banner (mini, prominent) ---
    pg.evaluate("""() => {
      const S = __fl.S;
      const e = S.events.find(x => __fl.annotateEvent(x).confirmed && x.anim && x.anim !== 'none') || S.events[0];
      document.body.classList.add('hudc');
      const b = document.getElementById('brkMini');
      const typ = [e.type];
      const [nm,ic,col] = (e.anim && {drone_capture:['DRONE DOWNED','🛩️','#ff9a3c']}[e.anim]) || [e.type, '', '#ff5a3a'];
      b.innerHTML = `<span class="bmk" style="background:${col||'#ff5a3a'}">${ic||''} BREAKING · ${nm}</span><b>${e.title}</b><small>${e.outlet} · just now · tap to read</small>`;
      b.classList.add('on');
      return e.title;
    }""")
    time.sleep(0.4)
    shot(pg, '06-breaking-banner.png')
    pg.evaluate("() => { document.getElementById('brkMini').classList.remove('on'); document.body.classList.remove('hudc'); __fl.go(0); }")
    time.sleep(0.4)

    # --- drone capture animation ---
    pg.evaluate("""() => {
      const S=__fl.S; S.queue=[]; S.nextAt=1e12; S.userAt=-1e9;
      const e={id:'t-drone',cid:'t-drone',type:'drone',anim:'drone_capture',confirmed:1,sev:3,actor:'B',
        title:'IRGC captures American surveillance drone in Iranian airspace',
        outlet:'Reuters',ts:Date.now()/1000,url:'#',loc:{name:'Tehran',lat:35.7,lon:51.42,kind:'place'}};
      __fl.play(e); return 'ok';
    }""")
    time.sleep(1.5)
    shot(pg, '08-anim-drone-capture.png')
    time.sleep(2.8)
    shot(pg, '08b-anim-drone-capture-landed.png')

    print('mid errors', errs[:10])
    ctx.close()

    # --- tanker on red sea ---
    ctx, pg, errs = ctx_page(pw)
    pg.goto(U + '#t=yemen-red-sea', wait_until='load')
    wait_app(pg)
    time.sleep(1.2)
    pg.evaluate("""() => {
      const S=__fl.S; S.queue=[]; S.nextAt=1e12; S.userAt=-1e9;
      const e={id:'t-tank',cid:'t-tank',type:'naval',anim:'tanker',confirmed:1,sev:4,actor:'B',
        title:'Oil tanker hit by a missile in the Red Sea, ship ablaze',
        outlet:'Reuters',ts:Date.now()/1000,url:'#',loc:{name:'Red Sea',lat:15.5,lon:42.3,kind:'sea'}};
      __fl.play(e); return 'ok';
    }""")
    time.sleep(2.3)
    shot(pg, '09-anim-tanker-strike.png')
    time.sleep(1.8)
    shot(pg, '09b-anim-tanker-listing.png')
    print('tanker errors', errs[:10])
    ctx.close()

    # --- globe ---
    ctx, pg, errs = ctx_page(pw)
    pg.goto(U + '#t=globe', wait_until='load')
    wait_app(pg)
    time.sleep(2.0)
    # give the texture a moment
    pg.wait_for_function("window.__fl && __fl.GLOBE && __fl.GLOBE.on && __fl.GLOBE.earth", timeout=20000)
    time.sleep(0.8)
    shot(pg, '04-globe.png')
    print('globe errors', errs[:12])
    ctx.close()

    browser.close()
    print('done', list(sorted(p.name for p in OUT.iterdir())))

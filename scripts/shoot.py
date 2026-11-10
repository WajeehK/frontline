import sys, time
from playwright.sync_api import sync_playwright
U = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8931/'
out = sys.argv[2] if len(sys.argv) > 2 else 'shots'
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    for tag, vp, mob in [('mobile', {'width': 412, 'height': 915}, True), ('desktop', {'width': 1440, 'height': 900}, False)]:
        ctx = b.new_context(viewport=vp, device_scale_factor=2 if mob else 1, is_mobile=mob, has_touch=mob, service_workers='block')
        pg = ctx.new_page(); errs = []
        pg.on('console', lambda m: errs.append(m.type + ': ' + m.text) if m.type in ('error', 'warning') else None)
        pg.on('pageerror', lambda e: errs.append('PAGEERR ' + str(e)))
        pg.goto(U, wait_until='load'); pg.wait_for_function('window.__fl && document.querySelector("#boot").classList.contains("gone")', timeout=60000)
        time.sleep(2.5); pg.screenshot(path=f'{out}/{tag}-battlefield.png')
        # force a kinetic event mid-animation
        pg.evaluate("""()=>{const S=__fl.S;S.queue=[];S.nextAt=1e12;const e=S.events.find(e=>['missile','air','drone'].includes(e.type)&&e.actor)||S.events.find(e=>e.type!=='statement');__fl.play(e,{fly:false});return e.title}""")
        time.sleep(2.0); pg.screenshot(path=f'{out}/{tag}-event.png')
        pg.evaluate("__fl.go(1)"); time.sleep(1.0); pg.screenshot(path=f'{out}/{tag}-feed.png')
        pg.evaluate("__fl.go(2)"); time.sleep(1.0); pg.screenshot(path=f'{out}/{tag}-replay.png')
        print(tag, '\n'.join(errs[:10]))
        ctx.close()
    b.close()

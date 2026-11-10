import sys, time
from playwright.sync_api import sync_playwright
U = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8931/'
W = 'window.__fl && document.querySelector("#boot").classList.contains("gone")'
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    ctx = b.new_context(viewport={'width': 412, 'height': 915}, device_scale_factor=2, is_mobile=True, has_touch=True, service_workers='block')
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append('PAGEERR ' + str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.goto(U + '#t=us-iran', wait_until='load'); pg.wait_for_function(W, timeout=60000); time.sleep(3)
    pg.screenshot(path='shots/v4-battlefield-markets.png')
    pg.evaluate("()=>{const S=__fl.S;S.nextAt=1e12;}")
    pg.evaluate("()=>{const e=__fl.S.events.find(e=>['air','missile'].includes(e.type)&&e.sev>=3)||__fl.S.events[0];__fl.breaking(e,true)}")
    time.sleep(0.9); pg.screenshot(path='shots/v4-breaking-1.png'); time.sleep(1.8); pg.screenshot(path='shots/v4-breaking-2.png')
    time.sleep(3.6); pg.screenshot(path='shots/v4-breaking-flyto.png')
    pg.evaluate("__fl.go(2)"); time.sleep(1); pg.screenshot(path='shots/v4-sides.png')
    pg.evaluate("__fl.go(0)"); time.sleep(.5); pg.evaluate("__fl.openOpts()"); time.sleep(1); pg.screenshot(path='shots/v4-alerts-layers.png')
    pg.evaluate("document.querySelector('#optsBody').scrollTop=600"); time.sleep(.5); pg.screenshot(path='shots/v4-layers-info.png')
    pg.evaluate("__fl.go(0)"); time.sleep(.6)
    # zoom to Gulf to show live aircraft + reported naval
    pg.evaluate("()=>{const S=__fl.S;S.userAt=-1e9;const a=S.extras.ac&&S.extras.ac.ac.find(a=>a.lon>54&&a.lon<56&&a.lat>23&&a.lat<24.5);if(a)__fl.flyTo(__fl.ground(a.lat,a.lon),6.5)}"); time.sleep(3.5); pg.screenshot(path="shots/v4-live-aircraft.png"); pg.evaluate("()=>{__fl.S.queue=[];__fl.S.userAt=-1e9;__fl.flyTo(__fl.ground(17,62),9)}"); time.sleep(3.5); pg.screenshot(path="shots/v4-naval-reported.png")
    pg.evaluate("__fl.go(1)"); time.sleep(1); pg.screenshot(path='shots/v4-feed-merged.png')
    pg.evaluate("()=>{const d=[...document.querySelectorAll('#feedList details')][0]; if(d){d.open=true; d.scrollIntoView({block:'center'});}}"); time.sleep(.5); pg.screenshot(path='shots/v4-feed-outlets.png')
    pg.evaluate("__fl.go(3)"); time.sleep(1.2); pg.screenshot(path='shots/v4-replay-marks.png')
    print('\n'.join(errs[:10]))
    b.close()

import sys, time
from playwright.sync_api import sync_playwright
tag = sys.argv[1]; U = 'http://127.0.0.1:8931/'
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    for w, h in [(412, 915), (393, 852), (360, 800)]:
        ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2, is_mobile=True, has_touch=True, service_workers='block')
        pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(U + '#t=us-iran'); pg.wait_for_function('window.__fl && document.querySelector("#boot").classList.contains("gone")', timeout=60000)
        time.sleep(7)  # let a callout appear
        pg.screenshot(path=f'shots/v5-top-{tag}-{w}x{h}.png', clip={'x': 0, 'y': 0, 'width': w, 'height': h})
        print(w, errs, pg.evaluate("""()=>{const r=s=>{const e=document.querySelector(s);if(!e)return null;const b=e.getBoundingClientRect();return [Math.round(b.top),Math.round(b.bottom),Math.round(b.right),e.scrollWidth>e.clientWidth]};return {hud:r('#hud'),meters:r('#hud .meters'),mkt:r('#mkt'),fabs:r('#fabs'),frontLbl:r('.front .lbl')}}"""))
        ctx.close()
    b.close()

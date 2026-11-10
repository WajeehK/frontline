import sys, time
from playwright.sync_api import sync_playwright
tag = sys.argv[1]; U = 'http://127.0.0.1:8935/'
def tapsel(pg, sel):
    bb = pg.query_selector(sel).bounding_box(); pg.touchscreen.tap(bb['x'] + bb['width']/2, bb['y'] + bb['height']/2)
def st(pg, sel): return pg.evaluate(f"document.querySelector('{sel}').classList.contains('open')")
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    pg = b.new_context(viewport={'width':412,'height':915}, device_scale_factor=2, is_mobile=True, has_touch=True, service_workers='block').new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(U+'#t=us-iran'); pg.wait_for_function('window.__fl && document.querySelector("#boot").classList.contains("gone")', timeout=60000); time.sleep(2)
    res = {}
    for name, k, sel in [('about', 4, '#about'), ('sides', 2, '#sides')]:
        tab = f'.tabs button[data-k="{k}"]'
        tapsel(pg, tab); time.sleep(.8); res[name+'_open_tab'] = st(pg, sel)
        pg.screenshot(path=f'shots/v8-{tag}-{name}-open.png')
        tapsel(pg, tab); time.sleep(.8); res[name+'_close_tab'] = not st(pg, sel)
        tapsel(pg, tab); time.sleep(.8)
        g = pg.query_selector(sel + ' .grab'); bb = g.bounding_box(); pg.touchscreen.tap(bb['x'] + bb['width']/2, bb['y'] + bb['height']/2); time.sleep(.8)
        res[name+'_close_handle'] = not st(pg, sel)
        pg.screenshot(path=f'shots/v8-{tag}-{name}-after-handle.png')
        if st(pg, sel): pg.evaluate('__fl.go(0)'); time.sleep(.5)
        tapsel(pg, tab); time.sleep(.8); pg.touchscreen.tap(200, 140); time.sleep(.8); res[name+'_close_scrim'] = not st(pg, sel)
        if st(pg, sel): pg.evaluate('__fl.go(0)'); time.sleep(.5)
    print(res, errs); b.close()

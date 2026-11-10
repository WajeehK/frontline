from playwright.sync_api import sync_playwright
svg=open('scripts/icon.svg').read()
with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path='/usr/bin/google-chrome')
    for name,size,pad,radius in [('icon-512',512,0,0),('icon-192',192,0,0),('maskable-512',512,0.12,0),('apple-touch-icon',180,0,0),('favicon-32',32,0,0)]:
        p=b.new_page(viewport={'width':size,'height':size})
        inner=int(size*(1-2*pad))
        p.set_content(f'<html><body style="margin:0;background:#000;display:grid;place-items:center;width:{size}px;height:{size}px"><div style="width:{inner}px;height:{inner}px">{svg.replace("<svg ",f"<svg width={inner} height={inner} ")}</div></body></html>')
        p.screenshot(path=f'icons/{name}.png'); p.close()
    b.close()

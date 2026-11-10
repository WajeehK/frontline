"""One-off build step (run locally, output committed): bakes real terrain (AWS Terrain Tiles, Mapzen terrarium,
public/open data) and Natural Earth country borders (world-atlas, public domain) for each theatre."""
import json, math, io, urllib.request, os
from PIL import Image
T = json.load(open('geo/theatres.json'))
TOPO = json.load(open('/tmp/countries-50m.json'))
cache = {}
def tile(z, x, y):
    k = (z, x, y)
    if k not in cache:
        p = f'/tmp/terr/{z}_{x}_{y}.png'
        if not os.path.exists(p):
            os.makedirs('/tmp/terr', exist_ok=True)
            urllib.request.urlretrieve(f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png', p)
        cache[k] = Image.open(p).convert('RGB').load()
    return cache[k]
def elev(lat, lon, z):
    n = 2 ** z
    xf = (lon + 180) / 360 * n
    lr = math.radians(lat)
    yf = (1 - math.log(math.tan(lr) + 1 / math.cos(lr)) / math.pi) / 2 * n
    tx, ty = int(xf), int(yf)
    px, py = min(255, int((xf - tx) * 256)), min(255, int((yf - ty) * 256))
    r, g, b = tile(z, tx, ty)[px, py]
    return r * 256 + g + b / 256 - 32768
# decode topojson arcs
tr = TOPO['transform']; sx, sy = tr['scale']; ox, oy = tr['translate']
arcs = []
for a in TOPO['arcs']:
    x = y = 0; pts = []
    for dx, dy in a:
        x += dx; y += dy; pts.append((x * sx + ox, y * sy + oy))
    arcs.append(pts)
for tid, t in T.items():
    w, s, e, n = t['bbox']; z = t['zoom']; W = t['grid']
    latc = (s + n) / 2
    H = round(W * (n - s) / ((e - w) * math.cos(math.radians(latc))))
    img = Image.new('RGB', (W, H))
    px = img.load()
    for j in range(H):
        lat = n - (n - s) * j / (H - 1)
        for i in range(W):
            lon = w + (e - w) * i / (W - 1)
            h = elev(lat, lon, z)
            if h > 0: px[i, j] = (min(255, int(math.sqrt(h) * 3.6)), 255, 0)
            else: px[i, j] = (0, 0, min(255, int(math.sqrt(-h) * 3.6)))
    img.save(f'geo/{tid}.png', optimize=True)
    lines = []
    for pts in arcs:
        seg = []
        for lon, lat in pts:
            if w - 1 <= lon <= e + 1 and s - 1 <= lat <= n + 1: seg += [round(lon, 3), round(lat, 3)]
            else:
                if len(seg) >= 4: lines.append(seg)
                seg = []
        if len(seg) >= 4: lines.append(seg)
    json.dump({'w': W, 'h': H, 'borders': lines}, open(f'geo/{tid}.json', 'w'), separators=(',', ':'))
    print(tid, W, H, len(lines), len(cache))

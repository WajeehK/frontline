"""One-off build step (run locally, output committed). From AWS Terrain Tiles (Mapzen terrarium, open data):
 - geo/<tid>.png : the height grid at 1.4x the v10 density (same encoding as bake_geo.py)
 - geo/<tid>-d.jpg : 2048px detail map: RG = surface normal x/z (hillshade detail), B = land/sea elevation (crisp coasts)"""
import json, math, os, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor
import numpy as np
from PIL import Image
T = json.load(open('geo/theatres.json'))
def tile(z, x, y):
    p = f'/tmp/terr/{z}_{x}_{y}.png'
    if not os.path.exists(p):
        os.makedirs('/tmp/terr', exist_ok=True)
        for _ in range(3):
            try: urllib.request.urlretrieve(f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png', p); break
            except Exception as e: err = e
    a = np.asarray(Image.open(p).convert('RGB'), dtype=np.float32)
    return a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
def mosaic(w, s, e, n, z):
    N = 2 ** z; tx = lambda lon: (lon + 180) / 360 * N
    ty = lambda lat: (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * N
    x0, x1, y0, y1 = int(tx(w)), int(tx(e)), int(ty(n)), int(ty(s))
    jobs = [(x, y) for x in range(x0, x1 + 1) for y in range(y0, y1 + 1)]
    with ThreadPoolExecutor(16) as ex: tiles = dict(zip(jobs, ex.map(lambda j: tile(z, *j), jobs)))
    M = np.zeros(((y1 - y0 + 1) * 256, (x1 - x0 + 1) * 256), np.float32)
    for (x, y), a in tiles.items(): M[(y - y0) * 256:(y - y0 + 1) * 256, (x - x0) * 256:(x - x0 + 1) * 256] = a
    return M, x0, y0, tx, ty
def sample(M, x0, y0, tx, ty, lats, lons):
    X = (np.array([tx(l) for l in lons]) - x0) * 256 - .5; Y = (np.array([ty(l) for l in lats]) - y0) * 256 - .5
    X = np.clip(X, 0, M.shape[1] - 1.001); Y = np.clip(Y, 0, M.shape[0] - 1.001)
    xi, yi = X.astype(int), Y.astype(int); fx, fy = X - xi, Y - yi
    a = M[yi][:, xi]; b = M[yi][:, xi + 1]; c = M[yi + 1][:, xi]; d = M[yi + 1][:, xi + 1]
    return (a * (1 - fx) + b * fx) * (1 - fy)[:, None] + (c * (1 - fx) + d * fx) * fy[:, None]
for tid, t in T.items():
    if len(sys.argv) > 1 and tid not in sys.argv[1:]: continue
    w, s, e, n = t['bbox']; z = t['zoom']; latc = (s + n) / 2; kx = math.cos(math.radians(latc))
    M, x0, y0, tx, ty = mosaic(w, s, e, n, min(z + 1, 9))
    W = round(t['grid'] * 1.4); H = round(W * (n - s) / ((e - w) * kx))
    h = sample(M, x0, y0, tx, ty, np.linspace(n, s, H), np.linspace(w, e, W))
    r = np.where(h > 0, np.minimum(255, np.sqrt(np.maximum(h, 0)) * 3.6), 0); g = np.where(h > 0, 255, 0); b = np.where(h > 0, 0, np.minimum(255, np.sqrt(np.maximum(-h, 0)) * 3.6))
    Image.fromarray(np.stack([r, g, b], -1).astype(np.uint8)).save(f'geo/{tid}.png', optimize=True)
    DW = 2048; DH = round(DW * (n - s) / ((e - w) * kx))
    hd = sample(M, x0, y0, tx, ty, np.linspace(n, s, DH), np.linspace(w, e, DW))
    mpp = (e - w) * kx * 111320 / DW; ex = 2.5
    gy, gx = np.gradient(np.maximum(hd, 0) * ex, mpp)
    nz = 1 / np.sqrt(gx * gx + gy * gy + 1); nx = -gx * nz; ny = gy * nz  # ny: +north-facing
    ev = np.clip(128 + np.sign(hd) * np.sqrt(np.abs(hd)) * 1.6, 0, 255); ev = np.where(hd > 0, np.maximum(ev, 131), np.minimum(ev, 125))
    D = np.stack([(nx * .5 + .5) * 255, (ny * .5 + .5) * 255, ev], -1).astype(np.uint8)
    Image.fromarray(D).save(f'geo/{tid}-d.jpg', quality=86, optimize=True)
    print(tid, W, H, DW, DH, os.path.getsize(f'geo/{tid}-d.jpg') // 1024, 'KB', flush=True)

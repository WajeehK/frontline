#!/usr/bin/env python3
"""Markets (Yahoo Finance public chart endpoint) and live military aircraft (adsb.lol /v2/mil, public ADS-B).
Numbers are copied exactly as the sources report them; nothing is estimated. If a source fails, the previous file is kept."""
import json, os, time, urllib.request
ROOT = os.path.join(os.path.dirname(__file__), '..')
T = json.load(open(os.path.join(ROOT, 'geo/theatres.json')))
UA = 'Mozilla/5.0 (compatible; FrontlineTracker/1.0; +https://github.com/WajeehK/frontline)'
SYMS = [("BZ=F", "Brent", "oil"), ("CL=F", "WTI", "oil"), ("GC=F", "Gold", "metal"), ("DX-Y.NYB", "Dollar index", "fx"),
        ("LMT", "Lockheed Martin", "def"), ("RTX", "RTX", "def"), ("NOC", "Northrop Grumman", "def"), ("BA.L", "BAE Systems", "def")]
def get(u, t=20):
    return urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': UA}), timeout=t).read()
def markets():
    out, ok = [], 0
    for sym, name, kind in SYMS:
        try:
            j = json.loads(get(f'https://query1.finance.yahoo.com/v8/finance/chart/{urllib.request.quote(sym)}?range=5d&interval=60m'))
            r = j['chart']['result'][0]; m = r['meta']
            ts = r.get('timestamp') or []; cl = r['indicators']['quote'][0].get('close') or []
            ser = [[t, round(c, 4)] for t, c in zip(ts, cl) if c is not None]
            last = m.get('regularMarketPrice'); prev = m.get('chartPreviousClose') or m.get('previousClose')
            # day change vs the previous session's close (the last close before today's session)
            day = time.strftime('%Y-%m-%d', time.gmtime(m.get('regularMarketTime', time.time()) + m.get('gmtoffset', 0)))
            prior = [c for t, c in ser if time.strftime('%Y-%m-%d', time.gmtime(t + m.get('gmtoffset', 0))) < day]
            pc = prior[-1] if prior else prev
            out.append({"sym": sym, "name": name, "kind": kind, "cur": m.get('currency'), "last": last, "prevClose": pc,
                        "ch": round((last - pc) / pc * 100, 2) if last and pc else None, "t": m.get('regularMarketTime'), "series": ser[-120:]})
            ok += 1
        except Exception as e:
            print('market fail', sym, str(e)[:60])
        time.sleep(0.4)
    return out, ok
def aircraft():
    j = json.loads(get('https://api.adsb.lol/v2/mil', 30))
    boxes = [t['bbox'] for t in T.values()]
    ac = []
    for a in j.get('ac', []):
        la, lo = a.get('lat'), a.get('lon')
        if la is None or lo is None: continue
        if not any(b[0] - 3 <= lo <= b[2] + 3 and b[1] - 3 <= la <= b[3] + 3 for b in boxes): continue
        ac.append({"hex": a.get('hex'), "fl": (a.get('flight') or '').strip(), "t": a.get('t'), "r": a.get('r'), "desc": a.get('desc'),
                   "lat": round(la, 4), "lon": round(lo, 4), "alt": a.get('alt_baro'), "gs": a.get('gs'), "trk": a.get('track') or a.get('true_heading'), "seen": a.get('seen_pos', a.get('seen'))})
    return {"src": "adsb.lol /v2/mil (public ADS-B/MLAT)", "now": int((j.get('now') or time.time() * 1000) / 1000), "total": len(j.get('ac', [])), "ac": ac}
if __name__ == '__main__':
    mp = os.path.join(ROOT, 'data/markets.json')
    m, ok = markets()
    if ok: json.dump({"updated": int(time.time()), "src": "Yahoo Finance chart API (delayed quotes)", "q": m}, open(mp, 'w'), separators=(',', ':'))
    print('markets', ok, [(q['name'], q['last'], q['ch']) for q in m])
    try:
        a = aircraft(); json.dump(a, open(os.path.join(ROOT, 'data/aircraft.json'), 'w'), separators=(',', ':'))
        print('aircraft in theatres', len(a['ac']), 'of', a['total'])
    except Exception as e:
        print('aircraft fail', str(e)[:80])

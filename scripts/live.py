#!/usr/bin/env python3
"""Frontline fast lane (no AI, no paid services). Runs on the box every ~2 min.
Polls Al Jazeera's official RSS feed with conditional requests (ETag), classifies new items with the same fixed rules as
fetch.py, drops anything already in the 15-minute dataset, publishes new events to a public ntfy.sh topic the app polls,
and sends Web Push for major kinetic events using the same rules, quiet hours and 4/hour limit as push.py.
Every push it sends is reported back (encrypted) to the registration topic so the next push.py run won't repeat it.
Al Jazeera's live-blog pages and /api are not scraped (their robots.txt/terms disallow automated scraping)."""
import json, os, sys, time, hashlib, base64, urllib.request, re
from datetime import datetime
from zoneinfo import ZoneInfo
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fetch as F
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

LIVE_TOPIC = 'fl-live-8143ad24bad1fb3ffba4'
SITE = 'https://wajeehk.github.io/frontline/'
FEEDS = [('Al Jazeera', 'https://www.aljazeera.com/xml/rss/all.xml'), ('Al Jazeera', 'https://www.aljazeera.com/news-sitemap.xml')]
SEC = '/workspace/.fl-secrets'
STATE = '/workspace/.fl-live/state.json'
INTERVAL = int(os.environ.get('FL_LIVE_INTERVAL', '120'))
MAX_AGE = 6 * 3600
LON = ZoneInfo('Europe/London')
UA = F.UA
def log(*a): print(datetime.now(LON).strftime('%F %T %Z'), *a, flush=True)
b64 = lambda b: base64.b64encode(b).decode()

def http(url, data=None, headers=None, timeout=25):
    h = {'User-Agent': UA}; h.update(headers or {})
    return urllib.request.urlopen(urllib.request.Request(url, data=data, headers=h), timeout=timeout)

class Pusher:
    def __init__(self):
        import push as P
        self.P = P
        pem = open(os.path.join(SEC, 'push_rsa_private.pem'), 'rb').read().rstrip(b'\n')  # GitHub secret strips the newline
        self.rsa = serialization.load_pem_private_key(pem, None)
        self.aes = AESGCM(hashlib.sha256(pem + b'|fl-state').digest())
        from py_vapid import Vapid
        self.vapid = Vapid.from_pem(open(os.path.join(SEC, 'vapid_private.pem'), 'rb').read())
        self.pub = self.rsa.public_key(); self.st = None; self.st_at = 0
    def devices(self):
        if time.time() - self.st_at > 240:
            try:
                raw = http(SITE + 'data/push.bin?t=%d' % time.time()).read()
                self.st = json.loads(self.aes.decrypt(raw[:12], raw[12:], None)); self.st_at = time.time()
            except Exception as e: log('push state unavailable', type(e).__name__)
        return (self.st or {}).get('dev', {})
    def report(self, msg):  # encrypted note to push.py via the registration topic
        k = os.urandom(32); iv = os.urandom(12)
        c = AESGCM(k).encrypt(iv, json.dumps(msg).encode(), None)
        ek = self.pub.encrypt(k, padding.OAEP(mgf=padding.MGF1(hashes.SHA256()), algorithm=hashes.SHA256(), label=None))
        http('https://ntfy.sh/' + self.P.TOPIC, data=json.dumps({'v': 1, 'k': b64(ek), 'iv': b64(iv), 'c': b64(c)}).encode()).read()
    def maybe_send(self, S, tid, e, title_th):
        P = self.P; now = time.time(); lon = datetime.now(LON); hm = lon.hour * 60 + lon.minute
        quiet = 30 <= hm < 450
        if e['type'] not in P.KIN or e['sev'] < 3 or e.get('lowrel') or (quiet and e['sev'] < 5): return 0
        n = 0; tk = P.toks(e['title'])
        for did, d in self.devices().items():
            if tid not in d.get('th', []): continue
            mine = [x for x in S['sent'].get(did, []) if now - x['t'] < 7200]
            log_h = [t for t in d.get('log', []) if now - t < 3600] + [x['t'] for x in mine if now - x['t'] < 3600]
            if len(log_h) >= P.MAX_PER_HOUR: continue
            toks = [set(p) for p in d.get('tok', [])] + [set(x['tok']) for x in mine]
            if e['cid'] in d.get('sent', []) or any(len(tk & p) / max(1, len(tk | p)) >= 0.4 for p in toks): continue
            payload = {'title': f"{P.ICON[e['type']]} {P.NAME[e['type']]} · {title_th}", 'body': f"{e['title']} — {e['outlet']} (live)", 'tag': e['cid'], 'url': f"./#t={tid}&e={e['cid']}"}
            try:
                P.webpush(d['sub'], json.dumps(payload), vapid_private_key=self.vapid, vapid_claims={'sub': P.SUB_CLAIM}, ttl=6 * 3600,
                          headers={'Urgency': 'high' if e['sev'] >= 4 else 'normal'}, timeout=15)
            except Exception as ex:
                log('push fail', getattr(getattr(ex, 'response', None), 'status_code', type(ex).__name__)); continue
            S['sent'].setdefault(did, []).append({'t': now, 'tok': sorted(tk), 'cid': e['cid'], 'url': e['url']}); n += 1
            try: self.report({'id': did, 'sent': {'cid': e['cid'], 'url': F.norm_url(e['url']), 'tok': sorted(tk), 't': int(now)}})
            except Exception as ex: log('report fail', type(ex).__name__)
        return n

def known_urls(cache):
    if time.time() - cache.get('at', 0) < 240: return cache
    urls, toks = set(), []
    for tid in F.T:
        try:
            d = json.loads(http(SITE + f'data/{tid}.json?t=%d' % time.time()).read())
            for c in d.get('clusters', []):
                if time.time() - c['ts'] > 86400: continue
                toks.append((tid, F.toks(c['title'])))
                for o in c.get('outlets', []): urls.add(F.norm_url(o['url']))
        except Exception as e: log('dataset read fail', tid, type(e).__name__)
    cache.update(at=time.time(), urls=urls, toks=toks); return cache

def main():
    os.makedirs(os.path.dirname(STATE), exist_ok=True)
    try: S = json.load(open(STATE))
    except Exception: S = {}
    S.setdefault('etag', {}); S.setdefault('seen', {}); S.setdefault('sent', {})
    try: pusher = Pusher()
    except Exception as e: pusher = None; log('push disabled:', type(e).__name__, e)
    cache = {}
    log('live poller started pid', os.getpid(), 'interval', INTERVAL)
    while True:
        t0 = time.time(); pub = 0; pushed = 0
        try:
            for name, url in FEEDS:
                h = {'If-None-Match': S['etag'][url]} if S['etag'].get(url) else {}
                try: r = http(url, headers=h); raw = r.read(); S['etag'][url] = r.headers.get('ETag') or ''
                except urllib.error.HTTPError as e:
                    if e.code == 304: continue
                    log(name, 'HTTP', e.code); continue
                items = F.parse_any(raw); known = None
                for it in items:
                    it['outlet'] = name; nu = F.norm_url(it['url']) + ('|' + it['title'] if it.get('live') else '')
                    if nu in S['seen'] or time.time() - it['ts'] > MAX_AGE or it['ts'] > time.time() + 600: continue
                    S['seen'][nu] = int(time.time())
                    known = known or known_urls(cache)
                    if not it.get('live') and nu in known['urls']: continue
                    for tid, th in F.T.items():
                        r2 = F.make_event(tid, it)
                        if not r2 or not r2[1]: continue
                        eid, e = r2; tk = F.toks(e['title'])
                        if any(t == tid and len(tk & k) / max(1, len(tk | k)) >= 0.5 for t, k in known['toks']): continue  # already covered
                        e.update(cid='aj-' + eid, last=e['ts'], n=1, live=1, outlets=[{'outlet': name, 'url': e['url'], 'title': e['title'], 'ts': e['ts'], 'via': 'LIVE'}])
                        e['desc'] = (e.get('desc') or '')[:280]
                        http('https://ntfy.sh/' + LIVE_TOPIC, data=json.dumps({'v': 1, 'tid': tid, 'e': e}).encode(), headers={'Title': 'frontline'}).read()
                        pub += 1; log('published', tid, e['type'], e['sev'], e['title'][:90])
                        if pusher: pushed += pusher.maybe_send(S, tid, e, th['name'])
            cut = time.time() - 2 * 86400
            S['seen'] = {k: v for k, v in S['seen'].items() if v > cut}
            S['sent'] = {k: [x for x in v if time.time() - x['t'] < 7200] for k, v in S['sent'].items()}
            json.dump(S, open(STATE + '.tmp', 'w')); os.replace(STATE + '.tmp', STATE)
            if pub or pushed: log(f'cycle: published {pub}, pushed {pushed}')
        except Exception as e:
            log('cycle error', type(e).__name__, str(e)[:120])
        if os.environ.get('FL_LIVE_ONCE'): break
        time.sleep(max(20, INTERVAL - (time.time() - t0)))

if __name__ == '__main__':
    main()

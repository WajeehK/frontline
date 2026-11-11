#!/usr/bin/env python3
"""Frontline Web Push sender (runs in the GitHub Action after fetch.py; rules only, no AI, no paid services).
Same proven pattern as News Reel: phones register by POSTing an RSA-OAEP+AES-GCM encrypted message to a public
ntfy.sh topic (no account). Only this script (PUSH_RSA_PRIV from GitHub secrets) can read them. The device list and
dedupe state live AES-GCM-encrypted in data/push.bin (deployed with the site, restored each run). Pushes are VAPID-signed."""
import json, os, re, sys, time, base64, hashlib, urllib.request
from datetime import datetime
from zoneinfo import ZoneInfo
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from pywebpush import webpush, WebPushException
from py_vapid import Vapid

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data')
TOPIC = 'fl-sub-f11ebc9ad43b6dd3b99316cf'
SUB_CLAIM = 'mailto:WajeehK@users.noreply.github.com'
PUSH_HOSTS = re.compile(r'^https://([a-z0-9-]+\.)*(push\.apple\.com|fcm\.googleapis\.com|googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com)(/|$)')
MAX_PER_HOUR, MAX_DEVICES = 4, 12
KIN = {'missile', 'drone', 'air', 'naval', 'ground', 'mine'}
ICON = {'missile': '🚀', 'drone': '🛩️', 'air': '✈️', 'naval': '⚓', 'ground': '💥'}
NAME = {'missile': 'Missile attack', 'drone': 'Drone attack', 'air': 'Airstrike', 'naval': 'Naval incident', 'ground': 'Ground fighting'}
BANDS = [(15, 'CALM'), (35, 'TENSE'), (60, 'ELEVATED'), (80, 'HIGH'), (101, 'SEVERE')]
LON = ZoneInfo('Europe/London')
b64d = lambda s: base64.b64decode(s + '=' * (-len(s) % 4))
STOP = set('the a an and or of to in on at for from with by as is are was were be has have had that this it its after amid says said'.split())
def toks(s): return set(w for w in re.findall(r"[a-z0-9]{3,}", s.lower()) if w not in STOP)
def nurl(u):
    import urllib.parse as up; p = up.urlsplit(u.strip()); return up.urlunsplit((p.scheme, p.netloc.lower(), p.path.rstrip('/'), '', ''))
def band(v): return next(i for i, (lim, _) in enumerate(BANDS) if v < lim)

def keys():
    rsa_pem = os.environ['PUSH_RSA_PRIV'].encode(); vap = os.environ['VAPID_PRIVATE'].encode()
    return serialization.load_pem_private_key(rsa_pem, None), AESGCM(hashlib.sha256(rsa_pem + b'|fl-state').digest()), Vapid.from_pem(vap)

def load_state(aes):
    try:
        raw = open(os.path.join(DATA, 'push.bin'), 'rb').read()
        return json.loads(aes.decrypt(raw[:12], raw[12:], None))
    except Exception as e:
        print('push: fresh state', type(e).__name__, file=sys.stderr); return {'dev': {}, 'since': '12h', 'esc': {}}

def save_state(aes, st):
    iv = os.urandom(12); open(os.path.join(DATA, 'push.bin'), 'wb').write(iv + aes.encrypt(iv, json.dumps(st, separators=(',', ':')).encode(), None))

def inbox(rsa, since):
    url = f'https://ntfy.sh/{TOPIC}/json?poll=1&since={since}'
    try: lines = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Frontline push'}), timeout=20).read().decode().splitlines()
    except Exception as e: print('push: ntfy read fail', e, file=sys.stderr); return [], since
    out, last = [], since
    for ln in lines:
        try:
            m = json.loads(ln)
            if m.get('event') != 'message': continue
            last = m['id']; env = json.loads(m['message'])
            k = rsa.decrypt(b64d(env['k']), padding.OAEP(mgf=padding.MGF1(hashes.SHA256()), algorithm=hashes.SHA256(), label=None))
            msg = json.loads(AESGCM(k).decrypt(b64d(env['iv']), b64d(env['c']), None)); msg['_t'] = m.get('time', 0); out.append(msg)
        except Exception: continue  # junk / undecryptable posts on the public topic are ignored
    return out, last

def main():
    if not os.environ.get('VAPID_PRIVATE') or not os.environ.get('PUSH_RSA_PRIV'):
        print('push: no secrets, skipping', file=sys.stderr); return
    rsa, aes, vapid = keys(); st = load_state(aes); st.setdefault('esc', {})
    TH = json.load(open(os.path.join(ROOT, 'geo/theatres.json')))
    IX = {t['id']: t for t in json.load(open(os.path.join(DATA, 'index.json')))['theatres']}
    CL = {tid: json.load(open(os.path.join(DATA, f'{tid}.json'))).get('clusters', []) for tid in TH}
    now = time.time(); lon = datetime.now(LON); hm = lon.hour * 60 + lon.minute
    quiet = 30 <= hm < 450  # 00:30-07:30 UK: only severity-5 events get through
    msgs, st['since'] = inbox(rsa, st.get('since') or '12h')
    welcome = set()
    for m in sorted(msgs, key=lambda m: m['_t']):
        did = str(m.get('id', ''))[:40]
        if not did: continue
        if m.get('off'): st['dev'].pop(did, None); continue
        if m.get('sent'):  # a push already sent by the box fast lane (live.py): count it for rate limit + dedupe
            d = st['dev'].get(did); x = m['sent']
            if d and isinstance(x, dict):
                d['sent'].append(str(x.get('cid', ''))[:40]); d.setdefault('surl', []).append(str(x.get('url', ''))[:300])
                d['tok'].append([str(t)[:30] for t in (x.get('tok') or [])][:40]); d['log'].append(float(x.get('t') or m['_t']))
                d['surl'] = d['surl'][-200:]
            continue
        sub = m.get('sub') or {}
        if not PUSH_HOSTS.match(str(sub.get('endpoint', ''))) or not (sub.get('keys') or {}).get('p256dh'): continue
        d = st['dev'].get(did)
        if not d:
            d = st['dev'][did] = {'sent': [c['cid'] for cs in CL.values() for c in cs][:2000], 'tok': [], 'log': []}  # no backlog flood
            welcome.add(did)
        if m.get('test'): welcome.add(did)
        d.update({'sub': {'endpoint': sub['endpoint'], 'keys': sub['keys']}, 'th': [t for t in (m.get('th') or []) if t in TH], 'esc': bool(m.get('esc', True)), 'seen': int(now)})
    if len(st['dev']) > MAX_DEVICES:
        for k in sorted(st['dev'], key=lambda k: st['dev'][k].get('seen', 0))[:len(st['dev']) - MAX_DEVICES]: st['dev'].pop(k)
    sent_n = 0
    def send(did, d, payload, urgent=False):
        nonlocal sent_n
        try:
            webpush(d['sub'], json.dumps(payload), vapid_private_key=vapid, vapid_claims={'sub': SUB_CLAIM}, ttl=6 * 3600,
                    headers={'Urgency': 'high' if urgent else 'normal'}, timeout=15)
            sent_n += 1; return True
        except WebPushException as e:
            code = getattr(e.response, 'status_code', 0); print('push: send fail', code, file=sys.stderr)
            if code in (404, 410): st['dev'].pop(did, None)
            return False
        except Exception as e:
            print('push: send error', type(e).__name__, file=sys.stderr); return False
    # escalation band rises (computed once per run, then fanned out)
    rises = {}
    for tid, ix in IX.items():
        prev = st['esc'].get(tid); cur = ix['esc24']
        if prev is not None and band(cur) >= 3 and band(cur) > band(prev): rises[tid] = cur
        st['esc'][tid] = cur
    for did, d in list(st['dev'].items()):
        if did in welcome:
            names = ', '.join(TH[t]['name'] for t in d['th']) or 'no conflicts selected'
            send(did, d, {'title': '🔔 Frontline alerts are on', 'body': f'Major strikes, missile launches and big escalations for: {names}. Max {MAX_PER_HOUR} an hour; quiet 00:30–07:30 unless severe.', 'tag': 'fl-welcome', 'url': './'})
            continue
        d['log'] = [t for t in d['log'] if now - t < 3600]
        cands = []
        for tid in d['th']:
            for c in CL.get(tid, []):
                if c['cid'] in d['sent'] or now - c['ts'] > 4 * 3600: continue
                if any(nurl(o.get('url', '')) in set(d.get('surl', [])) for o in c.get('outlets', [])): d['sent'].append(c['cid']); continue
                if c['type'] in KIN and c['sev'] >= 3 and not c.get('lowrel'): cands.append((c['sev'], tid, c))
        cands.sort(key=lambda x: (-x[0], -x[2]['ts']))
        for sev, tid, c in cands:
            if quiet and sev < 5: continue
            if len(d['log']) >= MAX_PER_HOUR: break
            d['sent'].append(c['cid'])
            tk = toks(c['title'])
            if any(len(tk & set(p)) / max(1, len(tk | set(p))) >= 0.4 for p in d['tok']): continue  # same incident re-clustered
            more = f" (+{c['n'] - 1} more outlets)" if c.get('n', 1) > 1 else ''
            title = f"{ICON[c['type']]} {NAME[c['type']]} · {TH[tid]['name']}"
            if send(did, d, {'title': title, 'body': f"{c['title']} — {c['outlet']}{more}", 'tag': c['cid'], 'url': f"./#t={tid}&e={c['cid']}"}, urgent=sev >= 4):
                d['log'].append(now); d['tok'].append(sorted(tk))
        if d.get('esc', True) and not quiet:
            for tid, v in rises.items():
                if tid in d['th'] and len(d['log']) < MAX_PER_HOUR:
                    lbl = BANDS[band(v)][1]
                    if send(did, d, {'title': f"📈 Escalation {lbl} · {TH[tid]['name']}", 'body': f"Escalation meter rose to {v}/100 from reported events in the last 24h.", 'tag': 'esc-' + tid, 'url': f'./#t={tid}'}):
                        d['log'].append(now)
        d['sent'] = d['sent'][-3000:]; d['tok'] = d['tok'][-80:]
    save_state(aes, st)
    print(f'push: devices {len(st["dev"])}, new msgs {len(msgs)}, sent {sent_n}, quiet {quiet}, rises {rises}', file=sys.stderr)

if __name__ == '__main__':
    main()

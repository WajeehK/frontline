#!/usr/bin/env python3
"""Frontline data refresher. Pure rules, no AI. Fetches public RSS feeds (+ GDELT DOC API when it answers),
keeps items about each theatre, classifies them with fixed keyword rules, geocodes with a hand-built gazetteer,
merges with the stored history and writes data/<theatre>.json + data/index.json."""
import json, re, time, hashlib, html, os, sys, urllib.request, urllib.parse, email.utils, math
import xml.etree.ElementTree as ET
sys.path.insert(0, os.path.dirname(__file__))
from gazetteer import G
ROOT = os.path.join(os.path.dirname(__file__), '..')
T = json.load(open(os.path.join(ROOT, 'geo/theatres.json')))
NOW = time.time()
KEEP_DAYS = 14
UA = 'Mozilla/5.0 (compatible; FrontlineTracker/1.0; +https://github.com/WajeehK/frontline)'
FEEDS = [
 ("Al Jazeera","https://www.aljazeera.com/xml/rss/all.xml"),
 ("BBC News","https://feeds.bbci.co.uk/news/world/middle_east/rss.xml"),
 ("BBC News","https://feeds.bbci.co.uk/news/world/europe/rss.xml"),
 ("BBC News","https://feeds.bbci.co.uk/news/world/rss.xml"),
 ("The Guardian","https://www.theguardian.com/world/iran/rss"),
 ("The Guardian","https://www.theguardian.com/world/middleeast/rss"),
 ("The Guardian","https://www.theguardian.com/world/israel/rss"),
 ("The Guardian","https://www.theguardian.com/world/gaza/rss"),
 ("The Guardian","https://www.theguardian.com/world/lebanon/rss"),
 ("The Guardian","https://www.theguardian.com/world/yemen/rss"),
 ("The Guardian","https://www.theguardian.com/world/ukraine/rss"),
 ("The Guardian","https://www.theguardian.com/world/russia/rss"),
 ("New York Times","https://rss.nytimes.com/services/xml/rss/nyt/MiddleEast.xml"),
 ("New York Times","https://rss.nytimes.com/services/xml/rss/nyt/World.xml"),
 ("France 24","https://www.france24.com/en/middle-east/rss"),
 ("France 24","https://www.france24.com/en/europe/rss"),
 ("NPR","https://feeds.npr.org/1004/rss.xml"),
 ("CBS News","https://www.cbsnews.com/latest/rss/world"),
 ("PBS NewsHour","https://www.pbs.org/newshour/feeds/rss/world"),
 ("DW","https://rss.dw.com/rdf/rss-en-world"),
 ("Sky News","https://feeds.skynews.com/feeds/rss/world.xml"),
 ("Middle East Eye","https://www.middleeasteye.net/rss"),
 ("Times of Israel","https://www.timesofisrael.com/feed/"),
 ("Jerusalem Post","https://www.jpost.com/rss/rssfeedsheadlines.aspx"),
 ("Kyiv Independent","https://kyivindependent.com/news-archive/rss/"),
 ("Ukrinform","https://www.ukrinform.net/rss/block-lastnews"),
 ("Ukrainska Pravda","https://www.pravda.com.ua/eng/rss/"),
 ("The National","https://www.thenationalnews.com/arc/outboundfeeds/rss/?outputType=xml"),
]
GDELT_Q = {
 "us-iran": '(Iran OR Iranian OR Tehran OR IRGC OR Hormuz) (strike OR missile OR drone OR attack OR navy OR talks OR ceasefire OR sanctions)',
 "israel-gaza-lebanon": '(Gaza OR Hezbollah OR Hamas OR "West Bank" OR Lebanon) (strike OR killed OR attack OR ceasefire OR rocket OR raid)',
 "russia-ukraine": '(Ukraine OR Ukrainian OR Kyiv) (strike OR missile OR drone OR attack OR offensive OR talks OR ceasefire)',
 "yemen-red-sea": '(Houthi OR Houthis OR Yemen OR "Red Sea") (strike OR missile OR drone OR attack OR ship OR talks)',
}
# ---------------- classification rules (fixed; documented in the app's About tab)
TYPES = [  # (type, base severity, regex) - first match wins
 ("missile", 3, r"\b(missiles?|ballistic|cruise missile|rockets?|barrage|hypersonic|icbm|interceptors?|iron dome|air defen[cs]e)\b"),
 ("drone",   3, r"\b(drones?|uavs?|shaheds?|kamikaze|unmanned)\b"),
 ("air",     3, r"\b(air ?strikes?|strikes?|struck|bomb(s|ed|ing|ings|ers)?|warplanes?|fighter jets?|jets|air raids?|airstrike|blitz|pounded)\b"),
 ("naval",   2, r"\b(tankers?|warships?|vessels?|ships?|shipping|navy|naval|frigates?|destroyers?|aircraft carriers?|carrier strike|seiz(e|ed|es|ure)|blockade|maritime|minesweep\w*|boats?)\b"),
 ("ground",  2, r"\b(shelling|artillery|troops|offensive|ground (operation|assault|incursion)|clash(es|ed)?|gunfire|gunmen|shot dead|kill(s|ed|ing)?|raids?|incursion|advance[ds]?|captur\w+ (the )?(village|town|city|settlement|positions?)|assault|sniper|fighting|battle|killed|kills|dead|wounded|militants?|soldiers?|fighters?)\b"),
 ("cyber",   2, r"\b(cyber[- ]?attacks?|cyber|hack(ed|ers|ing)?)\b"),
 ("deploy",  2, r"\b(deploy(s|ed|ment|ing)?|evacuat\w+|reinforce\w*|mobili[sz]\w+|moves? aircraft|relocat\w+|redeploy\w*|stationed|build-?up|sends? (troops|ships|jets))\b"),
 ("diplomacy",1, r"\b(talks|ceasefire|cease-fire|truce|negotiat\w+|peace|diplomac\w+|diplomat\w*|envoy|summit|agreement|deal|accord|mediat\w+|inspections?|prisoner (swap|exchange)|hostages? (release|deal)|de-?escalat\w+|armistice)\b"),
 ("sanctions",1, r"\b(sanction\w*|embargo|tariffs?|oil prices?|asset freeze|export ban|blacklist\w*)\b"),
 ("threat",  1, r"\b(threat\w*|warns?|warning|vows?|ultimatum|retaliat\w+|revenge|escalat\w+|tensions?|on alert|high alert)\b"),
 ("statement",1, r"\b(war|military|conflict|nuclear|army|forces|weapons?|pentagon|irgc|idf|defen[cs]e minister|commander)\b"),
]
DIPLO_FIRST = re.compile(r"\b(ceasefire|truce|peace talks|talks|negotiat\w+|deal)\b")
KINETIC_STRONG = re.compile(r"\b(strikes?|struck|attack(s|ed)?|bomb\w*|missiles?|drones?|killed|shelling|raid)\b")
UP1 = re.compile(r"\b(killed|kills|dead|deaths?|death toll|casualt\w+|wounded|injured|destroy\w*|massive|barrage|wave of|waves of|dozens|hundreds|heavy|deadly|blasts?|explosions?|fatal)\b")
UP2 = re.compile(r"\b(nuclear (site|facility|plant)|enrichment|natanz|fordow|power plant|capital|refinery|oil terminal|energy infrastructure|hospital|airport)\b")
DOWN = re.compile(r"\b(minor|limited|small)\b")
SKIP = re.compile(r"\b(review|recipe|crossword|quiz|obituary|horoscope|podcast:|the week in pictures|sport)\b", re.I)
KINETIC = {"missile", "drone", "air", "naval", "ground"}
ACTION = re.compile(r"\b(strikes?|struck|attack(s|ed|ing)?|bomb(s|ed|ing)?|launch(es|ed)?|fire[sd]?|hits?|hit by|kill(s|ed|ing)?|dead|shell(s|ed|ing)|raid(s|ed)?|downs?|downed|shot down|shoots? down|intercept(s|ed)?|seiz(e|es|ed|ure)|clash(es|ed)?|fighting|explosions?|blasts?|pound(s|ed)|targets?|targeted|sinks?|sank|sunk|captur\w+|advance[sd]?|wounded|injured|assault|offensive|barrage|retaliat\w+|carr(y|ies|ied) out|blockade|boarded|destroy\w*|damag\w*|hitting|ablaze|on fire|shot dead)\b")
HYPO = re.compile(r"\b(could|would|may|might|ready to|threaten\w*|if necessary|vows? to|plans? to|consider\w*|warns?|prepar\w+ to|possible|options?)\b")
NATURAL = re.compile(r"\b(floods?|flooding|earthquake|quake|storms?|thunderstorms?|rain|wildfires?|heatwave|weather|landslide|collaps\w+|accident|crash(es|ed)?)\b")
ATTRITION = re.compile(r"\b(los(es|t)|toll|losses)\b")
SIDE_ALIASES = {
 "us-iran": {"A": [r"\bUS\b", r"\bU\.S\.", r"\bUSA\b", r"\bunited states\b", r"\bamerican?s?\b", r"\btrump\b", r"\bpentagon\b", r"\bhegseth\b", r"\bcentcom\b", r"\bwashington\b"],
             "B": [r"\biran(ian|ians)?\b", r"\btehran\b", r"\birgc\b", r"\brevolutionary guards?\b", r"\bkhamenei\b"]},
 "israel-gaza-lebanon": {"A": [r"\bisrael(i|is)?\b", r"\bidf\b", r"\bnetanyahu\b", r"\bsettlers?\b"],
             "B": [r"\bhamas\b", r"\bhezbollah\b", r"\bislamic jihad\b", r"\bmilitants?\b", r"\bpalestinian (gunm[ae]n|militants?|fighters?)\b"]},
 "russia-ukraine": {"A": [r"\bukrain(e|ian|ians)\b", r"\bkyiv\b", r"\bzelensk\w+\b"], "B": [r"\bruss(ia|ian|ians)\b", r"\bmoscow\b", r"\bputin\b", r"\bkremlin\b"]},
 "yemen-red-sea": {"A": [r"\bUS\b", r"\bU\.S\.", r"\bamerican?s?\b", r"\bsaudi\w*\b", r"\bisrael(i|is)?\b", r"\bcoalition\b", r"\buk\b"], "B": [r"\bhouthis?\b", r"\bansar allah\b", r"\byemen(i|is)?\b"]},
}
VERB = r"(?:'s|’s)?\s+(?:\S+\s+){0,3}?(strikes?|struck|attacks?|attacked|launch(?:es|ed)?|fires?|fired|bombs?|bombed|hits?|seiz(?:es|ed)|shoots?|shot down|downs|targets?|targeted|kills?|killed|carr(?:y|ies|ied) out|raids?|raided|shells?|shelled|pounds?|pounded|intercepts?|intercepted|missiles?|drones?|jets|warplanes|forces|troops|navy)\b"
OWNER = {"us-iran": {"B": ["iran"]}, "israel-gaza-lebanon": {"A": ["israel", "tel aviv", "haifa", "ashkelon", "ashdod", "sderot", "eilat", "beersheba", "dimona", "nevatim"], "B": ["gaza", "lebanon", "beirut", "dahiyeh", "tyre", "sidon", "nabatieh", "baalbek", "bekaa", "khan younis", "rafah", "jabalia"]},
         "russia-ukraine": {"A": ["ukraine", "kharkiv", "odesa", "dnipro", "zaporizhzhia", "lviv", "kyiv", "sumy", "kherson", "mykolaiv", "chernihiv", "poltava"], "B": ["russia", "moscow", "kursk", "belgorod", "bryansk", "rostov", "novorossiysk", "krasnodar", "voronezh", "engels", "saratov", "tuapse"]},
         "yemen-red-sea": {"B": ["yemen", "sanaa", "hodeidah", "saada", "ras isa", "marib"], "A": ["saudi arabia", "riyadh", "jizan", "eilat", "israel"]}}
IRAN_PLACES = {"natanz", "fordow", "isfahan", "bushehr", "bandar abbas", "qeshm", "kharg", "shiraz", "tabriz", "mashhad", "kermanshah", "ahvaz", "abadan", "chabahar", "arak", "parchin", "qom", "karaj", "hamadan", "khorramabad", "zahedan", "bandar lengeh", "jask", "kish island", "semnan", "yazd", "kerman", "urmia", "dezful", "south pars", "tehran"}
OWNER["us-iran"]["B"] += sorted(IRAN_PLACES)
GZ = sorted([(a, la, lo, k) for names, la, lo, k in G for a in names], key=lambda x: -len(x[0]))
GZRE = [(re.compile(r"(?<![\w-])" + re.escape(a) + r"(?![\w])", re.I), a, la, lo, k) for a, la, lo, k in GZ]
KRANK = {"place": 0, "sea": 1, "off": 2, "metro": 3, "country": 4}

def get(url, timeout=25):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': '*/*'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()

def clean(s):
    s = html.unescape(re.sub(r'<[^>]+>', ' ', s or ''))
    return re.sub(r'\s+', ' ', s).strip()

def parse_rss(raw):
    root = ET.fromstring(raw)
    out = []
    for it in root.iter():
        tag = it.tag.split('}')[-1]
        if tag not in ('item', 'entry'): continue
        d = {}
        for c in it:
            ct = c.tag.split('}')[-1]
            if ct == 'title': d['title'] = clean(c.text)
            elif ct == 'link': d['url'] = (c.text or c.get('href') or '').strip()
            elif ct in ('description', 'summary') and 'desc' not in d: d['desc'] = clean(c.text)
            elif ct in ('pubDate', 'date', 'published', 'updated') and 'ts' not in d:
                t = (c.text or '').strip()
                try: d['ts'] = email.utils.parsedate_to_datetime(t).timestamp()
                except Exception:
                    try:
                        from datetime import datetime
                        d['ts'] = datetime.fromisoformat(t.replace('Z', '+00:00')).timestamp()
                    except Exception: pass
        if d.get('title') and d.get('url') and d.get('ts'): out.append(d)
    return out

def norm_url(u):
    p = urllib.parse.urlsplit(u.strip())
    return urllib.parse.urlunsplit((p.scheme, p.netloc.lower(), p.path.rstrip('/'), '', ''))

def classify(title, desc):
    tl = title.lower(); dl = (desc or '').lower()
    typ = sev = None
    # diplomacy wins when the headline leads with it and has no strong kinetic verb
    if DIPLO_FIRST.search(tl) and not KINETIC_STRONG.search(tl):
        typ, sev = "diplomacy", 1
    else:
        for text in (tl, dl[:300]):
            for t, b, rx in TYPES:
                if re.search(rx, text): typ, sev = t, b; break
            if typ: break
    if not typ: return None, None
    if typ in KINETIC:
        thr = re.search(dict((t, rx) for t, b, rx in TYPES)["threat"], tl)
        if HYPO.search(tl) and not re.search(r"\b(after|amid|following)\b", tl): typ, sev = "threat", 1
        elif not ACTION.search(tl) or (ATTRITION.search(tl) and not KINETIC_STRONG.search(tl)): typ, sev = ("threat", 1) if thr else ("statement", 1)
    if typ != "diplomacy":
        if UP1.search(tl): sev += 1
        if typ in KINETIC and UP2.search(tl): sev += 1
        if DOWN.search(tl): sev -= 1
    return typ, max(1, min(5, sev))

def geocode(title, desc):
    best = None
    for src, text in ((0, title), (1, (desc or '')[:400])):
        for rx, a, la, lo, k in GZRE:
            m = rx.search(text)
            if m:
                cand = (src, KRANK[k], m.start(), a, la, lo, k)
                if best is None or cand[:3] < best[:3]: best = cand
        if best and best[0] == src and best[1] <= 1: break
    if not best: return None
    return {"name": best[3], "lat": best[4], "lon": best[5], "kind": best[6]}

def actor(tid, title):
    al = SIDE_ALIASES[tid]
    best = None
    for side, pats in al.items():
        for p in pats:
            flags = 0 if p in (r"\bUS\b", r"\bUSA\b", r"\buk\b") else re.I
            if p == r"\buk\b": p, flags = r"\bUK\b", 0
            for m in re.finditer(p + VERB, title, flags):
                pre = title[max(0, m.start() - 12):m.start()].lower()
                if re.search(r"\b(on|at|against|by|into|over|from|to)\s*$", pre): continue
                gap = len(m.group(0).split()) - 2
                if best is None or (gap, m.start()) < best[0]: best = ((gap, m.start()), side)
    # passive: "... by Iran" / "... from Iran"
    if not best:
        for side, pats in al.items():
            for p in pats:
                if re.search(r"\bby\s+(?:the\s+)?" + p.replace(r"\b", "", 1), title, 0 if p.startswith(r"\bU") else re.I):
                    return side
    return best[1] if best else None

def owner(tid, loc):
    if not loc: return None
    for side, names in OWNER.get(tid, {}).items():
        if loc["name"] in names: return side
    return None

def relevant(tid, text):
    tl = text.lower()
    return any(re.search(r"(?<!\w)" + re.escape(k) + r"(?!\w)", tl) for k in T[tid]["keywords"]["must"])

def sev_w(s): return [0, 1, 2, 4, 8, 16][s]

def main():
    items, status = [], []
    for name, url in FEEDS:
        try:
            got = parse_rss(get(url))
            for g in got: g['outlet'] = name
            items += got; status.append({"src": name, "url": url, "ok": True, "n": len(got)})
        except Exception as e:
            status.append({"src": name, "url": url, "ok": False, "err": str(e)[:80]})
    # GDELT (best effort; rate-limited to 1 request / 5 s)
    gd = {}
    # one combined request per run keeps us well inside GDELT's 1-request-per-5s limit
    GQ = {"all": '(Iran OR Tehran OR IRGC OR Hormuz OR Gaza OR Hezbollah OR Hamas OR Ukraine OR Kyiv OR Houthi OR Houthis OR "Red Sea") (strike OR missile OR drone OR attack OR ceasefire OR talks OR killed)'}
    for tid, q in (GQ.items() if not os.environ.get('GDELT_OFF') else []):
        u = 'https://api.gdeltproject.org/api/v2/doc/doc?' + urllib.parse.urlencode({'query': q + ' sourcelang:english', 'mode': 'artlist', 'format': 'json', 'maxrecords': '250', 'timespan': os.environ.get('GDELT_SPAN', '2d'), 'sort': 'datedesc'})
        try:
            j = json.loads(get(u, 40).decode('utf-8', 'replace'))
            arts = j.get('articles', [])
            for a in arts:
                sd = a.get('seendate', '')
                try: ts = time.mktime(time.strptime(sd, '%Y%m%dT%H%M%SZ')) - time.timezone
                except Exception: continue
                items.append({"title": clean(a.get('title')), "url": a.get('url', ''), "ts": ts, "desc": '', "outlet": a.get('domain', 'GDELT'), "via": "GDELT"})
            gd[tid] = len(arts)
        except Exception as e:
            gd[tid] = 'unavailable (' + str(e)[:40] + ')'
    status.append({"src": "GDELT DOC 2.0", "ok": all(isinstance(v, int) for v in gd.values()), "n": gd})
    index = {"updated": int(NOW), "theatres": [], "sources": status}
    for tid, th in T.items():
        path = os.path.join(ROOT, f'data/{tid}.json')
        old = json.load(open(path)) if os.path.exists(path) else {"events": []}
        ev = {e['id']: e for e in old['events'] if e['ts'] > NOW - KEEP_DAYS * 86400}
        for it in items:
            if it.get('hint') and it['hint'] != tid: continue
            if it['ts'] > NOW + 600 or it['ts'] < NOW - KEEP_DAYS * 86400: continue
            title = it['title']
            if SKIP.search(title): continue
            if NATURAL.search(title) and not KINETIC_STRONG.search(title): continue
            text = title + ' ' + it.get('desc', '')
            if not relevant(tid, title): continue
            nu = norm_url(it['url']); eid = hashlib.sha1(nu.encode()).hexdigest()[:12]
            if eid in ev: continue
            typ, sev = classify(title, it.get('desc', ''))
            if not typ: continue
            loc = geocode(title, it.get('desc', ''))
            act = actor(tid, title)
            tgt = owner(tid, loc)
            if not act and tgt and typ in KINETIC: act = 'B' if tgt == 'A' else 'A'
            ev[eid] = {"id": eid, "ts": int(it['ts']), "title": title[:220], "desc": (it.get('desc') or '')[:220], "url": it['url'],
                       "outlet": it['outlet'], "via": it.get('via', 'RSS'), "type": typ, "sev": sev, "actor": act, "loc": loc}
        evs = sorted(ev.values(), key=lambda e: -e['ts'])
        # cluster duplicate reports (same type, <12h apart, similar headline) so escalation counts each incident once
        def toks(s): return set(w for w in re.findall(r"[a-z]{4,}", s.lower()))
        for i, e in enumerate(evs):
            e['cid'] = e['id']; tk = toks(e['title'])
            for f in evs[max(0, i - 60):i]:
                if f['type'] == e['type'] and abs(f['ts'] - e['ts']) < 43200:
                    tf = toks(f['title'])
                    if tk and tf and len(tk & tf) / len(tk | tf) >= 0.34: e['cid'] = f['cid']; break
        def win(h):
            cl = {}
            for e in evs:
                if e['ts'] >= NOW - h * 3600: cl.setdefault(e['cid'], e)
            return list(cl.values())
        def score(es):
            return sum(sev_w(e['sev']) * (1 if e['type'] in KINETIC else 0.5 if e['type'] in ('deploy', 'threat', 'cyber', 'sanctions') else 0) for e in es)
        d1, d7 = win(24), win(168)
        s24, s7 = score(d1), score(d7) / 7
        json.dump({"id": tid, "events": evs}, open(path, 'w'), separators=(',', ':'), ensure_ascii=False)
        index['theatres'].append({"id": tid, "name": th['name'], "n24": len(d1), "n7": len(d7), "k24": sum(1 for e in d1 if e['type'] in KINETIC),
                                  "esc24": round(100 * (1 - math.exp(-s24 / 30))), "esc7": round(100 * (1 - math.exp(-s7 / 30))), "total": len(evs)})
    json.dump(index, open(os.path.join(ROOT, 'data/index.json'), 'w'), separators=(',', ':'), ensure_ascii=False)
    for t in index['theatres']: print(t)
    print('sources ok', sum(1 for s in status if s['ok']), '/', len(status), 'gdelt', gd)

if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Frontline data refresher. Pure rules, no AI. Fetches public RSS feeds (+ GDELT DOC API when it answers),
keeps items about each theatre, classifies them with fixed keyword rules, geocodes with a hand-built gazetteer,
groups reports of the same incident across outlets, and writes data/<theatre>.json, data/index.json, data/naval.json."""
import json, re, time, hashlib, html, os, sys, urllib.request, urllib.parse, email.utils, math
import xml.etree.ElementTree as ET
from datetime import datetime
sys.path.insert(0, os.path.dirname(__file__))
from gazetteer import G
ROOT = os.path.join(os.path.dirname(__file__), '..')
T = json.load(open(os.path.join(ROOT, 'geo/theatres.json')))
NOW = time.time()
KEEP_DAYS = 14
UA = 'Mozilla/5.0 (compatible; FrontlineTracker/1.0; +https://github.com/WajeehK/frontline)'
FEEDS = [
 ("Al Jazeera","https://www.aljazeera.com/xml/rss/all.xml"),
 ("Al Jazeera","https://www.aljazeera.com/news-sitemap.xml"),
 ("BBC News","https://feeds.bbci.co.uk/news/world/middle_east/rss.xml"),
 ("BBC News","https://feeds.bbci.co.uk/news/world/europe/rss.xml"),
 ("BBC News","https://feeds.bbci.co.uk/news/world/asia/rss.xml"),
 ("BBC News","https://feeds.bbci.co.uk/news/world/rss.xml"),
 ("The Guardian","https://www.theguardian.com/world/iran/rss"),
 ("The Guardian","https://www.theguardian.com/world/middleeast/rss"),
 ("The Guardian","https://www.theguardian.com/world/israel/rss"),
 ("The Guardian","https://www.theguardian.com/world/gaza/rss"),
 ("The Guardian","https://www.theguardian.com/world/lebanon/rss"),
 ("The Guardian","https://www.theguardian.com/world/yemen/rss"),
 ("The Guardian","https://www.theguardian.com/world/syria/rss"),
 ("The Guardian","https://www.theguardian.com/world/iraq/rss"),
 ("The Guardian","https://www.theguardian.com/world/ukraine/rss"),
 ("The Guardian","https://www.theguardian.com/world/russia/rss"),
 ("New York Times","https://rss.nytimes.com/services/xml/rss/nyt/MiddleEast.xml"),
 ("New York Times","https://rss.nytimes.com/services/xml/rss/nyt/Europe.xml"),
 ("New York Times","https://rss.nytimes.com/services/xml/rss/nyt/World.xml"),
 ("France 24","https://www.france24.com/en/middle-east/rss"),
 ("France 24","https://www.france24.com/en/europe/rss"),
 ("NPR","https://feeds.npr.org/1004/rss.xml"),
 ("CBS News","https://www.cbsnews.com/latest/rss/world"),
 ("ABC News","https://abcnews.go.com/abcnews/internationalheadlines"),
 ("PBS NewsHour","https://www.pbs.org/newshour/feeds/rss/world"),
 ("CBC News","https://www.cbc.ca/webfeed/rss/rss-world"),
 ("DW","https://rss.dw.com/rdf/rss-en-world"),
 ("Sky News","https://feeds.skynews.com/feeds/rss/world.xml"),
 ("Euronews","https://www.euronews.com/rss?format=mrss&level=theme&name=news"),
 ("Washington Times","https://www.washingtontimes.com/rss/headlines/news/world/"),
 ("Anadolu Agency","https://www.aa.com.tr/en/rss/default?cat=world"),
 ("Dawn","https://www.dawn.com/feeds/world"),
 ("Al-Monitor","https://www.al-monitor.com/rss"),
 ("Middle East Eye","https://www.middleeasteye.net/rss"),
 ("The National","https://www.thenationalnews.com/arc/outboundfeeds/rss/?outputType=xml"),
 ("Times of Israel","https://www.timesofisrael.com/feed/"),
 ("Jerusalem Post","https://www.jpost.com/rss/rssfeedsheadlines.aspx"),
 ("Ynet News","https://www.ynetnews.com/Integration/StoryRss3089.xml"),
 ("Mehr News (Iranian state media)","https://en.mehrnews.com/rss"),
 ("Press TV (Iranian state media)","https://www.presstv.ir/rss.xml"),
 ("Dawn","https://www.dawn.com/feeds/home"),
 ("Express Tribune","https://tribune.com.pk/feed/home"),
 ("The Hindu","https://www.thehindu.com/news/national/feeder/default.rss"),
 ("Times of India","https://timesofindia.indiatimes.com/rssfeeds/-2128936835.cms"),
 ("Hindustan Times","https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml"),
 ("The Guardian","https://www.theguardian.com/world/india/rss"),
 ("The Guardian","https://www.theguardian.com/world/pakistan/rss"),
 ("Focus Taiwan (CNA)","https://feeds.feedburner.com/rsscna/engnews"),
 ("Taipei Times","https://www.taipeitimes.com/xml/index.rss"),
 ("The Guardian","https://www.theguardian.com/world/taiwan/rss"),
 ("SCMP","https://www.scmp.com/rss/4/feed"),
 ("Yonhap","https://en.yna.co.kr/RSS/nk.xml"),
 ("Yonhap","https://en.yna.co.kr/RSS/news.xml"),
 ("NK News","https://www.nknews.org/feed/"),
 ("Korea Herald","https://www.koreaherald.com/rss/newsAll"),
 ("The Guardian","https://www.theguardian.com/world/north-korea/rss"),
 ("The Diplomat","https://thediplomat.com/feed/"),
 ("Kyiv Independent","https://kyivindependent.com/news-archive/rss/"),
 ("Ukrinform","https://www.ukrinform.net/rss/block-lastnews"),
 ("Ukrainska Pravda","https://www.pravda.com.ua/eng/rss/"),
 ("USNI News","https://news.usni.org/feed"),
 ("Breaking Defense","https://breakingdefense.com/feed/"),
 ("Defense News","https://www.defensenews.com/arc/outboundfeeds/rss/?outputType=xml"),
 ("The War Zone","https://www.twz.com/feed"),
 ("Military Times","https://www.militarytimes.com/arc/outboundfeeds/rss/?outputType=xml"),
]
GDELT_Q = '(Iran OR Tehran OR IRGC OR Hormuz OR Gaza OR Hezbollah OR Hamas OR Ukraine OR Kyiv OR Houthi OR Houthis OR "Red Sea") (strike OR missile OR drone OR attack OR ceasefire OR talks OR killed OR intercepted)'
# ---------------- classification rules (fixed; documented in the app's About tab)
TYPES = [  # (type, base severity, regex) - first match wins
 ("missile", 3, r"\b(missiles?|ballistic|cruise missile|rockets?|barrage|hypersonic|icbm|interceptors?|iron dome|air defen[cs]es?|iskanders?|kinzhals?)\b"),
 ("drone",   3, r"\b(drones?|uavs?|shaheds?|kamikaze|unmanned|loitering munitions?)\b"),
 ("air",     3, r"\b(air ?strikes?|strikes?|struck|bomb(s|ed|ing|ings|ers)?|warplanes?|fighter jets?|jets|air raids?|airstrike|blitz|pounded)\b"),
 ("naval",   2, r"\b(tankers?|warships?|vessels?|ships?|shipping|navy|naval|frigates?|destroyers?|aircraft carriers?|carrier strike|seiz(e|ed|es|ure)|blockade|maritime|mines?|minesweep\w*|boats?)\b"),
 ("ground",  2, r"\b(shelling|artillery|troops|offensive|ground (operation|assault|incursion)|clash(es|ed)?|gunfire|gunmen|shot dead|kill(s|ed|ing)?|raids?|incursion|advance[ds]?|captur\w+ (the )?(village|town|city|settlement|positions?)|assault|sniper|fighting|battle|dead|wounded|militants?|soldiers?|fighters?)\b"),
 ("cyber",   2, r"\b(cyber[- ]?attacks?|cyber|hack(ed|ers|ing)?)\b"),
 ("deploy",  2, r"\b(deploy(s|ed|ment|ing)?|evacuat\w+|reinforce\w*|mobili[sz]\w+|moves? aircraft|relocat\w+|redeploy\w*|stationed|build-?up|sends? (troops|ships|jets|carrier))\b"),
 ("diplomacy",1, r"\b(talks|ceasefire|cease-fire|truce|negotiat\w+|peace|diplomac\w+|diplomat\w*|envoy|summit|agreement|deal|accord|mediat\w+|inspections?|prisoner (swap|exchange)|hostages? (release|deal)|de-?escalat\w+|armistice)\b"),
 ("sanctions",1, r"\b(sanction\w*|embargo|tariffs?|oil prices?|asset freeze|export ban|blacklist\w*)\b"),
 ("threat",  1, r"\b(threat\w*|warns?|warning|vows?|ultimatum|retaliat\w+|revenge|escalat\w+|tensions?|on alert|high alert)\b"),
 ("statement",1, r"\b(war|military|conflict|nuclear|army|forces|weapons?|pentagon|irgc|idf|defen[cs]e minister|commander)\b"),
]
TRX = dict((t, rx) for t, b, rx in TYPES)
TORD = ["mine", "missile", "drone", "air", "naval", "ground", "blast", "cyber", "deploy", "legal", "diplomacy", "sanctions", "threat", "statement"]
DIPLO_FIRST = re.compile(r"\b(ceasefire|truce|peace talks|talks|negotiat\w+|deal)\b")
KINETIC_STRONG = re.compile(r"\b(strikes?|struck|attack(s|ed)?|bomb\w*|missiles?|drones?|killed|shelling|raid)\b")
UP1 = re.compile(r"\b(killed|kills|dead|deaths?|death toll|casualt\w+|wounded|injured|destroy\w*|massive|barrage|wave of|waves of|dozens|hundreds|heavy|deadly|blasts?|explosions?|fatal)\b")
UP2 = re.compile(r"\b(nuclear (site|facility|plant)|enrichment|natanz|fordow|power plant|capital|refinery|oil terminal|energy infrastructure|hospital|airport)\b")
DOWN = re.compile(r"\b(minor|limited|small)\b")
SKIP = re.compile(r"\b(review|recipe|crossword|quiz|obituary|horoscope|podcast|the week in pictures|in pictures|sport|football|cricket|tennis)\b", re.I)
OPINION = re.compile(r"(\s\|\s|^opinion\b|^analysis\b|^explainer\b|^what is\b|^what are\b|^why\b|^how\b|^who is\b|^could\b|^will\b|^is\b|^letters?\b|\bexplained\b|\?$)", re.I)
NATURAL = re.compile(r"\b(floods?|flooding|earthquake|quake|storms?|thunderstorms?|rain|wildfires?|heatwave|weather|landslide|collaps\w+|accident|crash(es|ed)?)\b")
ATTRITION = re.compile(r"\b(los(es|t)|toll|losses)\b")
ACTION = re.compile(r"\b(strikes?|struck|attack(s|ed|ing)?|bomb(s|ed|ing)?|launch(es|ed)?|fire[sd]?|hits?|hit by|kill(s|ed|ing)?|dead|shell(s|ed|ing)|raid(s|ed)?|downs?|downed|shot down|shoots? down|intercept(s|ed)?|seiz(e|es|ed|ure)|clash(es|ed)?|fighting|explosions?|blasts?|pound(s|ed)|targets?|targeted|sinks?|sank|sunk|captur\w+|advance[sd]? (on|into|towards?)|wounded|injured|assault|offensive|barrage|retaliat\w+|carr(y|ies|ied) out|blockade|boarded|destroy\w*|damag\w*|hitting|ablaze|on fire|shot dead)\b")
CAPAB = re.compile(r"\b(able to|capab\w+|develop\w*|build(s|ing)?|produc\w+|unveil\w*|showcas\w+|parades?|exercises?|drills?|manufactur\w+)\b")
HYPO = re.compile(r"\b(unlikely|rules? out|ruled out|no plans? to|could|would|may|might|ready to|ready for|seeks?|seeking|response to|threaten\w*|if necessary|vows? to|plans? to|consider\w*|warns?|prepar\w+ to|possible|options?|weighs?)\b")
INTERCEPT = re.compile(r"\b(intercept(s|ed|ing|ion|ions)?|shot down|shoots? down|downs|downed|air defen[cs]es? (destroy|down)\w*|neutrali[sz]ed)\b", re.I)
KINETIC = {"missile", "drone", "air", "naval", "ground", "mine"}
SIDE_ALIASES = {
 "us-iran": {"A": [r"\bUS\b", r"\bU\.S\.", r"\bUSA\b", r"\bunited states\b", r"\bamerican?s?\b", r"\btrump\b", r"\bpentagon\b", r"\bhegseth\b", r"\bcentcom\b", r"\bwashington\b"],
             "B": [r"\biran(ian|ians)?\b", r"\btehran\b", r"\birgc\b", r"\brevolutionary guards?\b", r"\bkhamenei\b"]},
 "israel-gaza-lebanon": {"A": [r"\bisrael(i|is)?\b", r"\bidf\b", r"\bnetanyahu\b", r"\bsettlers?\b"],
             "B": [r"\bhamas\b", r"\bhezbollah\b", r"\bislamic jihad\b", r"\bmilitants?\b", r"\bpalestinian (gunm[ae]n|militants?|fighters?)\b"]},
 "russia-ukraine": {"A": [r"\bukrain(e|ian|ians)\b", r"\bkyiv\b", r"\bzelensk\w+\b", r"\bADF\b", r"\bair force\b"], "B": [r"\bruss(ia|ian|ians)\b", r"\bmoscow\b", r"\bputin\b", r"\bkremlin\b"]},
 "pakistan-india": {"A": [r"\bindia(n|ns)?\b", r"\bnew delhi\b", r"\bmodi\b", r"\bIAF\b"], "B": [r"\bpakistan(i|is)?\b", r"\bislamabad\b", r"\brawalpindi\b", r"\bPAF\b", r"\bISI\b"]},
 "china-taiwan": {"A": [r"\btaiwan(ese)?\b", r"\btaipei\b", r"\bROC\b", r"\bjapan(ese)?\b", r"\bUS\b", r"\bU\.S\.", r"\bphilippines?\b"], "B": [r"\bchin(a|ese)\b", r"\bbeijing\b", r"\bPLA\b", r"\bPRC\b", r"\bxi\b"]},
 "koreas": {"A": [r"\bsouth korea(n|ns)?\b", r"\bseoul\b", r"\bROK\b", r"\bUS\b", r"\bU\.S\.", r"\bJCS\b"], "B": [r"\bnorth korea(n|ns)?\b", r"\bpyongyang\b", r"\bDPRK\b", r"\bkim jong un\b", r"\bkim yo jong\b"]},
 "venezuela-guyana": {"A": [r"\bguyan(a|ese)\b", r"\bUS\b", r"\bU\.S\.", r"\bamerican?s?\b", r"\btrump\b", r"\bpentagon\b", r"\bhegseth\b", r"\bsouthcom\b"], "B": [r"\bvenezuel(a|an|ans)\b", r"\bmaduro\b", r"\bcaracas\b"]},
 "yemen-red-sea": {"A": [r"\bUS\b", r"\bU\.S\.", r"\bamerican?s?\b", r"\bsaudi\w*\b", r"\bisrael(i|is)?\b", r"\bcoalition\b", r"\bUK\b"], "B": [r"\bhouthis?\b", r"\bansar allah\b", r"\byemen(i|is)?\b"]},
}
CASE = {r"\bUS\b", r"\bUSA\b", r"\bUK\b", r"\bADF\b", r"\bIAF\b", r"\bPAF\b", r"\bISI\b", r"\bROC\b", r"\bPLA\b", r"\bPRC\b", r"\bROK\b", r"\bJCS\b", r"\bDPRK\b"}
VERB = r"(?:'s|’s)?\s+(?:\S+\s+){0,3}?(strikes?|struck|attacks?|attacked|launch(?:es|ed)?|fires?|fired|bombs?|bombed|hits?|seiz(?:es|ed)|shoots?|shot down|downs|downed|targets?|targeted|kills?|killed|carr(?:y|ies|ied) out|raids?|raided|shells?|shelled|pounds?|pounded|intercepts?|intercepted|missiles?|drones?|jets|warplanes|forces|troops|navy)\b"
WEAPON_ADJ = r"(?:'s|’s)?\s+(?:\S+\s+){0,1}?(missiles?|drones?|rockets?|shaheds?|uavs?|projectiles?|warplanes?|jets?)\b"
OWNER = {"us-iran": {"B": ["iran"]}, "israel-gaza-lebanon": {"A": ["israel", "tel aviv", "haifa", "ashkelon", "ashdod", "sderot", "eilat", "beersheba", "dimona", "nevatim", "jerusalem"], "B": ["gaza", "gaza city", "lebanon", "beirut", "dahiyeh", "tyre", "sidon", "nabatieh", "baalbek", "bekaa", "khan younis", "rafah", "jabalia", "deir al-balah", "nuseirat", "beit lahia", "beit hanoun", "southern lebanon", "bint jbeil"]},
         "russia-ukraine": {"A": ["ukraine", "kharkiv", "odesa", "dnipro", "zaporizhzhia", "lviv", "kyiv", "sumy", "kherson", "mykolaiv", "chernihiv", "poltava", "kramatorsk", "sloviansk", "kryvyi rih", "vinnytsia", "zhytomyr", "cherkasy", "ternopil", "rivne", "lutsk", "khmelnytskyi", "ivano-frankivsk", "uzhhorod", "kropyvnytskyi", "izmail"], "B": ["russia", "moscow", "kursk", "belgorod", "bryansk", "rostov", "novorossiysk", "krasnodar", "voronezh", "engels", "saratov", "tuapse", "taganrog", "volgograd", "kaluga", "tula", "oryol", "lipetsk", "tambov", "ryazan", "smolensk", "yeysk", "sochi"]},
         "pakistan-india": {"A": ["india", "new delhi", "srinagar", "jammu", "amritsar", "pahalgam", "mumbai", "pathankot", "poonch", "rajouri", "uri", "kupwara", "baramulla", "jammu and kashmir"], "B": ["pakistan", "islamabad", "lahore", "rawalpindi", "karachi", "muzaffarabad", "bahawalpur", "muridke", "sialkot", "kotli", "azad kashmir", "pakistan-administered kashmir", "peshawar", "quetta"]},
         "china-taiwan": {"A": ["taiwan", "taipei", "kaohsiung", "kinmen", "matsu", "penghu", "taichung", "hualien", "keelung", "pratas"], "B": ["china", "beijing", "fujian", "fuzhou", "xiamen", "shanghai", "pingtan"]},
         "koreas": {"A": ["south korea", "seoul", "busan", "incheon", "yeonpyeong", "paju", "camp humphreys", "osan"], "B": ["north korea", "pyongyang", "yongbyon", "punggye-ri", "sohae", "wonsan", "kaesong", "sinpo", "hamhung"]},
         "venezuela-guyana": {"A": ["guyana", "georgetown", "essequibo", "stabroek"], "B": ["venezuela", "caracas", "maracaibo", "puerto cabello", "la orchila", "ciudad guayana", "sucre", "falcon"]},
         "yemen-red-sea": {"B": ["yemen", "sanaa", "hodeidah", "saada", "ras isa", "marib", "taiz"], "A": ["saudi arabia", "riyadh", "jizan", "eilat", "israel", "medina", "jeddah", "mecca"]}}
IRAN_PLACES = {"natanz", "fordow", "isfahan", "bushehr", "bandar abbas", "qeshm", "kharg", "shiraz", "tabriz", "mashhad", "kermanshah", "ahvaz", "abadan", "chabahar", "arak", "parchin", "qom", "karaj", "hamadan", "khorramabad", "zahedan", "bandar lengeh", "jask", "kish island", "semnan", "yazd", "kerman", "urmia", "dezful", "south pars", "tehran"}
OWNER["us-iran"]["B"] += sorted(IRAN_PLACES)
GZ = sorted([(a, la, lo, k) for names, la, lo, k in G for a in names], key=lambda x: -len(x[0]))
GZRE = [(re.compile(r"(?<![\w-])" + re.escape(a) + r"(?![\w])", re.I), a, la, lo, k) for a, la, lo, k in GZ]
SPEAKER = re.compile(r"^\s*(?:'s|’s)?\s+(says?|said|accuses?|accused|blames?|blamed|warns?|warned|claims?|claimed|denies|denied|announces?|announced|urges?|urged|vows?|insists?|rejects?|condemns?|calls?|tells?|told|confirms?|reports?)\b", re.I)
STOP = set("the a an and or of to in on at for from with by as is are was were be been has have had that this it its into over after amid says said say new more than about against near up out off will could would may might not no his her their they he she we us".split())
SHIP_RX = re.compile(r"\bUSS ([A-Z][\w.]*(?: [A-Z][\w.]*){0,3})")
PREP_RX = r"\b(?:in|into|to|toward|towards|near|off|entered|entering|transited|transiting|through|from)\s+(?:the\s+)?"

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
            elif ct == 'link': d['url'] = (c.text or c.get('href') or '').strip() or d.get('url', '')
            elif ct in ('description', 'summary') and 'desc' not in d: d['desc'] = clean(c.text)
            elif ct == 'encoded': d['body'] = clean(c.text)[:6000]
            elif ct in ('pubDate', 'date', 'published', 'updated') and 'ts' not in d:
                t = (c.text or '').strip()
                try: d['ts'] = email.utils.parsedate_to_datetime(t).timestamp()
                except Exception:
                    try: d['ts'] = datetime.fromisoformat(t.replace('Z', '+00:00')).timestamp()
                    except Exception: pass
        if d.get('title') and d.get('url') and d.get('ts'): out.append(d)
    return out

LIVE_PREFIX = re.compile(r"^[^:]{2,60}\b(live|updates|latest|live updates):\s*", re.I)
def parse_sitemap(raw):
    """Google News sitemap (published for crawlers and allowed by robots.txt): headline, URL and date only. Live-blog
    entries carry the blog's current top headline; we keep that headline only and never fetch the blog page."""
    import html as H
    out = []
    for u in re.findall(rb"<url>(.*?)</url>", raw, re.S):
        u = u.decode('utf-8', 'replace')
        loc = re.search(r"<loc>(.*?)</loc>", u); t = re.search(r"<news:title>(.*?)</news:title>", u, re.S); d = re.search(r"<news:publication_date>(.*?)</news:publication_date>", u)
        if not (loc and t and d): continue
        title = clean(H.unescape(re.sub(r"<!\[CDATA\[|\]\]>", "", t.group(1))))
        try: ts = datetime.fromisoformat(d.group(1).strip().replace('Z', '+00:00')).timestamp()
        except Exception: continue
        url = loc.group(1).strip(); live = '/liveblog/' in url
        if live:
            title = LIVE_PREFIX.sub('', title).strip(); ts = max(ts, time.time() - 60)  # a live-blog headline is "new" when we first see it
        if '/video/' in url or len(title) < 15: continue
        out.append({"title": title, "url": url, "ts": ts, "desc": "", "live": live})
    return out
def parse_any(raw): return parse_sitemap(raw) if b"<urlset" in raw[:2000] else parse_rss(raw)

def norm_url(u):
    p = urllib.parse.urlsplit(u.strip())
    return urllib.parse.urlunsplit((p.scheme, p.netloc.lower(), p.path.rstrip('/'), '', ''))

def classify_base(title, desc):
    tl = title.lower(); dl = (desc or '').lower()
    typ = sev = None
    if OPINION.search(title.strip()):
        return ("statement", 1) if re.search(TRX["statement"] + "|" + TRX["threat"] + "|" + TRX["diplomacy"], tl) or KINETIC_STRONG.search(tl) else (None, None)
    if DIPLO_FIRST.search(tl) and not KINETIC_STRONG.search(tl):
        typ, sev = "diplomacy", 1
    else:
        for text in (tl, dl[:300]):
            for t, b, rx in TYPES:
                if re.search(rx, text): typ, sev = t, b; break
            if typ: break
    if not typ: return None, None
    if typ in KINETIC:
        thr = re.search(TRX["threat"], tl)
        if HYPO.search(tl) and not re.search(r"\b(after|amid|following)\b", tl): typ, sev = "threat", 1
        elif CAPAB.search(tl) and not re.search(r"\b(struck|launched|fired|killed|hit|attacked|bombed|downed|intercepted)\b", tl): typ, sev = "statement", 1
        elif not ACTION.search(tl) or (ATTRITION.search(tl) and not KINETIC_STRONG.search(tl)): typ, sev = ("threat", 1) if thr else ("statement", 1)
    if typ != "diplomacy":
        if UP1.search(tl): sev += 1
        if typ in KINETIC and UP2.search(tl): sev += 1
        if DOWN.search(tl): sev -= 1
    return typ, max(1, min(5, sev))

# ---- v9 accuracy gate: kinetic types need a completed action + an explicit actor; plots, arrests, claims and commentary never animate as strikes
LEGAL = re.compile(r"\b(plot(s|ted|ting)?|accus(e|es|ed|ing)|charg(e|es|ed|ing)|arrest\w*|indict\w*|convict\w*|sentenc\w*|trial|court|prosecut\w*|detain\w*|extradit\w*|espionage|spying|lawsuit)\b", re.I)
SPEECH_VETO = re.compile(r"\b(feared|until|deadline|to (strike|attack|bomb|hit|invade|nuke)|could|would|may|might|calls? (for|on)|asking for|urg(e|es|ed|ing)|wants?|demands?|predicts?|expects?|warns?|threatens?|vows?|plans?|considering|weighs?|mulls?|prepar\w+|options?|scenario|if)\b", re.I)
COMPLETED = re.compile(r"\b(strike|attack|kill|bomb|shell|batter\w*|pummel\w*|hammer(s|ed)?|torch\w*|set fire|burn(ed|s|t)|clash(es|ed)?|fighting|battles?|struck|strikes|hit|hits|hitting|bombed|bombs|bombing|launched|launches|fired|fires|killed|kills|killing|intercepted|intercepts|shot down|shoots down|downed|downs|destroyed|destroys|attacked|attacks|sank|sinks|sunk|seized|seizes|exploded|explosions?|blasts?|caught fire|catch(es)? fire|ablaze|pounded|pounds|shelled|shells|raided|raids|targeted|targets|captured|captures|wounded|injured|dead)\b", re.I)
MINE = re.compile(r"\b(sea |naval |)mines?\b.*\b(hit|hits|hitting|struck|strikes|explod\w*|blast|caught fire|catch(es)? fire|damag\w*|sank|sunk)\b|\b(hit|hits|hitting|struck|strikes)\b.{0,30}\bmines?\b", re.I)
SEA_INCIDENT = re.compile(r"\b(tankers?|vessels?|ships?|cargo ship|bulk carrier|warships?|frigates?|destroyers?|boats?)\b.{0,60}\b(caught fire|catch(es)? fire|ablaze|explosion|blast|hit|hits|struck|damaged|attacked|seized|sank|sunk|boarded)\b", re.I)
BLAST = re.compile(r"\b(explosions?|blasts?|loud bangs?|sirens?)\b", re.I)
LOWREL = {"zerohedge.com", "zerohedge", "infowars.com", "thegatewaypundit.com", "naturalnews.com", "globalresearch.ca", "activistpost.com", "beforeitsnews.com", "veteranstoday.com", "southfront.org", "tass.com", "sputnikglobe.com", "rt.com", "presstv.ir", "mehrnews.com"}
COMMENTARY = re.compile(r"\b(says|said|claims?|opinion|op-?ed|column|commentary|analysis|podcast|interview|according to)\b", re.I)
DEPLOYISH = re.compile(r"\b(sends?|sent|dispatch\w*|detect\w*|track(s|ed)|spott\w*|sorties?|incursions?|median line|patrol\w*|drills?|exercises?|encircl\w*|blockade drills?|deploy\w*|transit\w*|sail(s|ed)|flew|fly|flies|buzz\w*)\b", re.I)
LOWREL_KEYS = ('zerohedge', 'infowars', 'gatewaypundit', 'naturalnews', 'globalresearch', 'activistpost', 'beforeitsnews', 'veteranstoday', 'southfront', 'thefreethoughtproject', 'sott.net')
def low_rel(outlet): o = (outlet or '').lower(); return any(k in o for k in LOWREL_KEYS)
def classify(title, desc, outlet=None):
    typ, sev = classify_base(title, desc)
    if not typ: return typ, sev
    tl = title
    if typ in ("statement", "threat") and DEPLOYISH.search(tl) and not SPEECH_VETO.search(tl) and not OPINION.search(tl) and any(re.search(TRX[k], tl, re.I) for k in ("air", "naval", "missile", "drone")): return "deploy", 2
    if LEGAL.search(tl) and not re.search(r"\b(killed|struck|bombed|launched|intercepted|shot down)\b", tl, re.I): return "legal", 1
    if typ in KINETIC or typ == "naval":
        if "?" in tl or tl.lstrip()[:1] in "'\"‘“": return "statement", 1  # questions and quotes are commentary
        if MINE.search(tl): return "mine", max(3, sev)
        if SEA_INCIDENT.search(tl) and not SPEECH_VETO.search(tl): return "naval", max(2, sev)
        if not SPEECH_VETO.search(tl) and DEPLOYISH.search(tl) and not COMPLETED.search(tl): return "deploy", 2
        if SPEECH_VETO.search(tl) or not COMPLETED.search(tl): return ("threat", 1) if re.search(TRX["threat"] + r"|\b(strike|attack|war)\b", tl, re.I) else ("statement", 1)
    if low_rel(outlet) and typ in KINETIC | {"mine", "naval"}: return ("threat", 1) if SPEECH_VETO.search(tl) else ("statement", 1)
    return typ, sev

UNKNOWN_REGION = re.compile(r"\b([A-Z][a-z]+(?:-[A-Z][a-z]+)?) (Oblast|region|province|governorate|district)\b")
def geocode(tid, title, desc, kinetic=True):
    w, s, e, n = T[tid]['bbox']
    if not kinetic or UNKNOWN_REGION.search(title): desc = ''
    desc = (desc or '')[:200]
    def rank(la, lo, k):
        inside = w <= lo <= e and s <= la <= n
        if k in ('place', 'sea'): return (0 if k == 'place' else 1) if inside else 2
        if k == 'off': return 2
        if k == 'metro': return 3 if inside else 4
        return 5 if inside else 6
    best = None
    for src, text in ((0, title), (1, (desc or '')[:400])):
        for rx, a, la, lo, k in GZRE:
            for m in rx.finditer(text):
                if SPEAKER.match(text[m.end():m.end() + 40]): continue  # "Paris says…" is a speaker, not a location
                pre = text[max(0, m.start() - 3):m.start()]
                r = rank(la, lo, k)
                if src == 1 and r > 1: continue  # descriptions only contribute specific places inside the map
                cand = (src, r, m.start(), a, la, lo, k)
                if best is None or cand[:3] < best[:3]: best = cand
                break
        if best and best[0] == 0 and best[1] <= 2: break
    if not best: return None
    return {"name": best[3], "lat": best[4], "lon": best[5], "kind": best[6]}

def _alias_rx(p): return (p, 0) if p in CASE else (p, re.I)

def actor(tid, title):
    al = SIDE_ALIASES[tid]; best = None
    for side, pats in al.items():
        for p0 in pats:
            p, fl = _alias_rx(p0)
            for m in re.finditer(p + VERB, title, fl):
                pre = title[max(0, m.start() - 12):m.start()].lower()
                if re.search(r"\b(on|at|against|by|into|over|from|to)\s*$", pre): continue
                gap = len(m.group(0).split()) - 2
                if best is None or (gap, m.start()) < best[0]: best = ((gap, m.start()), side)
    if not best:
        for side, pats in al.items():
            for p0 in pats:
                p, fl = _alias_rx(p0)
                if re.search(r"\bby\s+(?:the\s+)?" + p.replace(r"\b", "", 1), title, fl): return side
    return best[1] if best else None

ICP_VERB = r"(?:'s|’s)?\s+(?:\S+\s+){0,3}?(intercepts?|intercepted|shoots? down|shot down|downs|downed|neutrali[sz]ed|repel(?:s|led)?)\b"
def interceptor(tid, title):
    best = None
    for side, pats in SIDE_ALIASES[tid].items():
        for p0 in pats:
            p, fl = _alias_rx(p0)
            for m in re.finditer(p + ICP_VERB, title, fl):
                if best is None or m.start() < best[0]: best = (m.start(), side)
    return best[1] if best else None

def launcher(tid, title):
    """Side whose weapons are named ("Russian drones", "Houthi missiles")."""
    for side, pats in SIDE_ALIASES[tid].items():
        for p0 in pats:
            p, fl = _alias_rx(p0)
            if re.search(p + WEAPON_ADJ, title, fl): return side
    return None

def owner(tid, loc):
    if not loc: return None
    for side, names in OWNER.get(tid, {}).items():
        if loc["name"] in names: return side
    return None

def relevant(tid, text):
    tl = text.lower()
    has = lambda ks: any(re.search(r"(?<!\w)" + re.escape(k) + r"(?!\w)", tl) for k in ks)
    kw = T[tid]["keywords"]
    return has(kw.get("must", [])) or (bool(kw.get("pair")) and all(has(g) for g in kw["pair"]))

def sev_w(s): return [0, 1, 2, 4, 8, 16][s]
def toks(s):
    out = set()
    for w in re.findall(r"[a-z0-9']{3,}", s.lower().replace('’', "'")):
        w = w.replace("'s", "")
        if w in STOP: continue
        for suf in ('ing', 'ed', 'es', 's'):
            if len(w) > 5 and w.endswith(suf): w = w[:-len(suf)]; break
        out.add(w)
    return out
def km(a, b):
    return 111 * math.hypot(a['lat'] - b['lat'], (a['lon'] - b['lon']) * math.cos(math.radians(a['lat'])))

def summ(m):
    """Feed summary without the repeated headline, trimmed (headline + summary only; never full articles)."""
    d, t = (m.get('desc') or '').strip(), (m.get('title') or '').strip()
    if d.lower().startswith(t.lower()[:40]): d = d[len(t):].strip(" -–—:|·")
    for o in (m.get('outlet') or '',):
        if o and d.lower().endswith(o.lower()): d = d[:-len(o)].strip(" -–—:|·")
    return d[:280] if len(d) > 25 else ''

def cluster(evs):
    """Group reports of the same incident: within 12h, compatible location, and similar headline."""
    cl = []
    for e in sorted(evs, key=lambda e: e['ts']):
        tk = toks(e['title']); best = None
        for c in cl[-80:]:
            if abs(c['ts'] - e['ts']) > 43200: continue
            la, lb = c['loc'], e['loc']
            if la and lb and la['kind'] in ('place', 'sea') and lb['kind'] in ('place', 'sea') and km(la, lb) > 120: continue
            inter = len(tk & c['_tk']); jac = inter / max(1, len(tk | c['_tk']))
            same_place = la and lb and la['name'] == lb['name']
            kin_pair = (e['type'] in KINETIC) == (c['type'] in KINETIC)
            ok = jac >= 0.34 or (inter >= 3 and same_place and kin_pair) or (inter >= 4 and kin_pair)
            if ok and (best is None or jac > best[0]): best = (jac, c)
        if best: c = best[1]; c['_m'].append(e); c['_tk'] |= tk
        else: c = {'ts': e['ts'], 'loc': e['loc'], 'type': e['type'], '_m': [e], '_tk': set(tk)}; cl.append(c)
        # re-derive the incident's fields from all members
        ms = c['_m']
        kin = [m for m in ms if m['type'] in KINETIC]
        pool = kin or ms
        cnt = {}
        for m in pool: cnt[m['type']] = cnt.get(m['type'], 0) + 1
        c['type'] = max(cnt, key=lambda t: (cnt[t], -TORD.index(t)))
        same = [m for m in pool if m['type'] == c['type']]
        sv = sorted(m['sev'] for m in same); c['sev'] = sv[len(sv) // 2] if len(sv) > 2 else sv[-1]
        locs = [m['loc'] for m in ms if m['loc']]
        if locs:
            kr = {"place": 0, "sea": 1, "metro": 2, "off": 3, "country": 4}
            c['loc'] = sorted(locs, key=lambda l: (kr.get(l["kind"], 5), -sum(1 for x in locs if x['name'] == l['name'])))[0]
        for f in ('actor', 'atk', 'icp'):
            vals = [m.get(f) for m in ms if m.get(f)]
            c[f] = max(set(vals), key=vals.count) if vals else None
        c['men'] = sorted(set(x for m in ms for x in (m.get('men') or [])))
        c['ts'] = min(m['ts'] for m in ms)
    out = []
    for c in cl:
        ms = sorted(c['_m'], key=lambda m: m['ts'])
        lead = next((m for m in ms if m['type'] == c['type']), ms[0])
        cid = ms[0]['id']
        for m in ms: m['cid'] = cid
        outlets = []
        for m in ms:
            if not any(o['outlet'] == m['outlet'] for o in outlets): outlets.append({"outlet": m['outlet'], "url": m['url'], "title": m['title'], "ts": m['ts'], "via": m.get('via', 'RSS'), "desc": (m.get('desc') or '')[:200]})
        out.append({"cid": cid, "ts": c['ts'], "last": ms[-1]['ts'], "type": c['type'], "sev": c['sev'], "actor": c['actor'], "atk": c['atk'], "icp": c['icp'], "men": c['men'],
                    "loc": c['loc'], "title": lead['title'], "url": lead['url'], "outlet": lead['outlet'], "n": len(ms), "outlets": outlets,
                    "desc": next((d for d in (summ(m) for m in [lead] + ms) if d), ''), "lowrel": 1 if all(m.get('lowrel') for m in ms) else 0})
    return sorted(out, key=lambda c: -c['ts'])

def naval_reports(items, old):
    """Publicly REPORTED ship locations from article text: 'USS X ... in the Red Sea'. Never live AIS."""
    seas = [(rx, a, la, lo, k) for rx, a, la, lo, k in GZRE if k in ('sea', 'place', 'off')]
    rep = {r['ship'] + '|' + r['url']: r for r in old if r['ts'] > NOW - 21 * 86400}
    for it in items:
        text = ' '.join(x for x in (it['title'], it.get('desc', ''), it.get('body', '')) if x)
        if 'USS ' not in text: continue
        for sent in re.split(r'(?<=[.!?])\s+', text):
            for m in SHIP_RX.finditer(sent):
                ship = 'USS ' + re.sub(r"\s*\(.*$", '', m.group(1)).strip(' .,')
                ship = re.sub(r"\s+(Carrier|Strike|Group|CSG|ARG|Amphibious|And|In|Is|Was|Has|The)\b.*$", '', ship)
                tail = sent[m.end():m.end() + 160]
                best = None
                for rx, a, la, lo, k in seas:
                    mm = re.search(PREP_RX + re.escape(a) + r"(?![\w])", tail, re.I)
                    if mm and (best is None or mm.start() < best[0]): best = (mm.start(), a, la, lo)
                if not best: continue
                key = ship + '|' + it['url']
                if key in rep: continue
                rep[key] = {"ship": ship, "where": best[1], "lat": best[2], "lon": best[3], "ts": int(it['ts']), "url": it['url'], "outlet": it['outlet'],
                            "quote": sent.strip()[:220]}
    latest = {}
    for r in sorted(rep.values(), key=lambda r: r['ts']): latest[r['ship']] = r
    names = list(latest)
    for n in names:  # drop truncated names ("USS George" when "USS George Washington" exists)
        if any(o != n and o.startswith(n + ' ') for o in names): latest.pop(n, None)
    return sorted(latest.values(), key=lambda r: -r['ts'])

def make_event(tid, it):
    """One feed item -> (eid, event) for a theatre; event None = drop; returns None when irrelevant. Shared by live.py."""
    title = it['title']
    if SKIP.search(title): return None
    if NATURAL.search(title) and not KINETIC_STRONG.search(title): return None
    if not relevant(tid, title): return None
    nu = norm_url(it['url']); eid = hashlib.sha1(nu.encode()).hexdigest()[:12]
    if '/liveblog/' in nu: eid = hashlib.sha1((nu + '|' + title).encode()).hexdigest()[:12]  # each live-blog headline is its own report
    typ, sev = classify(title, it.get('desc', ''), it.get('outlet'))
    if not typ: return eid, None
    loc = geocode(tid, title, it.get('desc', ''), typ in KINETIC)
    act = actor(tid, title); lnc = launcher(tid, title)
    if typ in ("missile", "drone", "air", "ground") and not (act or lnc or (INTERCEPT.search(title) and interceptor(tid, title))):
        typ, sev = ("blast", max(1, sev - 1)) if COMPLETED.search(title) and not NATURAL.search(title) else ("statement", 1)  # completed action but nobody named: shown as an unattributed incident, not a side's strike
    tgt = owner(tid, loc)
    icp = None; atk = None
    if INTERCEPT.search(title) and typ in KINETIC:
        ic = interceptor(tid, title)
        if lnc and lnc != ic: atk = lnc; icp = ic or ('B' if lnc == 'A' else 'A')
        elif ic: icp = ic; atk = 'B' if ic == 'A' else 'A'
        elif act: atk = act; icp = 'B' if act == 'A' else 'A'
        elif tgt: icp = tgt; atk = 'B' if tgt == 'A' else 'A'
    elif typ in KINETIC:
        atk = act or lnc or (('B' if tgt == 'A' else 'A') if tgt else None)
    if not act: act = atk if typ in KINETIC else None
    men = sorted(side for side, pats in SIDE_ALIASES[tid].items() if any(re.search(*_alias_rx(p0)[:1], title, _alias_rx(p0)[1]) for p0 in pats))
    return eid, {"id": eid, "ts": int(it['ts']), "title": title[:220], "desc": (it.get('desc') or '')[:220], "url": it['url'],
               "outlet": it['outlet'], "via": it.get('via', 'RSS'), "lowrel": 1 if low_rel(it['outlet']) else 0, "type": typ, "sev": sev, "actor": act, "atk": atk, "icp": icp, "men": men, "loc": loc}

# ---- coverage sentiment (fixed lexicon, no AI): escalatory vs de-escalatory wording in recent headlines
ESC_W = re.compile(r"\b(strikes?|struck|airstrikes?|attack(s|ed|ing)?|retaliat\w*|escalat\w*|missiles?|drones?|bomb\w*|kill(s|ed|ing)?|dead|deaths?|invad\w*|invasion|offensive|threat(s|en\w*)?|warn(s|ed|ing)?|war|wars|mobili[sz]\w*|shell(s|ed|ing)|assault\w*|raids?|clash(es|ed)?|revenge|ultimatum|seiz\w*|explosions?|blasts?|launch(es|ed)?|fire[sd]?|intercept\w*|casualt\w*|wounded|injur\w*|sanction\w*|hostil\w*|bombard\w*|siege)\b", re.I)
DE_W = re.compile(r"\b(talks?|ceasefire|cease-fire|truce|peace|negotiat\w*|deal|agreements?|diplomac\w*|diplomat\w*|dialogue|de-?escalat\w*|calm|restraint|releas\w*|exchanges?|humanitarian|aid|mediat\w*|summit|withdraw\w*|pause[sd]?|reopen\w*|accords?|envoys?|meet(s|ing)?|met|reconcil\w*|handover|resum\w*)\b", re.I)
NEG_DE = re.compile(r"\b(reject\w*|collaps\w*|fail\w*|stall\w*|break(s|ing)? down|broke down|violat\w*|suspend\w*|walk(s|ed)? out|call(s|ed)? off|no deal|end(s|ed)? (the )?(truce|ceasefire))\b", re.I)
def tone_lex(title):
    e = len(ESC_W.findall(title)); d = len(DE_W.findall(title))
    if d and NEG_DE.search(title): e, d = e + d, 0  # "talks collapse", "rejects ceasefire" read as escalatory
    if not e and not d: return None
    return (e - d) / (e + d)
def sentiment(evs, t0, t1):
    sc = [x for x in (tone_lex(e['title']) for e in evs if t0 <= e['ts'] < t1) if x is not None]
    n_all = sum(1 for e in evs if t0 <= e['ts'] < t1)
    return (round(sum(sc) / len(sc), 3) if sc else None), len(sc), n_all
def gdelt_tone(th):
    q = '(' + ' OR '.join(('"%s"' % k if ' ' in k else k) for k in th['keywords']['must'][:10]) + ') sourcelang:english'
    u = 'https://api.gdeltproject.org/api/v2/doc/doc?' + urllib.parse.urlencode({'query': q, 'mode': 'timelinetone', 'format': 'json', 'timespan': '24h'})
    j = json.loads(get(u, 30).decode('utf-8', 'replace'))
    vals = [d['value'] for s in j.get('timeline', []) for d in s.get('data', []) if d.get('value') not in (None, 0)]
    return (round(sum(vals) / len(vals), 2), len(vals)) if vals else None

def main():
    items, status = [], []
    for name, url in FEEDS:
        try:
            got = parse_any(get(url))
            for g in got: g['outlet'] = name
            items += got; status.append({"src": name, "url": url, "ok": True, "n": len(got)})
        except Exception as e:
            status.append({"src": name, "url": url, "ok": False, "err": str(e)[:80]})
    gd = 'off'
    if not os.environ.get('GDELT_OFF'):
        u = 'https://api.gdeltproject.org/api/v2/doc/doc?' + urllib.parse.urlencode({'query': GDELT_Q + ' sourcelang:english', 'mode': 'artlist', 'format': 'json', 'maxrecords': '250', 'timespan': os.environ.get('GDELT_SPAN', '1d'), 'sort': 'datedesc'})
        for attempt in range(3):
            try:
                j = json.loads(get(u, 40).decode('utf-8', 'replace'))
                arts = j.get('articles', [])
                for a in arts:
                    try: ts = datetime.strptime(a.get('seendate', ''), '%Y%m%dT%H%M%SZ').replace(tzinfo=__import__('datetime').timezone.utc).timestamp()
                    except Exception: continue
                    items.append({"title": clean(a.get('title')), "url": a.get('url', ''), "ts": ts, "desc": '', "outlet": a.get('domain', 'GDELT'), "via": "GDELT"})
                gd = len(arts); break
            except Exception as e:
                gd = 'unavailable (' + str(e)[:40] + ')'; time.sleep(12)
    status.append({"src": "GDELT DOC 2.0", "ok": isinstance(gd, int), "n": gd})
    index = {"updated": int(NOW), "theatres": [], "sources": status}
    try: old_ix = {t['id']: t for t in json.load(open(os.path.join(ROOT, 'data/index.json'))).get('theatres', [])}
    except Exception: old_ix = {}
    tids = list(T); rot = tids[int(NOW // 900) % len(tids)]  # one GDELT tone call per run, rotating theatres
    for tid, th in T.items():
        path = os.path.join(ROOT, f'data/{tid}.json')
        old = json.load(open(path)) if os.path.exists(path) else {"events": []}
        ev = {e['id']: e for e in old['events'] if e['ts'] > NOW - KEEP_DAYS * 86400}
        if os.environ.get('RECLASSIFY'):  # re-run the current rules over stored history
            for e in ev.values(): e['_re'] = True
        for it in list(items) + [dict(e, desc=e.get('desc', '')) for e in ev.values() if e.get('_re')]:
            if it['ts'] > NOW + 600 or it['ts'] < NOW - KEEP_DAYS * 86400: continue
            nu = norm_url(it['url']); eid0 = hashlib.sha1(nu.encode()).hexdigest()[:12]
            if eid0 in ev and not ev[eid0].get('_re'): continue
            r = make_event(tid, it)
            if r is None: continue
            eid, e1 = r
            if e1 is None: ev.pop(eid, None)
            else: ev[eid] = e1
        for e in ev.values(): e.pop('_re', None)
        evs = sorted(ev.values(), key=lambda e: -e['ts'])
        cls = cluster(evs)
        def win(h): return [c for c in cls if c['ts'] >= NOW - h * 3600]
        def score(es):
            return sum(sev_w(e['sev']) * (1 if e['type'] in KINETIC else 0.5 if e['type'] in ('deploy', 'threat', 'cyber', 'sanctions', 'blast') else 0) for e in es)
        d1, d7 = win(24), win(168)
        s24, s7 = score(d1), score(d7) / 7
        json.dump({"id": tid, "events": evs, "clusters": cls}, open(path, 'w'), separators=(',', ':'), ensure_ascii=False)
        gt = (old_ix.get(tid, {}).get('sent') or {}).get('gdelt')
        if tid == rot and not os.environ.get('GDELT_OFF'):
            try:
                r = gdelt_tone(th)
                if r: gt = {"tone": r[0], "n": r[1], "at": int(NOW)}
            except Exception as e: print('gdelt tone', tid, str(e)[:60])
        if gt and NOW - gt.get('at', 0) > 6 * 3600: gt = None
        lx, nsc, nall = sentiment(cls, NOW - 86400, NOW + 600); lxp, nscp, _ = sentiment(cls, NOW - 2 * 86400, NOW - 86400)  # one headline per incident
        def comb(l):
            if l is None: return None
            if gt: g = max(-1, min(1, -(gt['tone'] + 3) / 3)); return round(.75 * l + .25 * g, 3)
            return l
        sent = {"score": comb(lx), "prev": comb(lxp), "lex": lx, "n": nsc, "n_all": nall, "n_prev": nscp, "gdelt": gt}
        index['theatres'].append({"id": tid, "kind": th.get('kind', 'conflict'), "sent": sent, "name": th['name'], "n24": len(d1), "n7": len(d7), "k24": sum(1 for e in d1 if e['type'] in KINETIC),
                                  "esc24": round(100 * (1 - math.exp(-s24 / 30))), "esc7": round(100 * (1 - math.exp(-s7 / 30))), "total": len(cls)})
    npath = os.path.join(ROOT, 'data/naval.json')
    try: oldn = json.load(open(npath)).get('reports', [])
    except Exception: oldn = []
    nav = naval_reports(items, oldn)
    json.dump({"updated": int(NOW), "reports": nav}, open(npath, 'w'), separators=(',', ':'), ensure_ascii=False)
    json.dump(index, open(os.path.join(ROOT, 'data/index.json'), 'w'), separators=(',', ':'), ensure_ascii=False)
    for t in index['theatres']: print(t)
    print('naval reports', len(nav), [(r['ship'], r['where']) for r in nav[:8]])
    print('sources ok', sum(1 for s in status if s['ok']), '/', len(status), 'gdelt', gd)

if __name__ == '__main__':
    main()

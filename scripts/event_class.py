#!/usr/bin/env python3
"""Confirmed-event + animation-type classifier (keyword and tense rules, no AI).

A headline may be shown in the feed even when it is speculative, but only a
confirmed reported event (something that happened or is happening) is allowed
an on-map animation. Speculative wording — "weighs options", "considers",
"warns", "threatens", "could", "may", talks, statements, analysis — gets
anim='none'.

Used by fetch.py (writes `confirmed` and `anim` onto each event) and by the
unit tests in test_event_class.py. The client ports the same rules so already
stored headlines are classified even before the next refresh.
"""
from __future__ import annotations
import re

# Speculative / non-event: intent, options, warnings, conditionals, commentary.
SPECULATIVE = re.compile(
    r"\b("
    r"weighs?|weighing|consider(?:s|ed|ing)?|mulls?|mulling|"
    r"options?|optionally|"
    r"could|would|may|might|should|"
    r"warns?|warning|threatened|threatens?|"
    r"vows?|vow(?:ed|ing)|"
    r"plans? to|planning to|prepar(?:e|es|ed|ing) to|ready to|ready for|"
    r"seeks?|seeking|calls? (?:for|on)|urg(?:e|es|ed|ing)|"
    r"wants?|demands?|asks? (?:for|to)|"
    r"predicts?|expects?|expected to|likely to|"
    r"possible|possibility|potential(?:ly)?|hypothetical|"
    r"scenario|in case|if necessary|"
    r"to (?:strike|attack|bomb|hit|invade|launch|target)"
    r")\b",
    re.I,
)

# These do not, on their own, make a kinetic report speculative when a
# completed action is clearly the main clause ("after talks, Israel struck").
CONTEXT_OK = re.compile(r"\b(after|amid|following|in the wake of|despite)\b", re.I)

# Completed or unfolding action (journalistic present included: "US strikes").
COMPLETED = re.compile(
    r"\b("
    r"struck|strikes|striking|hit|hits|hitting|"
    r"attacked|attacks|attacking|attack|"
    r"bombed|bombs|bombing|"
    r"shelled|shells|shelling|pounded|pounds|"
    r"launched|launches|launching|fired|fires|firing|"
    r"killed|kills|killing|wounded|injured|dead|"
    r"intercepted|intercepts|intercepting|intercept|"
    r"shot down|shoots down|shooting down|downed|downs|"
    r"captured|captures|capturing|seized|seizes|seizing|boarded|boards|"
    r"destroyed|destroys|destroying|damaged|damages|"
    r"exploded|explodes|explosion|explosions|blasts?|"
    r"ablaze|caught fire|catch(?:es)? fire|"
    r"sank|sinks|sunk|raided|raids|"
    r"agreed|agrees|agree|signed|signs|takes effect|took effect|declared|declares|"
    r"advanc(?:e|es|ed|ing)|deployed|deploys|clashed|clashes|fighting|"
    r"hacked|hacks|breached|breaches"
    r")\b",
    re.I,
)

COMMENTARY = re.compile(
    r"(\b(analysis|opinion|op-?ed|explainer|column|commentary|podcast|editorial)\b"
    r"|\?$|^\s*(what|why|how|who is|could|will|is)\b)",
    re.I,
)
QUOTED = re.compile(r"^\s*['\"‘“]")
DENIAL = re.compile(r"\b(denies|denied|deny|false|fake|no evidence|hoax|debunk\w*|rumou?rs?)\b", re.I)

CEASEFIRE = re.compile(
    r"\b(cease[- ]?fire|truce|armistice)\b.*\b(agreed|agrees|agree|signed|signs|takes effect|took effect|declared|declares|announced|announces|reached|in effect|holds|held)\b"
    r"|\b(agreed|agrees|agree|signed|signs|declared|announced|reached)\b.*\b(cease[- ]?fire|truce|armistice)\b",
    re.I,
)
DRONE = re.compile(r"\b(drones?|uavs?|shaheds?|unmanned (?:aerial )?vehicles?|loitering munitions?)\b", re.I)
CAPTURE = re.compile(r"\b(captured|captures|capturing|shot down|shoots down|downed|downs|intercepted|intercepts|intercept|forced down|force down|forced landing|recovered|secures?|secured)\b", re.I)
TANKER = re.compile(r"\b(tankers?|oil tankers?|crude carriers?|merchant (?:ship|vessel)s?|cargo ships?|bulk carriers?)\b", re.I)
SHIP = re.compile(r"\b(ships?|vessels?|boats?|warships?|frigates?|destroyers?)\b", re.I)
SEIZE = re.compile(r"\b(seized|seizes|seizing|seizure|boarded|boards|boarding|impounded|detained at sea)\b", re.I)
MISSILE = re.compile(r"\b(missiles?|ballistic|cruise missile|rockets?|hypersonic|icbm|iskanders?|kinzhals?)\b", re.I)
AIR = re.compile(r"\b(air ?strikes?|airstrikes?|air raids?|warplanes?|fighter jets?|\bjets\b|bombers?)\b", re.I)
ARTY = re.compile(r"\b(artillery|shelling|howitzers?|grad |mlrs|rocket barrage|pounded|pounds)\b", re.I)
TROOP = re.compile(r"\b(troops?|convoy|soldiers?|ground (?:forces|offensive|assault|incursion)|advanc(?:e|es|ed|ing)|deploy(?:s|ed|ment)|mobili[sz]\w+)\b", re.I)
CYBER = re.compile(r"\b(cyber[- ]?attacks?|\bcyber\b|hack(?:ed|ers|ing)?|data breach)\b", re.I)
NUKE_SITE = re.compile(r"\b(nuclear (?:site|facility|plant|reactor|complex)|enrichment|natanz|fordow|bushehr|zaporizhzhia nuclear|dimona)\b", re.I)
FACILITY = re.compile(
    r"\b(bases?|air ?bases?|airfields?|facilit(?:y|ies)|refiner(?:y|ies)|depots?|ports?|"
    r"headquarters|\bhq\b|barracks|installations?|compounds?|plants?|terminals?|"
    r"power station|substations?|radar)\b",
    re.I,
)
BLAST = re.compile(r"\b(explosions?|blasts?|blew up|blows up)\b", re.I)

# Types that are never animated on their own.
NO_ANIM_TYPES = {"statement", "threat", "legal", "sanctions", "diplomacy"}


def is_speculative(title: str) -> bool:
    t = (title or "").strip()
    if not t:
        return True
    if COMMENTARY.search(t) or DENIAL.search(t) or QUOTED.search(t):
        return True
    if SPECULATIVE.search(t) and not (CONTEXT_OK.search(t) and COMPLETED.search(t)):
        return True
    return False


def is_confirmed(title: str, typ: str | None = None) -> bool:
    t = (title or "").strip()
    if not t or is_speculative(t):
        return False
    if typ == "diplomacy" and CEASEFIRE.search(t):
        return True
    if typ in ("cyber", "deploy") and COMPLETED.search(t):
        return True
    if typ in NO_ANIM_TYPES:
        return False
    return bool(COMPLETED.search(t))


def anim_of(title: str, typ: str | None = None) -> str:
    """Return the animation id, or 'none'."""
    t = title or ""
    if not is_confirmed(t, typ):
        return "none"
    if CEASEFIRE.search(t):
        return "ceasefire"
    if DRONE.search(t) and CAPTURE.search(t):
        return "drone_capture"
    if SEIZE.search(t) and (TANKER.search(t) or SHIP.search(t)):
        return "seizure"
    if TANKER.search(t) and (COMPLETED.search(t) or BLAST.search(t)):
        return "tanker"
    if NUKE_SITE.search(t) and (COMPLETED.search(t) or BLAST.search(t)):
        return "nuclear_site"
    if MISSILE.search(t):
        return "missile"
    if AIR.search(t):
        return "air"
    if DRONE.search(t):
        return "drone"
    if ARTY.search(t):
        return "artillery"
    if typ == "cyber" or CYBER.search(t):
        return "cyber"
    if typ == "deploy" or (TROOP.search(t) and typ in ("deploy", "ground", None, "naval")):
        return "troop"
    if typ == "ground" or ARTY.search(t):
        return "artillery" if ARTY.search(t) else "troop"
    if (FACILITY.search(t) or typ == "blast") and (BLAST.search(t) or COMPLETED.search(t)):
        return "facility"
    if typ == "naval":
        return "tanker" if TANKER.search(t) else "seizure" if SEIZE.search(t) else "blast"
    if typ == "mine":
        return "tanker" if TANKER.search(t) else "blast"
    if typ in ("missile", "drone", "air", "ground", "blast"):
        return {"ground": "artillery"}.get(typ, typ)
    if BLAST.search(t):
        return "blast"
    return "none"


def annotate(title: str, typ: str | None = None) -> dict:
    anim = anim_of(title, typ)
    return {"confirmed": anim != "none", "anim": anim}


if __name__ == "__main__":
    import json, sys
    title = " ".join(sys.argv[1:]) or sys.stdin.read()
    typ = None
    print(json.dumps(annotate(title, typ), indent=2))

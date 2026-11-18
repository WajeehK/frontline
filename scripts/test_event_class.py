#!/usr/bin/env python3
"""Unit tests for the confirmed-event classifier (keyword + tense rules)."""
import unittest
from event_class import annotate, is_confirmed, anim_of, is_speculative

# (headline, expected_anim or 'none', note)
CASES = [
    # --- speculative / non-event: NO animation ---
    ("Israel weighs options on striking Iran", "none"),
    ("Israel considers strikes on Iranian nuclear sites", "none"),
    ("Iran warns it may strike first before another US attack", "none"),
    ("Tehran threatens to close the Strait of Hormuz", "none"),
    ("US could launch airstrikes on Iran, officials say", "none"),
    ("Israel might attack Hezbollah in Lebanon", "none"),
    ("Pentagon plans to deploy more troops to the Gulf", "none"),
    ("Officials say a ceasefire could be agreed this week", "none"),
    ("Analysis: why a wider war may still be avoided", "none"),
    ("What would a US strike on Fordow look like?", "none"),
    ("Iran vows revenge after the killing of a commander", "none"),
    ("Washington warns Tehran against further attacks", "none"),
    ("Talks on a possible truce are expected to resume", "none"),
    ("Israel is preparing to strike Hamas leadership, report says", "none"),
    ("UK ready to join US action against the Houthis", "none"),
    ("Opinion: the West should not bomb Iran", "none"),
    ("Iran denies it struck a US base in Iraq", "none"),

    # --- confirmed events: curated animation ---
    ("US drone shot down over Tehran, IRGC says", "drone_capture"),
    ("IRGC captures American surveillance drone in Iranian airspace", "drone_capture"),
    ("Coalition forces intercept and force down a Houthi drone", "drone_capture"),
    ("Ukraine shoots down a Russian Shahed drone over Kyiv", "drone_capture"),

    ("Oil tanker hit by a missile in the Red Sea, ship ablaze", "tanker"),
    ("Houthi attack strikes a commercial tanker off Yemen", "tanker"),
    ("Cargo ship damaged after explosion in the Gulf of Aden", "tanker"),

    ("Iranian navy seizes an oil tanker in the Strait of Hormuz", "seizure"),
    ("Houthi fighters boarded and seized a commercial vessel", "seizure"),

    ("Ballistic missile strikes a base in Erbil", "missile"),
    ("Russia launched a barrage of missiles at Kyiv", "missile"),
    ("Rockets hit a town in northern Israel", "missile"),

    ("US airstrike hits an IRGC facility near Kermanshah", "air"),
    ("Israeli jets bombed a compound in southern Lebanon", "air"),

    ("Ukraine says a Russian drone struck a power plant", "drone"),
    ("Shahed drones attack a port in Odesa", "drone"),

    ("Artillery shelling kills civilians in Kharkiv", "artillery"),
    ("Russian guns pounded the front line near Pokrovsk", "artillery"),

    ("Russian troops advance on the town of Pokrovsk", "troop"),
    ("US deploys a carrier strike group to the Gulf", "troop"),

    ("Explosion at the Natanz nuclear facility", "nuclear_site"),
    ("Airstrike hits Iran's Fordow enrichment site", "nuclear_site"),

    ("Cyberattack hits Iranian infrastructure", "cyber"),
    ("Hackers breached a Ukrainian power utility", "cyber"),

    ("Israel and Hamas agree a ceasefire in Gaza", "ceasefire"),
    ("Ceasefire takes effect in Lebanon after overnight talks", "ceasefire"),
    ("Ukraine and Russia signed a truce, officials said", "ceasefire"),

    ("Explosion at an army ammunition depot near Isfahan", "facility"),
    ("Missile strike destroys a radar site in Bahrain", "missile"),

    # after/amid should still allow a completed action
    ("After weeks of talks, Israel struck a Hezbollah depot in Lebanon", "facility"),
    ("Amid warnings from Tehran, US jets bombed a militia site in Iraq", "air"),
]


class EventClassTest(unittest.TestCase):
    def test_cases(self):
        failed = []
        for title, expect in CASES:
            got = annotate(title)["anim"]
            if got != expect:
                failed.append(f"  {title!r}\n    expected {expect!r}, got {got!r} (confirmed={is_confirmed(title)})")
        if failed:
            self.fail("classifier mismatches:\n" + "\n".join(failed))

    def test_speculative_flag(self):
        self.assertTrue(is_speculative("Israel weighs options on striking Iran"))
        self.assertFalse(is_speculative("US airstrike hits an IRGC facility near Kermanshah"))

    def test_annotate_shape(self):
        a = annotate("US drone shot down over Tehran")
        self.assertEqual(set(a), {"confirmed", "anim"})
        self.assertTrue(a["confirmed"])
        self.assertEqual(a["anim"], "drone_capture")
        b = annotate("Israel weighs options on striking Iran")
        self.assertFalse(b["confirmed"])
        self.assertEqual(b["anim"], "none")


if __name__ == "__main__":
    unittest.main()

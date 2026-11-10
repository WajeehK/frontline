# Frontline — live conflict tracker

A 3D "battlefield" view of real-world conflicts (default: US vs Iran; also Israel · Gaza · Lebanon, Russia vs Ukraine, Yemen · Red Sea).
Every animation is triggered by a real published news report and every feed item links to its source. Animations are symbolic.

* **Data:** public RSS feeds (Al Jazeera, BBC, Guardian, NYT, France 24, NPR, CBS, PBS, DW, Sky, Middle East Eye, Times of Israel, Jerusalem Post, Kyiv Independent, Ukrinform, Ukrainska Pravda, The National) plus the GDELT 2.0 DOC API when it isn't rate-limited.
* **Processing:** `scripts/fetch.py` (Python stdlib). Fixed keyword rules decide type, severity and the acting side; a hand-built gazetteer (`scripts/gazetteer.py`) geocodes. No AI is used.
* **Refresh:** `.github/workflows/refresh.yml` runs every ~15 min, commits `data/*.json` when new events appear, and deploys GitHub Pages.
* **Map:** terrain from AWS Terrain Tiles (Terrarium) and borders from Natural Earth (world-atlas), baked by `scripts/bake_geo.py`. Built with three.js.

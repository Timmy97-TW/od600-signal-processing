# OD600 signal processing — ReLeaf (GEMS-Taiwan iGEM 2026)

How the arithmetic inside a photometer changes an OD600 reading, an audit of our own inline
photometer, and a four-day protocol that measures those biases with 1 µm silica microspheres.

**Live page:** https://timmy97-tw.github.io/od600-signal-processing/ (中文 / English toggle)

| Path | What it is |
|---|---|
| `index.html`, `app.js` | The page. Built output; edit `src/` and run `python3 build.py`. |
| `src/index.src.html` | Page source. Bilingual strings are written `{{中文||English}}`. |
| `src/references.html` | Reference list (each entry checked against its source page). |
| `data/site_data.json` | Data behind the real-data figures: the 434 h run (down-sampled), reference-count histogram, the 19 Sept 2026 silica titration. |
| `analysis/replay_algorithms.py` | Replays one raw data set through eight reduction algorithms. `--selftest` runs on synthetic data. |
| `PREREGISTRATION.md` | Algorithm list, metrics and decision rule, to be frozen before data collection. |

## What is established and what is not
Established from our own logs and code: the reference channel sat at about 32 counts in the 434 h run
(0.067 OD per count at a path factor of 5; 91.5 % of readings on an integer count; 26 of 29 count
changes between 40 and 230 h came with an OD jump above 0.04), and the firmware's MAD gate has a
floor of 1e-6, which makes it return the mode on quantised data.

Not yet measured: everything marked "to do" in section 07 of the page. The interactive figures in
section 03 are simulations and derivations — predictions, not results.

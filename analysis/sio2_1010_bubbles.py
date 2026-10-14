#!/usr/bin/env python3
"""Bubble test (2026-10-10, after the n = 40 step; tube raised to the liquid surface by hand).

Cycle classes, from the logged data only:
  clean   - valid, within 0.03 OD of the unit's clean level
  bubble  - burst-level disturbance (firmware flag 'bubbles', or valid but off-level with within-burst scatter)
  slug    - the cell holds air: a steady reading far below the clean level that the firmware accepts as valid
Only t < 280 s is used: after that the inlet draws air continuously and no liquid level exists.
"""
import json
import sys
import numpy as np
import pandas as pd
sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
from sio2_1010_common import D, EST, OUT

T_END = 280
FILES = {"V1": "V1_complete_bubble.csv", "V2": "V2_fiber_bubble.csv"}
R = {}
allrows = []
for u, f in FILES.items():
    d = pd.read_csv(D / f)
    d = d[d.elapsed_s < T_END].copy()
    clean_lvl = {e: d.loc[(d.valid == 1) & (d.bubble_frac_pct == 0), "od_" + e].median() for e in EST}
    ref = clean_lvl["mad"]
    # an air slug: reading below 60 % of the clean level for every estimator, firmware calls it valid
    slug = (d[["od_" + e for e in EST]].max(axis=1) < 0.6 * ref + 0.1 * (u == "V1")) & (d.valid == 1)
    slug = (d[["od_" + e for e in EST]].max(axis=1) < (ref - 0.2 if u == "V2" else 1.2)) & (d.valid == 1)
    clean = (d.valid == 1) & ~slug & ((d.od_mad - ref).abs() < 0.03)
    d["cls"] = np.where(slug, "slug", np.where(clean, "clean", "bubble"))
    d["unit"] = u
    allrows.append(d)
    res = {"clean_level": clean_lvl, "n_cycles": len(d), "counts": d.cls.value_counts().to_dict(),
           "flag_catches_bubble": float((d[d.cls == "bubble"].valid == 0).mean()),
           "flag_catches_slug": float((d[d.cls == "slug"].valid == 0).mean()) if slug.any() else None,
           "slug_od_mad": [float(d[slug].od_mad.min()), float(d[slug].od_mad.max())] if slug.any() else None}
    b = d[d.cls == "bubble"]
    per = {}
    for e in EST:
        err = b["od_" + e] - clean_lvl[e]
        per[e] = dict(mean=err.mean(), median_abs=err.abs().median(), rmse=np.sqrt((err ** 2).mean()),
                      sd=b["od_" + e].std(), within_005=(err.abs() <= 0.05).mean(), within_02=(err.abs() <= 0.2).mean(),
                      frac_low=(err < -0.05).mean(), frac_high=(err > 0.05).mean())
    res["bubble_cycles"] = per
    R[u] = res

    # Temporal layer at the bioreactor cadence (30 s = every 6th cycle), all six phase offsets,
    # over the liquid-present part of the window (clean + bubble cycles, slugs excluded and reported apart).
    tl = {}
    live = d[d.cls != "slug"]
    for e in EST:
        out = {"raw": [], "gate": [], "med3": [], "gate+med3": []}
        for ph in range(6):
            s = live.iloc[ph::6]
            x = s["od_" + e].values
            v = s.valid.values.astype(bool)
            lvl = clean_lvl[e]
            out["raw"] += list(x - lvl)
            held, last = [], lvl
            for xi, vi in zip(x, v):
                last = xi if vi else last
                held.append(last)
            held = np.array(held)
            out["gate"] += list(held - lvl)
            m3 = pd.Series(x).rolling(3, min_periods=1).median().values
            out["med3"] += list(m3 - lvl)
            g3 = pd.Series(held).rolling(3, min_periods=1).median().values
            out["gate+med3"] += list(g3 - lvl)
        tl[e] = {k: dict(rmse=float(np.sqrt(np.mean(np.square(v)))), max_abs=float(np.max(np.abs(v))),
                         within_005=float(np.mean(np.abs(v) <= 0.05))) for k, v in out.items()}
    R[u]["cadence30s"] = tl

pd.concat(allrows).to_csv(OUT / "bubble_cycles.csv", index=False)

# H6: SD(upper) <= 1/2 SD(mad) on bubble cycles; H7: mad/qn/biweight SDs within 2x, means within 0.05
for u in FILES:
    bc = R[u]["bubble_cycles"]
    R[u]["H6"] = dict(sd_upper=bc["upper"]["sd"], sd_mad=bc["mad"]["sd"], pass_=bc["upper"]["sd"] <= 0.5 * bc["mad"]["sd"])
    sds = [bc[e]["sd"] for e in ("mad", "qn", "biweight")]
    ms = [bc[e]["mean"] for e in ("mad", "qn", "biweight")]
    R[u]["H7"] = dict(sd_ratio=max(sds) / min(sds), mean_span=max(ms) - min(ms),
                      pass_=max(sds) / min(sds) <= 2 and max(ms) - min(ms) <= 0.05)
json.dump(R, open(OUT / "bubbles.json", "w"), indent=1, default=float)

if __name__ == "__main__":
    for u in FILES:
        r = R[u]
        print(f"== {u}  clean level (mad) {r['clean_level']['mad']:.3f}  classes {r['counts']}  "
              f"flag catches bubble {r['flag_catches_bubble']:.0%}  slug {r['flag_catches_slug']}  slug od {r['slug_od_mad']}")
        print(pd.DataFrame(r["bubble_cycles"]).T.round(3).to_string())
        print("  H6", {k: (round(v, 3) if isinstance(v, float) else v) for k, v in r["H6"].items()},
              " H7", {k: (round(v, 3) if isinstance(v, float) else v) for k, v in r["H7"].items()})
        print("  30-s cadence, liquid-present cycles: RMSE / within 0.05")
        for e in EST:
            print(f"   {e:9s}", "  ".join(f"{k}: {v['rmse']:.3f}/{v['within_005']:.0%}" for k, v in r["cadence30s"][e].items()))

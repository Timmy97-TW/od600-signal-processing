#!/usr/bin/env python3
"""Collect everything the 10/10 Results view draws into data/results_1010.json.
Run after sio2_1010_plateaus / _calibration / _bubbles / _pipeline / _burst_sign."""
import json
import sys
import numpy as np
import pandas as pd
sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
from sio2_1010_common import EST, OUT, ROOT, UNITS, unit
import sio2_1010_pipeline as PL

r3 = lambda a, d=4: [None if (v is None or (isinstance(v, float) and np.isnan(v))) else round(float(v), d) for v in a]
J = {k: json.load(open(OUT / f"{k}.json")) for k in ("calibration", "bubbles", "pipeline", "burst_sign")}
p = pd.read_csv(OUT / "plateaus.csv")
ok = p[p.n > 0]

clean = {}
for u in UNITS:
    piv = ok[ok.unit == u].pivot_table(index="n", columns="est", values="od_ownblank")
    clean[u] = {"n": [int(v) for v in piv.index], **{e: r3(piv[e] - piv["mad"], 4) for e in EST}}
noise = ok.pivot_table(index="est", columns="unit", values="noise", aggfunc="median").loc[EST]
H5 = {u: {e: float((ok[ok.unit == u].pivot_table(index="n", columns="est", values="od_ownblank")[e] -
                    ok[ok.unit == u].pivot_table(index="n", columns="est", values="od_ownblank")["mad"]).abs().max()) for e in EST} for u in UNITS}

b = pd.read_csv(OUT / "bubble_cycles.csv")
bub = {}
for u in UNITS:
    d = b[b.unit == u]
    s = d.iloc[0::6].reset_index(drop=True)                       # one 30-s phase for the replay figure
    lvl = J["bubbles"][u]["clean_level"]["mad"]
    bub[u] = {"t": r3(d.elapsed_s, 1), **{e: r3(d["od_" + e], 3) for e in EST}, "valid": [int(v) for v in d.valid],
              "cls": list(d.cls), "level": lvl,
              "r_t": r3(s.elapsed_s, 1), "r_P0": r3(PL.pipeline(s, "P0"), 3), "r_P4": r3(PL.pipeline(s, "P4", init=lvl), 3)}

# V1 air event in the main run, and the V2 light drop at 12:50-13:00
ev = {}
d1 = unit("V1")
w = d1[(d1.timestamp_iso >= "2026-10-10 11:04") & (d1.timestamp_iso < "2026-10-10 11:28")].reset_index(drop=True)
s = w.iloc[0::6].reset_index(drop=True)
t0 = pd.Timestamp("2026-10-10 11:04")
ev["V1_air"] = {"t": r3((w.timestamp_iso - t0).dt.total_seconds() / 60, 3), "mad": r3(w.od_mad, 3), "valid": [int(v) for v in w.valid],
                "r_t": r3((s.timestamp_iso - t0).dt.total_seconds() / 60, 3), "r_P0": r3(PL.pipeline(s, "P0"), 3),
                "r_P4": r3(PL.pipeline(s, "P4", init=float(w.od_mad.iloc[0])), 3), "t0_utc": "11:04"}
d2 = unit("V2")
w = d2[(d2.timestamp_iso >= "2026-10-10 12:44") & (d2.timestamp_iso < "2026-10-10 13:04")].reset_index(drop=True)
t0 = pd.Timestamp("2026-10-10 12:44")
ev["V2_light"] = {"t": r3((w.timestamp_iso - t0).dt.total_seconds() / 60, 3), "dual": r3(w.od_dual, 4), "single": r3(w.od_single, 4),
                  "ref": r3(w.lux_ref / w.lux_ref.iloc[:20].median(), 4), "sample": r3(w.lux_sample / w.lux_sample.iloc[:20].median(), 4),
                  "t0_utc": "12:44"}

cal = pd.read_csv(OUT / "calibration_table.csv")
bd = pd.read_csv(OUT / "biodrop_points.csv")
calj = {"n": [int(v) for v in cal.n], "C": r3(cal.C, 4), "V1": r3(cal.V1_mad, 4), "V2": r3(cal.V2_mad, 4),
        "V1_upper": r3(cal.V1_upper, 4), "V2_upper": r3(cal.V2_upper, 4), "mg": r3(cal.mg, 1),
        "bd": {k: {"C": r3(g.C, 4), "od": r3(g.od, 3), "n": [int(v) for v in g.n]} for k, g in bd.groupby("kind")}}

out = {"clean": clean, "noise": {u: r3(noise[u], 5) for u in UNITS}, "est": EST, "H5": H5,
       "bubble": bub, "events": ev, "cal": calj, "J": J}
(ROOT / "data" / "results_1010.json").write_text(json.dumps(out, separators=(",", ":"), default=float))
print("results_1010.json", len(json.dumps(out)) // 1024, "KB")

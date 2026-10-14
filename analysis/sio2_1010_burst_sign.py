#!/usr/bin/env python3
"""Inside a disturbed burst, do the samples go brighter or darker than the clean level?

Uses the 14 kept lit samples (positions 2-15) of the sample channel, dark-subtracted, divided by the
clean burst level of the same episode. V1 bubble-test raw was not exported (the file is a copy of the
processed CSV), so V1 is read from the flagged bursts of the main run, which include the 11:08-11:22 air event.
"""
import json
import sys
import numpy as np
import pandas as pd
sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
from sio2_1010_common import D, OUT

LS = [f"lit_s_{i}" for i in range(2, 16)]
DS = [f"dark_s_{i}" for i in range(4)]


def bursts(proc, raw):
    p = pd.read_csv(D / proc)
    r = pd.read_csv(D / raw)
    m = p.merge(r, on="meas_seq", suffixes=("", "_r"))
    x = m[LS].values - m[DS].values.mean(1, keepdims=True)
    return m, x


R = {}
cases = {"V2 bubble test": ("V2_fiber_bubble.csv", "V2_fiber_bubble_raw.csv", None),
         "V1 main run, flagged bursts": ("V1_complete_sio2.csv", "V1_complete_sio2_raw.csv", None),
         "V2 main run, flagged bursts": ("V2_fiber_sio2.csv", "V2_fiber_sio2_raw.csv", None)}
for name, (pf, rf, _) in cases.items():
    m, x = bursts(pf, rf)
    if "bubble test" in name:
        m = m[m.elapsed_s < 280]
        x = x[m.index]
        base = np.median(x[(m.valid == 1).values & (m.bubble_frac_pct == 0).values])
        rel_all = x / base
        sel = (m.valid == 0).values
        rel = rel_all[sel]
    else:
        # each flagged burst against the median of the clean bursts in the preceding 2 min
        rel = []
        ts = pd.to_datetime(m.timestamp_iso)
        for i in np.where(m.valid.values == 0)[0]:
            w = (ts > ts.iloc[i] - pd.Timedelta(minutes=2)) & (ts < ts.iloc[i]) & (m.valid == 1)
            if w.sum() < 5:
                continue
            rel.append(x[i] / np.median(x[w.values]))
        rel = np.array(rel)
    flat = rel.ravel()
    R[name] = dict(bursts=int(len(rel)), samples=int(flat.size),
                   brighter_3pct=float((flat > 1.03).mean()), darker_3pct=float((flat < 0.97).mean()),
                   bursts_mostly_brighter=float(np.mean([(b > 1.03).mean() > (b < 0.97).mean() for b in rel])),
                   max_rel=float(flat.max()), min_rel=float(flat.min()))
json.dump(R, open(OUT / "burst_sign.json", "w"), indent=1)
if __name__ == "__main__":
    print(pd.DataFrame(R).T.round(3).to_string())

#!/usr/bin/env python3
"""Per-step plateau statistics for every estimator on both units (2026-10-10 SiO2 run).

Writes out_1010/plateaus.csv (one row per unit x step x estimator) and prints the summary
that feeds H5 and the clean-flow precision table.
"""
import sys
import numpy as np
import pandas as pd
sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
from sio2_1010_common import EST, UNITS, OUT, steps, unit, window

st = steps()
rows = []
for u in UNITS:
    d = unit(u)
    for _, s in st.iterrows():
        w = window(d, s.t0, s.t1)
        tmin = (w.timestamp_iso - w.timestamp_iso.iloc[0]).dt.total_seconds().values / 60
        for e in EST:
            x = w["od_" + e].values
            dx = np.diff(x)
            rows.append(dict(
                unit=u, n=s.n, mg=s.mg, est=e, N=len(x), flagged=int((w.valid == 0).sum()),
                level=np.median(x), mean=x.mean(), sd=x.std(ddof=1),
                noise=np.std(dx, ddof=1) / np.sqrt(2),            # short-term noise, drift-free
                drift=np.polyfit(tmin, x, 1)[0] if len(x) > 3 else np.nan,   # OD per minute
                # isolated excursions: further than 0.02 OD from the 5-cycle running median
                spikes=int((np.abs(x - pd.Series(x).rolling(5, center=True, min_periods=1).median()) > 0.02).sum()),
                counts_s=w.counts_sample.median(), counts_r=w.counts_ref.median()))
p = pd.DataFrame(rows)

# Each estimator against its own blank (n = 0); the firmware applies one blank ratio to all.
blank = p[p.n == 0].set_index(["unit", "est"]).level
p["od_ownblank"] = p.level - p.set_index(["unit", "est"]).index.map(blank).values
p.to_csv(OUT / "plateaus.csv", index=False)

if __name__ == "__main__":
    pd.set_option("display.width", 200)
    print("blank level per estimator (OD with the firmware's single blank ratio):")
    print(blank.unstack().round(4))
    ok = p[p.n > 0]
    print("\nmedian over steps 1-40 of the within-plateau short-term noise (OD):")
    print(ok.pivot_table(index="est", columns="unit", values="noise", aggfunc="median").round(4).loc[EST])
    print("\n... total SD within plateau (includes drift):")
    print(ok.pivot_table(index="est", columns="unit", values="sd", aggfunc="median").round(4).loc[EST])
    print("\nisolated excursions > 0.02 OD, summed over all plateaus / readings:")
    tot = ok.groupby(["unit", "est"])[["spikes", "N"]].sum()
    print((tot.spikes.astype(str) + " / " + tot.N.astype(str)).unstack(0).loc[EST])
    print("\nH5: plateau level minus mad, own blank each (OD): max |delta| over steps, and median delta")
    piv = ok.pivot_table(index=["unit", "n"], columns="est", values="od_ownblank")
    for u in UNITS:
        dd = piv.loc[u].sub(piv.loc[u]["mad"], axis=0)
        print(u, "max|d|", dd.abs().max().round(4).to_dict())
        print(u, "median d", dd.median().round(4).to_dict())
    print("\ndrift within plateau (OD/min, mad), long plateaus >= 4 min:")
    lp = ok[(ok.est == "mad") & (ok.N >= 48)].pivot_table(index="n", columns="unit", values=["drift", "level"])
    print(lp.round(4))
    print("\ncounts and OD resolution per count (2.17/counts) at blank and n=40:")
    for u in UNITS:
        for n in (0, 20, 40):
            r = ok[(ok.unit == u) & (ok.n == n) & (ok.est == "mad")] if n else p[(p.unit == u) & (p.n == 0) & (p.est == "mad")]
            r = r.iloc[0]
            print(u, n, "sample", r.counts_s, "ref", r.counts_r, "OD/count sample %.4f ref %.4f" % (2.1715 / r.counts_s, 2.1715 / r.counts_r))

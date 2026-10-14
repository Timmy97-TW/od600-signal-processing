#!/usr/bin/env python3
"""Replay candidate reporting pipelines at the bioreactor cadence (one burst every 30 s).

  P0  upper, every reading           (what the UI showed on 10/10)
  P1  mad, every reading             (firmware v3.10.9 default in the bioreactor)
  P2  mad + firmware flag, hold last valid
  P3  P2 + spread gate |mad - p90| > TAU
  P4  P3 + jump gate with re-acquire (K agreeing readings) + median of the last 3 accepted
Truth: on the SiO2 run, the piecewise-constant plateau level of each step (unit's own mad);
on the bubble test, the clean level. Every 6th cycle is used, all six phase offsets pooled.
"""
import json
import sys
import numpy as np
import pandas as pd
sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
from sio2_1010_common import AIR_EVENT, D, OUT, UNITS, steps, unit

TAU = 0.03      # OD, spread gate
K = 3           # agreeing readings to accept a new level
JUMP_ABS, JUMP_REL = 0.05, 0.05


def pipeline(df, name, init=np.nan):
    x = df.od_mad.values if name != "P0" else df.od_upper.values
    if name in ("P0", "P1"):
        return x
    ok = df.valid.values.astype(bool)
    if name in ("P3", "P4"):
        ok &= np.abs(df.od_mad.values - df.od_p90.values) <= TAU
    out, last, cand = [], init, []
    acc = [] if np.isnan(init) else [init]
    for xi, oi in zip(x, ok):
        if not oi:
            out.append(np.median(acc[-3:]) if (name == "P4" and acc) else last)
            continue
        if name == "P4":
            if np.isnan(last) or abs(xi - last) <= max(JUMP_ABS, JUMP_REL * abs(last)):
                last, cand = xi, []
                acc.append(xi)
            else:
                cand.append(xi)
                if len(cand) >= K and np.ptp(cand[-K:]) <= max(JUMP_ABS, JUMP_REL * abs(np.median(cand[-K:]))):
                    last = np.median(cand[-K:])
                    acc += cand[-K:]
                    cand = []
            out.append(np.median(acc[-3:]) if acc else np.nan)
        else:
            last = xi
            out.append(last)
    return np.array(out)


NAMES = ["P0", "P1", "P2", "P3", "P4"]
R = {}
st = steps()
plat = pd.read_csv(OUT / "plateaus.csv")
for u in UNITS:
    d = unit(u)
    lv = plat[(plat.unit == u) & (plat.est == "mad")].set_index("n").level
    # truth timeline: level of step n from its onset to the next onset
    on = [pd.Timestamp("2026-10-10 08:50")] + list(st.onset[1:])
    truth = np.full(len(d), np.nan)
    since = np.full(len(d), np.inf)
    for i, n in enumerate(st.n):
        t0 = on[i]
        t1 = on[i + 1] if i + 1 < len(on) else d.timestamp_iso.max() + pd.Timedelta(seconds=1)
        m = ((d.timestamp_iso >= t0) & (d.timestamp_iso < t1)).values
        truth[m] = lv[n]
        since[m] = (d.timestamp_iso[m] - t0).dt.total_seconds().values if n > 0 else np.inf
    d["truth"], d["since"] = truth, since
    d = d[d.timestamp_iso >= pd.Timestamp("2026-10-10 08:55:40")]
    air = ((d.timestamp_iso >= AIR_EVENT[0]) & (d.timestamp_iso < AIR_EVENT[1])).values
    res = {}
    for nm in NAMES:
        steady, event, lag = [], [], []
        for ph in range(6):
            s = d.iloc[ph::6].reset_index(drop=True)
            y = pipeline(s, nm)
            err = y - s.truth.values
            a = ((s.timestamp_iso >= AIR_EVENT[0]) & (s.timestamp_iso < AIR_EVENT[1])).values
            st_ = (s.since.values > 150) & ~a
            steady += list(err[st_])
            event += list(err[a])
            # lag: seconds after onset until |err| < 0.02 and stays for the rest of the step
            for n in range(1, 41):
                if n == 25:
                    continue
                m = np.where((s.since.values <= 400) & (np.isfinite(s.since.values)) &
                             (np.abs(s.truth.values - lv[n]) < 1e-12))[0]
                if not len(m):
                    continue
                e = np.where(np.abs(err[m]) < 0.02)[0]
                lag.append(s.since.values[m[e[0]]] if len(e) else np.nan)
        steady, event = np.array(steady), np.array(event)
        res[nm] = dict(steady_rmse=float(np.sqrt(np.nanmean(steady ** 2))), steady_max=float(np.nanmax(np.abs(steady))),
                       steady_over_002=float(np.nanmean(np.abs(steady) > 0.02)),
                       event_rmse=float(np.sqrt(np.nanmean(event ** 2))), event_max=float(np.nanmax(np.abs(event))),
                       event_over_01=float(np.nanmean(np.abs(event) > 0.1)),
                       lag_median_s=float(np.nanmedian(lag)), lag_max_s=float(np.nanmax(lag)), lag_nan=int(np.isnan(lag).sum()))
    R["sio2_" + u] = res

# bubble test (liquid present + slug cycles; t < 280 s)
b = pd.read_csv(OUT / "bubble_cycles.csv")
bj = json.load(open(OUT / "bubbles.json"))
for u in UNITS:
    d = b[b.unit == u].reset_index(drop=True)
    lvl = bj[u]["clean_level"]["mad"]
    res = {}
    for nm in NAMES:
        errs, slug_err = [], []
        for ph in range(6):
            s = d.iloc[ph::6].reset_index(drop=True)
            y = pipeline(s, nm, init=lvl) - (lvl if nm != "P0" else bj[u]["clean_level"]["upper"])
            errs += list(y)
            slug_err += list(y[(s.cls == "slug").values])
        errs = np.array(errs)
        res[nm] = dict(rmse=float(np.sqrt(np.mean(errs ** 2))), max_abs=float(np.max(np.abs(errs))),
                       within_005=float(np.mean(np.abs(errs) <= 0.05)),
                       slug_max_abs=float(np.max(np.abs(slug_err))) if slug_err else None)
    R["bubble_" + u] = res

json.dump(R, open(OUT / "pipeline.json", "w"), indent=1)
if __name__ == "__main__":
    for k, v in R.items():
        print("==", k)
        print(pd.DataFrame(v).T.round(4).to_string())

"""Shared loading and step segmentation for the 2026-10-10 SiO2 run (photometer-fw/py v1.2.0).

V1 = complete unit (LED + convex lens + 9:1 beam splitter), V2 = simplified fibre unit.
CSV timestamps are UTC; the hand-written log is Taiwan time (UTC+8), minute resolution.
"""
from pathlib import Path
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
D = ROOT / "data" / "20261010"
OUT = ROOT / "analysis" / "out_1010"
OUT.mkdir(exist_ok=True)

EST = ["mad", "qn", "biweight", "upper", "mean", "median", "p75", "p90"]
UNITS = {"V1": "V1_complete_sio2.csv", "V2": "V2_fiber_sio2.csv"}
DAY = pd.Timestamp("2026-10-10")
SETTLE_S = 60           # skip this long after the step onset (mixing transient; see mixing_time)
AIR_EVENT = (pd.Timestamp("2026-10-10 11:08"), pd.Timestamp("2026-10-10 11:22:30"))  # unlogged air in the loop, ends at the n=25 onset


def utc(t):
    return DAY + pd.Timedelta(hours=t.hour - 8, minutes=t.minute)


def manual():
    m = pd.read_excel(D / "manual_record.xlsx")
    blank = pd.DataFrame([{"SiO2(mg)": 0.0}])
    m = m.dropna(subset=["Load Time"]).copy()
    m["load"] = m["Load Time"].map(utc)
    m["screen"] = m["ScreenTime"].map(utc)
    m["n"] = (m["SiO2(mg)"] / 2.5).round().astype(int)
    return m.reset_index(drop=True)


def unit(name):
    d = pd.read_csv(D / UNITS[name], parse_dates=["timestamp_iso"])
    return d


def jump_times(m):
    """The logged addition times are rounded down to the minute. Find the real step onset on
    each unit as the largest rise of the 3-cycle median in [load - 30 s, load + 150 s]."""
    out = {}
    for u in UNITS:
        d = unit(u).set_index("timestamp_iso")["od_median"]
        sm = d.rolling(3, center=True).median()
        rise = sm.shift(-2) - sm.shift(2)
        nxt = list(m.load[1:]) + [m.load.iloc[-1] + pd.Timedelta(minutes=5)]
        out[u] = [rise[l - pd.Timedelta(seconds=30): min(l + pd.Timedelta(seconds=150), n)].idxmax()
                  for l, n in zip(m.load, nxt)]
    return out


def steps():
    """Plateau windows, n = 0 (blank) .. 40: from the step onset + SETTLE_S to the next onset - 10 s.
    Onsets are taken from V1 (largest steps); V2 sits a few seconds downstream."""
    m = manual()
    j = jump_times(m)
    m["onset"] = j["V1"]
    m["onset_V2"] = j["V2"]
    rows = [{"n": 0, "mg": 0.0, "t0": pd.Timestamp("2026-10-10 08:55:40"),
             "t1": m.onset[0] - pd.Timedelta(seconds=10)}]
    for i, r in m.iterrows():
        t1 = (m.onset[i + 1] - pd.Timedelta(seconds=10)) if i + 1 < len(m) else pd.Timestamp("2026-10-10 13:22:10")
        if t1 > AIR_EVENT[0] and r.onset < AIR_EVENT[0]:
            t1 = AIR_EVENT[0]
        rows.append({"n": r.n, "mg": r["SiO2(mg)"], "t0": r.onset + pd.Timedelta(seconds=SETTLE_S), "t1": t1,
                     "onset": r.onset, "onset_V2": r.onset_V2, "load": r.load,
                     "bd": r["True BioDrop OD"], "bd_direct": r["BioDrop Direct OD"],
                     "bd_d05": r["Diluted (0.5)"], "bd_d025": r["Diluted (0.25)"],
                     "man_V1": r.V1, "man_V2": r.V2, "screen": r.screen})
    return pd.DataFrame(rows)


def window(d, t0, t1):
    return d[(d.timestamp_iso >= t0) & (d.timestamp_iso < t1)]

#!/usr/bin/env python3
"""Calibration of V1 / V2 against concentration and against the BioDrop (H1-H4, H8).

Concentration: SOP v1.1 withdraw-1-mL-then-add-1-mL of 2.5 mg/mL, so C_n = 2.5 (1 - (1 - 1/V)^n) mg/mL.
V = 50 mL (stated by the team, 2026-10-14). V_fit, the volume that makes V2 straightest, is reported
alongside as a check.
"""
import json
import sys
import numpy as np
import pandas as pd
from scipy.optimize import minimize_scalar
sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
from sio2_1010_common import OUT, steps

p = pd.read_csv(OUT / "plateaus.csv")
st = steps()
t = st[["n", "mg", "bd", "bd_direct", "bd_d05", "bd_d025"]].copy()
for u in ("V1", "V2"):
    for e in ("mad", "upper"):
        t[f"{u}_{e}"] = p[(p.unit == u) & (p.est == e)].set_index("n").od_ownblank.reindex(t.n).values


def conc(n, V):
    return 2.5 * (1 - (1 - 1 / V) ** np.asarray(n, float))


def lin_resid(x, y):
    a = np.polyfit(x, y, 1)
    return a, y - np.polyval(a, x)


k = t[t.n > 0]
V_FIT = minimize_scalar(lambda V: lin_resid(conc(k.n, V), k.V2_mad)[1].std(), bounds=(30, 500), method="bounded").x
V_EFF = 50.0
t["C"] = conc(t.n, V_EFF)
k = t[t.n > 0]
R = {"V_mL": V_EFF, "V_fit_V2_mL": V_FIT}

# BioDrop points, each kept with how it was obtained
bd = []
for _, r in k.iterrows():
    if r.bd_direct < 2.5:
        bd.append((r.n, r.C, r.bd_direct, "direct"))
    if not np.isnan(r.bd_d05):
        bd.append((r.n, r.C, 2 * r.bd_d05, "x2"))
    if not np.isnan(r.bd_d025):
        bd.append((r.n, r.C, 4 * r.bd_d025, "x4"))
bd = pd.DataFrame(bd, columns=["n", "C", "od", "kind"])
bd.to_csv(OUT / "biodrop_points.csv", index=False)

# H1: BioDrop direct, n = 1-8, slope against C
h1 = bd[(bd.kind == "direct") & (bd.n <= 8)]
a, r = lin_resid(h1.C, h1.od)
R["H1"] = dict(slope=a[0], intercept=a[1], resid_sd=r.std(ddof=2), pass_=1.8 <= a[0] <= 2.8)

# H2: direct vs dilution-corrected where the diluted value says OD >= 2 and direct is not clipped
both = bd.pivot_table(index="n", columns="kind", values="od")
both["dil"] = both["x4"].fillna(both["x2"])
h2 = both[(both.dil >= 2) & both.direct.notna()]
dev = (h2.direct / h2.dil - 1)
R["H2"] = dict(n=list(h2.index), pct=list((100 * dev).round(1)), mean_pct=100 * dev.mean(),
               clipped_from_n=int(k[k.bd_direct >= 2.5].n.min()), pass_=bool(dev.mean() < -0.10))

# referee noise: each BioDrop kind against the smooth V2 line (scaled)
a2, _ = lin_resid(k.C, k.V2_mad)
v2line = lambda C: np.polyval(a2, C)
ref = bd.copy()
ref["v2"] = v2line(ref.C)
g, rr = lin_resid(ref[ref.kind == "direct"].v2[ref.od < 1.0], ref[(ref.kind == "direct") & (ref.od < 1.0)].od)
ref["pred"] = np.polyval(g, ref.v2)
ref["rel"] = ref.od / ref.pred - 1
R["biodrop_rel_scatter_pct"] = (100 * ref.groupby("kind").rel.std()).round(1).to_dict()
R["biodrop_rel_bias_pct"] = (100 * ref.groupby("kind").rel.mean()).round(1).to_dict()

# H3 / H4: each unit against BioDrop direct where BioDrop < 1.0
lo = k[k.bd_direct < 1.0]
for u in ("V1", "V2"):
    a, r = lin_resid(lo.bd_direct, lo[f"{u}_mad"])
    R[f"{u}_vs_BD_lo"] = dict(slope=a[0], intercept=a[1], resid_sd=r.std(ddof=2), r2=1 - r.var() / lo[f"{u}_mad"].var())
R["H3"] = dict(slope=R["V1_vs_BD_lo"]["slope"], pass_=0.6 <= R["V1_vs_BD_lo"]["slope"] <= 1.0)

# linearity against C: fit n = 1-8, find first n where the unit departs > 5 % from that line
for u in ("V1", "V2"):
    first = k[k.n <= 8]
    a, _ = lin_resid(first.C, first[f"{u}_mad"])
    dev = k[f"{u}_mad"] / np.polyval(a, k.C) - 1
    far = k.n[(dev.abs() > 0.05) & (k.n > 8)]
    R[f"{u}_linear"] = dict(slope_per_mgml=a[0], intercept=a[1], depart5_n=int(far.min()) if len(far) else None,
                            depart5_C=float(conc(far.min(), V_EFF)) if len(far) else None,
                            dev_at_n40_pct=100 * dev.iloc[-1])
    af, rf = lin_resid(k.C, k[f"{u}_mad"])
    R[f"{u}_linear"]["full_resid_sd"] = rf.std(ddof=2)
    R[f"{u}_linear"]["full_r2"] = 1 - rf.var() / k[f"{u}_mad"].var()
R["H4"] = dict(slope_V2_over_V1=R["V2_vs_BD_lo"]["slope"] / R["V1_vs_BD_lo"]["slope"],
               depart_V1=R["V1_linear"]["depart5_n"], depart_V2=R["V2_linear"]["depart5_n"],
               slope_part=R["V2_vs_BD_lo"]["slope"] > R["V1_vs_BD_lo"]["slope"])

# H8: late/early slope ratio (n 25-36 over n 1-12), inline vs C and inline vs BioDrop (dilution-corrected)
def sl(x, y):
    return np.polyfit(x, y, 1)[0]
e, l = k[(k.n >= 1) & (k.n <= 12)], k[(k.n >= 25) & (k.n <= 36)]
for u in ("V1", "V2"):
    R[f"H8_{u}"] = dict(vs_C=sl(l.C, l[f"{u}_mad"]) / sl(e.C, e[f"{u}_mad"]),
                        vs_BD=sl(l.bd, l[f"{u}_mad"]) / sl(e.bd, e[f"{u}_mad"]))
# same using the naive "mass / fixed volume" axis that the 9/19 run used
for u in ("V1", "V2"):
    R[f"H8_{u}"]["vs_mass"] = sl(l.mg, l[f"{u}_mad"]) / sl(e.mg, e[f"{u}_mad"])

t.to_csv(OUT / "calibration_table.csv", index=False)
json.dump(R, open(OUT / "calibration.json", "w"), indent=1, default=float)
if __name__ == "__main__":
    print(json.dumps(R, indent=1, default=lambda x: round(float(x), 4)))

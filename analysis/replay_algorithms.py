#!/usr/bin/env python3
"""Replay one set of raw photometer bursts through several reduction algorithms.

The point of the study is that every algorithm sees the *same* raw samples, so a
difference between two algorithms is a difference in arithmetic and nothing else.

Input CSV (one row per individual sensor sample), columns:
    level_id   label of the concentration level, e.g. "L05"
    conc       known concentration of the standard (mg/mL); 0 for the blank
    arm        perturbation arm: static | stir | bubble | light | warm ...
    burst      burst index within (level, arm); >= 3 bursts per level
    phase      "dark" (LED off) or "lit" (LED on)
    i          sample index inside the burst
    sample     raw sample-channel reading (sensor counts, or lux)
    ref        raw reference-channel reading

Usage:
    python3 replay_algorithms.py raw.csv            # writes replay_summary.csv
    python3 replay_algorithms.py --selftest         # synthetic data, prints the table

Standard library + numpy only.
"""
import csv
import os
import sys
from collections import defaultdict

import numpy as np

PATH_FACTOR = 1.0      # report raw absorbance; apply the path factor afterwards
WARMUP_DISCARD = 2     # same as the firmware: drop the first two lit samples
Q_SIGMA = 1 / np.sqrt(12)  # rms quantisation error of one count, in counts


# ---- per-channel estimators (all work in intensity space) -------------------
def mad_mean(x, k=3.0, floor=1e-6):
    """The deployed firmware: mean of samples within k*MAD of the median."""
    med = np.median(x)
    mad = max(np.median(np.abs(x - med)) * 1.4826, floor)
    keep = np.abs(x - med) <= k * mad
    return x[keep].mean() if keep.any() else med


def trimmed(x, frac=0.2):
    x = np.sort(x)
    g = int(len(x) * frac)
    return x[g:len(x) - g].mean() if len(x) > 2 * g else x.mean()


def upper_band(x, lo=0.6, hi=0.9):
    """Mean of the 60th-90th percentile band: the least-obstructed samples."""
    a, b = np.quantile(x, [lo, hi])
    sel = x[(x >= a) & (x <= b)]
    return sel.mean() if len(sel) else np.median(x)


sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from firmware_estimators import est_mad, est_qn, est_biweight, est_upper  # exact v3.10.9 ports

both = lambda f: (lambda s, r: (f(s), f(r)))
ALGORITHMS = {
    "E-1 mad (current firmware)": both(est_mad),
    "E-2 qn": both(est_qn),
    "E-5 biweight": both(est_biweight),
    "E-3 upper": both(est_upper),
    "C1 mean": lambda s, r: (s.mean(), r.mean()),
    "C2 median": lambda s, r: (np.median(s), np.median(r)),
    "C3 trimmed mean 20%": lambda s, r: (trimmed(s), trimmed(r)),
    "C4 upper band on sample": lambda s, r: (upper_band(s), r.mean()),
    "C7 mad, floor = 1 count": lambda s, r: (mad_mean(s, floor=1.0), mad_mean(r, floor=1.0)),
}


def reduce_burst(dark_s, dark_r, lit_s, lit_r):
    """Return {algorithm: net sample/reference ratio} for one burst."""
    ds, dr = np.median(dark_s), np.median(dark_r)
    s, r = lit_s[WARMUP_DISCARD:], lit_r[WARMUP_DISCARD:]
    out = {}
    for name, f in ALGORITHMS.items():
        es, er = f(s, r)
        out[name] = (es - ds) / (er - dr)
    # C5: log first, average afterwards (the Jensen control)
    out["C5 mean of per-sample OD"] = 10 ** np.mean(np.log10((s - ds) / (r - dr)))
    # C6: ratio sample by sample, then average the ratios
    out["C6 mean of paired ratios"] = np.mean((s - ds) / (r - dr))
    return out


def analyse(bursts):
    """bursts: {(level, conc, arm, burst): {'dark': [(s, r)...], 'lit': [...]}}"""
    ratios = defaultdict(lambda: defaultdict(list))   # [(arm, alg)][(level, conc)] -> list
    for (level, conc, arm, _b), ph in sorted(bursts.items()):
        d, l = np.array(ph["dark"], float), np.array(ph["lit"], float)
        for alg, ratio in reduce_burst(d[:, 0], d[:, 1], l[:, 0], l[:, 1]).items():
            ratios[(arm, alg)][(level, conc)].append(ratio)
    rows = []
    for (arm, alg), lv in ratios.items():
        blank = [np.mean(v) for (lvl, c), v in lv.items() if c == 0]
        if not blank:
            # perturbation arms reuse the static blank of the same algorithm
            blank = [np.mean(v) for (lvl, c), v in ratios[("static", alg)].items() if c == 0]
        b0 = blank[0]
        pts = sorted((c, PATH_FACTOR * np.log10(b0 / np.array(v))) for (lvl, c), v in lv.items())
        conc = np.array([p[0] for p in pts])
        od = np.array([p[1].mean() for p in pts])
        sd = np.array([p[1].std(ddof=1) if len(p[1]) > 1 else np.nan for p in pts])
        # reference line: through the lowest third of the non-blank levels, static arm
        low = (conc > 0) & (conc <= np.quantile(conc[conc > 0], 0.34))
        slope = np.sum(conc[low] * od[low]) / np.sum(conc[low] ** 2)
        for c, o, s in zip(conc, od, sd):
            rows.append(dict(arm=arm, algorithm=alg, conc=c, od=o, sd=s,
                             od_expected=slope * c, bias=o - slope * c,
                             bias_pct=100 * (o - slope * c) / (slope * c) if c > 0 else np.nan))
    return rows


def load(path):
    bursts = defaultdict(lambda: {"dark": [], "lit": []})
    with open(path) as fh:
        for r in csv.DictReader(fh):
            key = (r["level_id"], float(r["conc"]), r["arm"], int(r["burst"]))
            bursts[key][r["phase"]].append((float(r["sample"]), float(r["ref"])))
    return bursts


# ---- synthetic self-test ------------------------------------------------------
def synth(rng, ref_counts=32.3, blank_ratio=9.2, absorb=0.0, bubble_f=0.0, bubble_k=0.5,
          noise=0.004, read=0.3, dark=0.4, n=16):
    """One burst as the sensor would return it: integer counts, shared source noise
    plus `read` counts of independent sensor noise per sample, rounded to a count."""
    src = 1 + noise * rng.standard_normal(n)
    occl = np.where(rng.random(n) < bubble_f, bubble_k, 1.0)
    s = ref_counts * blank_ratio * 10 ** (-absorb) * src * occl + dark
    r = ref_counts * src + dark
    lit = np.column_stack([np.round(s + read * rng.standard_normal(n)),
                           np.round(r + read * rng.standard_normal(n))])
    dk = np.round(dark + read * rng.standard_normal((4, 2)))
    return dk, lit


def selftest():
    rng = np.random.default_rng(7)
    print("True absorbance 0.200 (path factor 1). 4000 bursts per cell.\n")
    for label, kw in [("reference at 32-33 counts, no bubbles", dict(ref_counts=32.0)),
                      ("reference at 265 counts, no bubbles", dict(ref_counts=265.0)),
                      ("reference at 265 counts, 15% of samples half-occluded",
                       dict(ref_counts=265.0, bubble_f=0.15, bubble_k=0.5))]:
        acc = defaultdict(list)
        base = kw["ref_counts"]
        for _ in range(4000):
            # the lamp level wanders between blank and measurement, as it does in a real run
            kw["ref_counts"] = base + rng.random()
            d0, l0 = synth(rng, absorb=0.0, ref_counts=base + rng.random())
            d1, l1 = synth(rng, absorb=0.2, **kw)
            b = reduce_burst(d0[:, 0], d0[:, 1], l0[:, 0], l0[:, 1])
            m = reduce_burst(d1[:, 0], d1[:, 1], l1[:, 0], l1[:, 1])
            for k in b:
                acc[k].append(np.log10(b[k] / m[k]))
        print(label)
        for k, v in acc.items():
            v = np.array(v)
            print(f"   {k:38s} bias {v.mean() - 0.2:+.4f}   sd {v.std():.4f}")
        print()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    if sys.argv[1] == "--selftest":
        selftest()
    else:
        rows = analyse(load(sys.argv[1]))
        with open("replay_summary.csv", "w", newline="") as fh:
            w = csv.DictWriter(fh, fieldnames=list(rows[0]))
            w.writeheader()
            w.writerows(rows)
        print(f"wrote replay_summary.csv ({len(rows)} rows)")

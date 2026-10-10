#!/usr/bin/env python3
"""Line-for-line Python ports of the four OD600 estimators in firmware v3.10.9
(sketch.ino, robustMean()), selectable in the UI as od_estimator = mad | qn | biweight | upper.

Run directly to print how each behaves on clean, quantised and bubble-hit bursts.
"""
import numpy as np

MAD_K = 3.0
FLOOR = 1e-6


def mad_scale(x, med, floor=FLOOR):
    return max(np.median(np.abs(x - med)) * 1.4826, floor)


def qn_scale(x, floor=FLOOR):
    n = len(x)
    d = np.sort(np.abs(x[:, None] - x[None, :])[np.triu_indices(n, 1)])
    h = n // 2 + 1
    k = min(max(h * (h - 1) // 2, 1), len(d))
    return max(2.2219 * d[k - 1], floor)


def est_mad(x, floor=FLOOR):                       # E-1, current default
    med = np.median(x)
    keep = np.abs(x - med) <= MAD_K * mad_scale(x, med, floor)
    return x[keep].mean() if keep.any() else med


def est_qn(x, floor=FLOOR):                        # E-2
    med = np.median(x)
    keep = np.abs(x - med) <= MAD_K * qn_scale(x, floor)
    return x[keep].mean() if keep.any() else med


def est_biweight(x, floor=FLOOR):                  # E-5
    med = np.median(x)
    sc, c, T = mad_scale(x, med, floor), 4.685, med
    for _ in range(8):
        u = (x - T) / (c * sc)
        w = np.where(np.abs(u) < 1, (1 - u * u) ** 2, 0.0)
        if w.sum() <= 0:
            break
        Tn = (w * x).sum() / w.sum()
        done = abs(Tn - T) < 1e-4 * (abs(T) + 1e-3)
        T = Tn
        if done:
            break
    return T


def est_upper(x, floor=FLOOR):                     # E-3, one-sided
    med = np.median(x)
    sel = x[x >= med]                              # points below med - 3*MAD are "rejected",
    return sel.mean() if len(sel) else med         # but only points >= median are averaged


FIRMWARE = {"mad (E-1, current)": est_mad, "qn (E-2)": est_qn,
            "biweight (E-5)": est_biweight, "upper (E-3)": est_upper}


def burst(rng, level, read=0.3, src=0.004, f=0.0, k=0.5, n=14):
    occl = np.where(rng.random(n) < f, k, 1.0)
    return np.round(level * (1 + src * rng.standard_normal(n)) * occl + read * rng.standard_normal(n))


if __name__ == "__main__":
    rng = np.random.default_rng(3)
    N = 4000
    print("1) Staircase test: true level sweeps 32.0 -> 33.0 counts, read noise 0.3 count.")
    print("   An ideal estimator returns the level itself.\n   level   " + "  ".join(f"{k.split()[0]:>9s}" for k in FIRMWARE) + "       mean")
    for lv in (32.0, 32.2, 32.4, 32.5, 32.6, 32.8, 33.0):
        bs = [burst(rng, lv, src=0) for _ in range(N)]
        print(f"   {lv:5.1f}   " + "  ".join(f"{np.mean([f(b) for b in bs]):9.3f}" for f in FIRMWARE.values()) + f"  {np.mean([b.mean() for b in bs]):9.3f}")

    for title, lv, kw in [("2) Clean burst, 2400 counts", 2400, {}),
                          ("3) 15% of samples half-blocked, 2400 counts", 2400, dict(f=0.15)),
                          ("4) 35% of samples half-blocked, 2400 counts", 2400, dict(f=0.35))]:
        print(f"\n{title}: error of the channel estimate, as OD (x5 path factor)")
        bs = [burst(rng, lv, **kw) for _ in range(N)]
        ests = dict(FIRMWARE, **{"plain mean": np.mean, "median": np.median,
                                 "mad, floor 1 count": lambda b: est_mad(b, 1.0)})
        for name, f in ests.items():
            od = 5 * np.log10(lv / np.array([f(b) for b in bs]))
            print(f"   {name:22s} bias {od.mean():+.4f}   sd {od.std():.4f}")

    print("\n5) 'upper' averages only samples >= median, so it reads the channel high by a fixed")
    print("   multiple of the noise. Bias of the channel estimate, in units of the noise sd:")
    for n in (14,):
        x = rng.standard_normal((20000, n))
        print(f"   n={n}: +{np.mean([est_upper(r) for r in x]):.3f} sd")

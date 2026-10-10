# Pre-registration: OD600 reduction-algorithm comparison

Status: DRAFT. Fill the blanks, then commit this file **before** the first Day 1 measurement.
The commit timestamp is the evidence that the plan preceded the data.

- Date frozen: ____  ·  Frozen by: ____
- Instrument: inline photometer, firmware v3.10.9 with `OD_VERBOSE_LOG 1` (or the raw-burst RPC), `alg_profile` = ____
- Blank measured in place on: ____ (not restored from file)
- Counts at DI-water blank — sample: ____  reference: ____  (target: reference ≥ 300)
- Standard: 1 µm monodisperse SiO₂ microspheres, 25 mg/mL stock, lot ____

## Algorithms (fixed)
Firmware estimators (v3.10.9, selectable in the UI): E-1 `mad` (current) · E-2 `qn` · E-5 `biweight` · E-3 `upper`.
Controls and candidates: C1 mean · C2 median · C3 20 % trimmed mean · C4 60–90th percentile band on the
sample channel · C5 mean of per-sample OD · C6 mean of paired ratios · C7 `mad` with a floor of 1 count.
Implementation: `analysis/firmware_estimators.py` and `analysis/replay_algorithms.py` at commit ____.

## Metrics (fixed)
1. Bias: reading minus the line through the lowest third of the ladder (static arm), in OD and %.
2. Repeatability: SD of the bursts at one level.
3. LOD = 3 × SD of the blank; LOQ = 10 × SD of the blank.
4. Upper limit: highest level with |bias| ≤ 5 %.
5. Hysteresis: ascending minus descending reading at matched concentration.

## Decision rule (fixed)
Among algorithms with |bias| ≤ 5 % in every arm across the validated range, adopt the one with the
lowest repeatability SD in the bubble arm (P1). On a tie (within 10 %), adopt the simplest.
Results for all eleven are published whichever is chosen.

## Predictions written down in advance
- P1 bubbles: C1 and C6 read high by −5·log10(1 − f(1 − k)); C5 higher still. E-1, E-2, E-5 agree with
  each other to within noise. E-3 has roughly ten times lower SD at f ≈ 15 % and survives f ≈ 35 %.
- P3 starved reference (~30 counts): single-reading SD rises several-fold for every algorithm;
  E-1, E-2 and E-5 show one identical staircase that C1 and C7 do not.
- Clean arm: all agree within noise except C5 (high by 0.217·5·σr²) and E-3 (offset of about −0.006 OD
  per channel, cancelling when blank and sample have the same relative noise).

## Exclusions (fixed)
A burst is excluded only for a logged I2C failure or a logged operator error. Nothing is excluded
for looking wrong.

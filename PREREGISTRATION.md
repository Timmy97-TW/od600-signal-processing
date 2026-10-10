# Pre-registration: OD600 reduction-algorithm comparison

Status: DRAFT. Fill the blanks, then commit this file **before** the first Day 1 measurement.
The commit timestamp is the evidence that the plan preceded the data.

- Date frozen: ____  ·  Frozen by: ____
- Instrument: inline photometer, firmware `od600_monitor/sketch.ino`, `VERBOSE_LOG 1`
- Counts at DI-water blank — sample: ____  reference: ____  (target: reference ≥ 300)
- Standard: 1 µm monodisperse SiO₂ microspheres, 25 mg/mL stock, lot ____

## Algorithms (fixed)
A0 current firmware (MAD gate, floor 1e-6) · A1 mean · A2 median · A3 20 % trimmed mean ·
A4 60–90th percentile band on the sample channel · A5 mean of per-sample OD ·
A6 mean of paired ratios · A7 MAD gate with a floor of 1 count.
Implementation: `analysis/replay_algorithms.py` at commit ____.

## Metrics (fixed)
1. Bias: reading minus the line through the lowest third of the ladder (static arm), in OD and %.
2. Repeatability: SD of the bursts at one level.
3. LOD = 3 × SD of the blank; LOQ = 10 × SD of the blank.
4. Upper limit: highest level with |bias| ≤ 5 %.
5. Hysteresis: ascending minus descending reading at matched concentration.

## Decision rule (fixed)
Among algorithms with |bias| ≤ 5 % in every arm across the validated range, adopt the one with the
lowest repeatability SD in the bubble arm (P1). On a tie (within 10 %), adopt the simplest.
Results for all eight are published whichever is chosen.

## Predictions written down in advance
- P1 bubbles: A1 and A6 read high by −5·log10(1 − f(1 − k)); A5 higher still; A2, A4, A7 within noise.
- P3 starved reference (~30 counts): single-reading SD rises several-fold for every algorithm;
  A0 shows a staircase that A1 and A7 do not.
- Clean arm: A0–A4, A6, A7 agree within noise; A5 differs by 0.217·5·σr².

## Exclusions (fixed)
A burst is excluded only for a logged I2C failure or a logged operator error. Nothing is excluded
for looking wrong.

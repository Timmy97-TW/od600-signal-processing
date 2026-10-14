/* 10 Oct 2026 results view. Data: window.RES (data/results_1010.json, built by analysis/sio2_1010_export.py). */
(function () {
  "use strict";
  const R = window.RES;
  if (!R) return;
  const SYM = ["qn", "biweight", "mean", "median"], ONE = ["upper", "p75", "p90"];

  function draw() {
    const H = window.OD600, { plot, el, L, C, fmt, $ } = H, J = R.J;
    const f = (v, d) => (v == null ? "—" : fmt(v, d));
    const pct = (v) => Math.round(v * 100) + "%";
    const zip = (a, b) => a.map((v, i) => [v, b[i]]).filter((p) => p[0] != null && p[1] != null);

    /* ---- R2 clean: estimator minus mad per step ---- */
    {
      const svg = $("rfig_clean"); svg.replaceChildren();
      ["V1", "V2"].forEach((u, k) => {
        const c = R.clean[u], ser = [];
        SYM.forEach((e) => ser.push({ pts: zip(c.n, c[e]), color: C.s1, w: 1.4, name: `${u} ${e}` }));
        ONE.forEach((e) => ser.push({ pts: zip(c.n, c[e]), color: C.s2, w: 1.4, name: `${u} ${e}` }));
        plot(svg, { box: { x: 62 + k * 440, y: 30, w: 378, h: 210 }, x: [0, 41], y: [-0.006, 0.006], yt: [-0.006, -0.004, -0.002, 0, 0.002, 0.004, 0.006],
          xt: [0, 10, 20, 30, 40], xlab: L("濃度點 n", "concentration step n"), ylab: k ? "" : L("減去 mad 的 OD", "OD minus mad"), yfmt: (v) => fmt(v, 3),
          series: ser, tipx: (v) => "n = " + v, tipy: (v) => (v >= 0 ? "+" : "") + fmt(v, 4) }, k > 0);
        el("text", { x: 62 + k * 440, y: 18, "font-size": 13, "font-weight": 600, fill: C.ink }, svg, u === "V1" ? L("V1 · 完整版", "V1 · complete") : L("V2 · 光纖版", "V2 · fibre"));
      });
      el("text", { x: 890, y: 18, "text-anchor": "end", "font-size": 12, fill: C.s1, "font-weight": 600 }, svg, L("— 對稱型", "— symmetric"));
      el("text", { x: 800, y: 18, "text-anchor": "end", "font-size": 12, fill: C.s2, "font-weight": 600 }, svg, L("— 單側型", "— one-sided"));
    }
    {
      let h = `<tr><th>${L("估計器", "Estimator")}</th><th>${L("類型", "Type")}</th><th class="num">${L("V1 單筆雜訊 (OD)", "V1 noise per reading (OD)")}</th><th class="num">${L("V2 單筆雜訊 (OD)", "V2 noise per reading (OD)")}</th><th class="num">${L("V1 與 mad 最大差", "V1 max gap to mad")}</th><th class="num">${L("V2 與 mad 最大差", "V2 max gap to mad")}</th></tr>`;
      R.est.forEach((e, i) => {
        h += `<tr><td><code>${e}</code></td><td>${ONE.includes(e) ? L("單側", "one-sided") : L("對稱", "symmetric")}</td><td class="num">${f(R.noise.V1[i], 4)}</td><td class="num">${f(R.noise.V2[i], 4)}</td><td class="num">${e === "mad" ? "—" : f(R.H5.V1[e], 4)}</td><td class="num">${e === "mad" ? "—" : f(R.H5.V2[e], 4)}</td></tr>`;
      });
      $("r_noise").innerHTML = h;
    }

    /* ---- R3 burst sign ---- */
    {
      const S = J.burst_sign, rows = [["V1 main run, flagged bursts", "V1", L("主實驗被標記的 burst", "flagged bursts, main run")], ["V2 bubble test", "V2", L("氣泡測試", "bubble test")], ["V2 main run, flagged bursts", "V2", L("主實驗被標記的 burst", "flagged bursts, main run")]];
      let h = `<tr><th>${L("單元", "Unit")}</th><th>${L("來源", "Source")}</th><th class="num">burst</th><th class="num">${L("樣本變亮 >3%", "samples brighter >3%")}</th><th class="num">${L("樣本變暗 >3%", "samples darker >3%")}</th><th class="num">${L("範圍（相對乾淨）", "range (× clean)")}</th></tr>`;
      rows.forEach(([k, u, lab]) => { const s = S[k]; h += `<tr><td>${u}</td><td>${lab}</td><td class="num">${s.bursts}</td><td class="num">${pct(s.brighter_3pct)}</td><td class="num">${pct(s.darker_3pct)}</td><td class="num">${s.min_rel.toFixed(2)}–${s.max_rel.toFixed(2)}×</td></tr>`; });
      $("r_sign").innerHTML = h;
    }

    /* ---- R3 bubble timeline ---- */
    {
      const svg = $("rfig_bubble"); svg.replaceChildren();
      ["V1", "V2"].forEach((u, k) => {
        const b = R.bubble[u], top = 26 + k * 228, hgt = 170;
        const ymax = u === "V1" ? 4 : 1.1;
        const p = plot(svg, { box: { x: 62, y: top, w: 818, h: hgt }, x: [0, 280], y: [0, ymax], xt: k ? undefined : [], xlab: k ? L("氣泡測試經過時間（s）", "bubble test elapsed time (s)") : "",
          ylab: "OD", yfmt: (v) => v.toFixed(1), series: [], }, k > 0);
        // slug bands
        b.t.forEach((t, i) => { if (b.cls[i] === "slug") el("rect", { x: p.X(t - 2.5), y: top, width: p.X(t + 2.5) - p.X(t - 2.5), height: hgt, fill: "#e8e8ed" }, p.g); });
        el("line", { x1: p.X(0), x2: p.X(280), y1: p.Y(b.level), y2: p.Y(b.level), stroke: C.ink3, "stroke-dasharray": "4 4", "stroke-width": 1.2 }, p.g);
        plot(svg, { box: { x: 62, y: top, w: 818, h: hgt }, x: [0, 280], y: [0, ymax], xt: [], yt: [], series: [
          { pts: zip(b.t, b.mad), color: C.s1, w: 1.8, name: `${u} mad` }, { pts: zip(b.t, b.upper), color: C.s2, w: 1.8, name: `${u} upper` },
          { pts: zip(b.t, b.mad).filter((q, i) => b.valid[i] === 0), color: C.ink, type: "dots", r: 2.4, ring: 0 }],
          tipx: (v) => v.toFixed(0) + " s", tipy: (v) => v.toFixed(3) }, true);
        b.t.forEach((t, i) => { if (b.valid[i] === 0) { const x = p.X(t), y = p.Y(Math.min(b.mad[i], ymax)); el("path", { d: `M${x - 3} ${y - 3}L${x + 3} ${y + 3}M${x - 3} ${y + 3}L${x + 3} ${y - 3}`, stroke: C.ink, "stroke-width": 1.2 }, svg); } });
        el("text", { x: 62, y: top - 8, "font-size": 13, "font-weight": 600, fill: C.ink }, svg, u === "V1" ? L(`V1 · 乾淨液位 ${b.level.toFixed(2)}`, `V1 · clean level ${b.level.toFixed(2)}`) : L(`V2 · 乾淨液位 ${b.level.toFixed(2)}`, `V2 · clean level ${b.level.toFixed(2)}`));
        if (!k) { el("text", { x: 880, y: top - 8, "text-anchor": "end", "font-size": 12, "font-weight": 600, fill: C.s1 }, svg, "— mad"); el("text", { x: 830, y: top - 8, "text-anchor": "end", "font-size": 12, "font-weight": 600, fill: C.s2 }, svg, "— upper"); el("text", { x: 770, y: top - 8, "text-anchor": "end", "font-size": 12, fill: C.ink3 }, svg, L("灰底＝氣柱", "grey = air slug")); }
      });
    }
    {
      let h = `<tr><th>${L("估計器", "Estimator")}</th><th class="num">${L("V1 平均誤差", "V1 mean error")}</th><th class="num">V1 RMSE</th><th class="num">${L("V1 ±0.05 內", "V1 within ±0.05")}</th><th class="num">${L("V2 平均誤差", "V2 mean error")}</th><th class="num">V2 RMSE</th><th class="num">${L("V2 ±0.05 內", "V2 within ±0.05")}</th></tr>`;
      R.est.forEach((e) => {
        const a = J.bubbles.V1.bubble_cycles[e], b = J.bubbles.V2.bubble_cycles[e];
        h += `<tr><td><code>${e}</code></td><td class="num">${(a.mean >= 0 ? "+" : "") + fmt(a.mean, 2)}</td><td class="num">${a.rmse.toFixed(2)}</td><td class="num">${pct(a.within_005)}</td><td class="num">${(b.mean >= 0 ? "+" : "") + fmt(b.mean, 3)}</td><td class="num">${b.rmse.toFixed(3)}</td><td class="num">${pct(b.within_005)}</td></tr>`;
      });
      $("r_bub").innerHTML = h;
    }

    /* ---- R4 pipelines ---- */
    {
      const P = J.pipeline, N = ["P0", "P1", "P2", "P3", "P4"];
      let h = `<tr><th></th><th class="num">${L("V1 穩態最大誤差", "V1 steady max error")}</th><th class="num">${L("V2 穩態最大誤差", "V2 steady max error")}</th><th class="num">${L("V1 氣泡測試最大誤差", "V1 bubble test max error")}</th><th class="num">${L("V2 氣泡測試最大誤差", "V2 bubble test max error")}</th><th class="num">${L("V1 延遲", "V1 lag")}</th><th class="num">${L("V2 延遲", "V2 lag")}</th></tr>`;
      N.forEach((n) => {
        const b = n === "P4" ? "<b>" : "", e = n === "P4" ? "</b>" : "";
        h += `<tr><td>${b}${n}${e}</td><td class="num">${b}${P.sio2_V1[n].steady_max.toFixed(3)}${e}</td><td class="num">${b}${P.sio2_V2[n].steady_max.toFixed(3)}${e}</td><td class="num">${b}${P.bubble_V1[n].max_abs.toFixed(3)}${e}</td><td class="num">${b}${P.bubble_V2[n].max_abs.toFixed(3)}${e}</td><td class="num">${P.sio2_V1[n].lag_median_s.toFixed(0)} s</td><td class="num">${P.sio2_V2[n].lag_median_s.toFixed(0)} s</td></tr>`;
      });
      $("r_pipe").innerHTML = h;
    }
    {
      const svg = $("rfig_replay"); svg.replaceChildren();
      const b = R.bubble.V1, ev = R.events.V1_air;
      plot(svg, { box: { x: 62, y: 30, w: 370, h: 200 }, x: [0, 280], y: [0, 4], xlab: L("氣泡測試（s）", "bubble test (s)"), ylab: "OD", yfmt: (v) => v.toFixed(1),
        series: [{ pts: zip(b.r_t, b.r_P0), color: C.s2, w: 1.8, name: "P0" }, { pts: zip(b.r_t, b.r_P4), color: C.s3, w: 2.4, name: "P4" },
          { pts: zip(b.r_t, b.r_P0), color: C.s2, type: "dots", r: 3 }, { pts: zip(b.r_t, b.r_P4), color: C.s3, type: "dots", r: 3 }],
        tipx: (v) => v.toFixed(0) + " s", tipy: (v) => v.toFixed(3) }, false);
      plot(svg, { box: { x: 510, y: 30, w: 370, h: 200 }, x: [0, 24], y: [0, 4], xt: [0, 4, 8, 12, 16, 20, 24], xlab: L(`主實驗，${ev.t0_utc} UTC 之後（min）`, `main run, minutes after ${ev.t0_utc} UTC`), yfmt: (v) => v.toFixed(1),
        series: [{ pts: zip(ev.t, ev.mad), color: C.grid, w: 1 }, { pts: zip(ev.r_t, ev.r_P0), color: C.s2, w: 1.8, name: "P0" }, { pts: zip(ev.r_t, ev.r_P4), color: C.s3, w: 2.4, name: "P4" }],
        tipx: (v) => v.toFixed(1) + " min", tipy: (v) => v.toFixed(3) }, true);
      el("text", { x: 62, y: 18, "font-size": 13, "font-weight": 600, fill: C.ink }, svg, L("V1 · 氣泡測試", "V1 · bubble test"));
      el("text", { x: 510, y: 18, "font-size": 13, "font-weight": 600, fill: C.ink }, svg, L("V1 · 11:12 起的 6 分鐘氣柱", "V1 · 6-minute slug from 11:12"));
      el("text", { x: 880, y: 18, "text-anchor": "end", "font-size": 12, "font-weight": 600, fill: C.s3 }, svg, "— P4");
      el("text", { x: 835, y: 18, "text-anchor": "end", "font-size": 12, "font-weight": 600, fill: C.s2 }, svg, "— P0 (upper)");
    }

    /* ---- R5 reference ---- */
    {
      const svg = $("rfig_ref"); svg.replaceChildren(); const e = R.events.V2_light;
      plot(svg, { box: { x: 62, y: 30, w: 818, h: 130 }, x: [0, 20], y: [0.5, 1.1], yt: [0.6, 0.8, 1.0], xt: [], ylab: L("相對亮度", "relative"), yfmt: (v) => v.toFixed(1),
        series: [{ pts: zip(e.t, e.ref), color: C.s4, w: 1.8, name: L("參考", "reference") }, { pts: zip(e.t, e.sample), color: C.s1, w: 1.4, dash: "5 3", name: L("樣本", "sample") }], tipx: (v) => v.toFixed(1) + " min", tipy: (v) => v.toFixed(3) + "×" }, false);
      plot(svg, { box: { x: 62, y: 196, w: 818, h: 150 }, x: [0, 20], y: [0.5, 0.7], xt: [0, 4, 8, 12, 16, 20], xlab: L(`${e.t0_utc} UTC 之後（min）`, `minutes after ${e.t0_utc} UTC`), ylab: "OD", yfmt: (v) => v.toFixed(2),
        series: [{ pts: zip(e.t, e.single), color: C.s2, w: 1.5, name: "od_single" }, { pts: zip(e.t, e.dual), color: C.s3, w: 2, name: "od_dual" }], tipx: (v) => v.toFixed(1) + " min", tipy: (v) => v.toFixed(4) }, true);
      el("text", { x: 880, y: 20, "text-anchor": "end", "font-size": 12, "font-weight": 600, fill: C.s4 }, svg, L("— 參考", "— reference"));
      el("text", { x: 800, y: 20, "text-anchor": "end", "font-size": 12, "font-weight": 600, fill: C.s1 }, svg, L("- - 樣本", "- - sample"));
      el("text", { x: 880, y: 188, "text-anchor": "end", "font-size": 12, "font-weight": 600, fill: C.s3 }, svg, "— od_dual");
      el("text", { x: 790, y: 188, "text-anchor": "end", "font-size": 12, "font-weight": 600, fill: C.s2 }, svg, "— od_single");
    }

    /* ---- R6 calibration ---- */
    {
      const svg = $("rfig_cal"); svg.replaceChildren(); const c = R.cal, cj = J.calibration;
      const bd = c.bd, dil = { C: [].concat(bd.x2 ? bd.x2.C : [], bd.x4 ? bd.x4.C : []), od: [].concat(bd.x2 ? bd.x2.od : [], bd.x4 ? bd.x4.od : []) };
      plot(svg, { box: { x: 62, y: 30, w: 370, h: 230 }, x: [0, 1.4], y: [0, 4], xlab: "C (mg/mL)", ylab: "OD", yfmt: (v) => v.toFixed(1),
        series: [{ pts: zip(c.C, c.V1), color: C.s1, w: 2, name: "V1" }, { pts: zip(c.C, c.V2), color: C.s2, w: 2, name: "V2" },
          { pts: zip(bd.direct.C, bd.direct.od), color: C.s3, type: "dots", r: 3.5, name: L("BioDrop 直讀", "BioDrop direct") },
          { pts: zip(dil.C, dil.od), color: C.s4, type: "dots", r: 3.5, name: L("BioDrop 稀釋校正", "BioDrop diluted") }],
        tipx: (v) => v.toFixed(3) + " mg/mL", tipy: (v) => v.toFixed(3) }, false);
      const dev = (u) => { const a = cj[u + "_linear"]; return c.C.map((x, i) => [x, c[u][i] == null || !c.n[i] ? null : 100 * (c[u][i] / (a.slope_per_mgml * x + a.intercept) - 1)]).filter((p) => p[1] != null && p[0] > 0.1); };
      plot(svg, { box: { x: 510, y: 30, w: 370, h: 230 }, x: [0, 1.4], y: [-20, 10], yt: [-20, -15, -10, -5, 0, 5, 10], xlab: "C (mg/mL)", ylab: L("偏離 (%)", "departure (%)"),
        series: [{ pts: [[0, -5], [1.4, -5]], color: C.ink3, w: 1, dash: "3 4" }, { pts: dev("V1"), color: C.s1, w: 2, name: "V1" }, { pts: dev("V2"), color: C.s2, w: 2, name: "V2" }],
        tipx: (v) => v.toFixed(3) + " mg/mL", tipy: (v) => (v >= 0 ? "+" : "") + v.toFixed(1) + "%" }, true);
      [["V1", C.s1, 62], ["V2", C.s2, 110], [L("BioDrop 直讀", "BioDrop direct"), C.s3, 158], [L("稀釋校正", "diluted"), C.s4, 272]].forEach(([t, col, x]) => el("text", { x, y: 18, "font-size": 12, "font-weight": 600, fill: col }, svg, (t.length < 4 ? "— " : "● ") + t));
      el("text", { x: 516, y: 18, "font-size": 12, fill: C.ink3 }, svg, L("虛線＝ −5%", "dashed = −5%"));
    }
    {
      const cj = J.calibration, a = cj.V1_linear, b = cj.V2_linear;
      $("r_cal").innerHTML = `<tr><th></th><th class="num">V1</th><th class="num">V2</th></tr>
        <tr><td>${L("對 BioDrop 斜率（BioDrop < 1.0）", "slope against BioDrop (BioDrop < 1.0)")}</td><td class="num">${cj.V1_vs_BD_lo.slope.toFixed(2)}</td><td class="num">${cj.V2_vs_BD_lo.slope.toFixed(3)}</td></tr>
        <tr><td>${L("對 BioDrop 截距", "intercept against BioDrop")}</td><td class="num">${fmt(cj.V1_vs_BD_lo.intercept, 3)}</td><td class="num">${fmt(cj.V2_vs_BD_lo.intercept, 3)}</td></tr>
        <tr><td>${L("全範圍對 C 的 R²", "R² against C, full range")}</td><td class="num">${a.full_r2.toFixed(4)}</td><td class="num">${b.full_r2.toFixed(4)}</td></tr>
        <tr><td>${L("全範圍殘差 SD（OD）", "residual SD, full range (OD)")}</td><td class="num">${a.full_resid_sd.toFixed(3)}</td><td class="num">${b.full_resid_sd.toFixed(4)}</td></tr>
        <tr><td>${L("n = 40 相對低段直線", "n = 40 against the low-range line")}</td><td class="num">${fmt(a.dev_at_n40_pct, 1)}%</td><td class="num">${fmt(b.dev_at_n40_pct, 1)}%</td></tr>
        <tr><td>${L("首次偏離 5% 的點", "first 5% departure")}</td><td class="num">n = ${a.depart5_n}</td><td class="num">n = ${b.depart5_n}</td></tr>`;
    }

    /* ---- R7 scorecard (also feeds the result column on the assay tab) ---- */
    const S = window.RESULTS_H = score(J, L, fmt);
    {
      let h = `<tr><th>#</th><th>${L("門檻", "Threshold")}</th><th>${L("結果", "Result")}</th><th>${L("判定", "Verdict")}</th></tr>`;
      S.forEach((s) => { h += `<tr><td>${s.id}</td><td>${s.thr}</td><td>${s.res}</td><td><span class="pill ${s.cls}">${s.verdict}</span></td></tr>`; });
      $("r_score").innerHTML = h;
      document.querySelectorAll("table.hyp td.res").forEach((td, i) => { const s = S[i]; if (!s) return; td.innerHTML = `<span class="pill ${s.cls}">${s.verdict}</span><br>${s.res}`; td.classList.add("done"); });
    }
  }

  function score(J, L, fmt) {
    const c = J.calibration, b = J.bubbles, P = (ok) => (ok ? ["ok", L("成立", "held")] : ["bad", L("不成立", "failed")]);
    const out = [];
    const push = (id, thr, res, cv) => out.push({ id, thr, res, cls: cv[0], verdict: cv[1] });
    push("H1", "1.8–2.8", L(`n = 1–8 斜率 ${c.H1.slope.toFixed(2)} OD·mL/mg（V = 50 mL）`, `slope over n = 1–8 is ${c.H1.slope.toFixed(2)} OD·mL/mg (V = 50 mL)`), P(c.H1.pass_));
    push("H2", L("低 > 10%", "> 10% low"), L(`直讀平均低 ${Math.abs(c.H2.mean_pct).toFixed(1)}%（−2 到 −12%）；n ≥ ${c.H2.clipped_from_n} 直讀卡在 2.500`, `direct is ${Math.abs(c.H2.mean_pct).toFixed(1)}% low on average (−2 to −12%); from n = ${c.H2.clipped_from_n} it is pinned at 2.500`), P(c.H2.pass_));
    push("H3", "0.6–1.0", L(`V1 斜率 ${c.H3.slope.toFixed(2)}，截距 ${fmt(c.V1_vs_BD_lo.intercept, 2)}`, `V1 slope ${c.H3.slope.toFixed(2)}, intercept ${fmt(c.V1_vs_BD_lo.intercept, 2)}`), P(c.H3.pass_));
    push("H4", L("光纖斜率較高、線性範圍不較窄", "fibre slope higher, linear range no narrower"), L(`V2/V1 斜率比 ${c.H4.slope_V2_over_V1.toFixed(2)}；5% 偏離 V2 n = ${c.H4.depart_V2}、V1 n = ${c.H4.depart_V1}（但 n = 40 時 V2 ${fmt(c.V2_linear.dev_at_n40_pct, 1)}%、V1 ${fmt(c.V1_linear.dev_at_n40_pct, 1)}%）`, `V2/V1 slope ratio ${c.H4.slope_V2_over_V1.toFixed(2)}; 5% departure at n = ${c.H4.depart_V2} (V2) vs n = ${c.H4.depart_V1} (V1), though at n = 40 V2 is ${fmt(c.V2_linear.dev_at_n40_pct, 1)}% and V1 ${fmt(c.V1_linear.dev_at_n40_pct, 1)}%`), P(false));
    push("H5", "|Δ| ≤ 0.01 / 0.02", L("qn 0.0015、biweight 0.0006、upper 0.0027（V1 最大值）；V2 更小", "qn 0.0015, biweight 0.0006, upper 0.0027 (V1 maxima); V2 smaller"), P(true));
    push("H6", "SD(upper) ≤ ½ SD(mad)", L(`V1 ${b.V1.H6.sd_upper.toFixed(2)} 對 ${b.V1.H6.sd_mad.toFixed(2)}；V2 ${b.V2.H6.sd_upper.toFixed(3)} 對 ${b.V2.H6.sd_mad.toFixed(3)}；V1 上 upper 平均誤差是 mad 的 2 倍`, `V1 ${b.V1.H6.sd_upper.toFixed(2)} vs ${b.V1.H6.sd_mad.toFixed(2)}; V2 ${b.V2.H6.sd_upper.toFixed(3)} vs ${b.V2.H6.sd_mad.toFixed(3)}; on V1 upper's mean error is twice mad's`), P(b.V1.H6.pass_ && b.V2.H6.pass_));
    push("H7", L("SD 2 倍內、平均差 ≤ 0.05", "SDs within 2×, means within 0.05"), L(`SD 比 ${b.V1.H7.sd_ratio.toFixed(2)}／${b.V2.H7.sd_ratio.toFixed(2)}，平均差 ${b.V1.H7.mean_span.toFixed(3)}／${b.V2.H7.mean_span.toFixed(3)}（V1／V2）`, `SD ratio ${b.V1.H7.sd_ratio.toFixed(2)} / ${b.V2.H7.sd_ratio.toFixed(2)}, mean span ${b.V1.H7.mean_span.toFixed(3)} / ${b.V2.H7.mean_span.toFixed(3)} (V1 / V2)`), P(b.V1.H7.pass_ && b.V2.H7.pass_));
    push("H8", "0.95–1.05", L(`對 BioDrop：V1 ${c.H8_V1.vs_BD.toFixed(2)}、V2 ${c.H8_V2.vs_BD.toFixed(2)}；對 C：V1 ${c.H8_V1.vs_C.toFixed(2)}、V2 ${c.H8_V2.vs_C.toFixed(2)}。對 BioDrop 兩台都向下彎；對 C，V2 是直的、V1 向下彎。9/19 的向上彎沒有重現`, `against BioDrop: V1 ${c.H8_V1.vs_BD.toFixed(2)}, V2 ${c.H8_V2.vs_BD.toFixed(2)}; against C: V1 ${c.H8_V1.vs_C.toFixed(2)}, V2 ${c.H8_V2.vs_C.toFixed(2)}. Against BioDrop both bend down; against C, V2 is straight and V1 bends down. The 19 Sept upward bend did not recur`), P(false));
    return out;
  }

  window.drawResults = draw;
})();

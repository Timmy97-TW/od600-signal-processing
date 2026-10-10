/* SiO2 calibration assay tab. Uses helpers exported by app.js as window.OD600. */
(function () {
  "use strict";
  let state = { sc: "clean", seed: 3 };
  const SC = {
    clean: { level: 2400, read: 0.3, src: 0.004, f: 0, k: 0.5 },
    low: { level: 32.35, read: 0.3, src: 0, f: 0, k: 0.5 },
    b15: { level: 2400, read: 0.3, src: 0.004, f: 0.15, k: 0.5 },
    b35: { level: 2400, read: 0.3, src: 0.004, f: 0.35, k: 0.5 },
  };
  const FLOOR = 1e-6, MADK = 3;

  /* ---- ports of firmware v3.10.9 robustMean(); each returns {est, w[], lo, hi} ---- */
  function est(name, x, H) {
    const med = H.median(x), n = x.length;
    const mad = Math.max(H.median(x.map((v) => Math.abs(v - med))) * 1.4826, FLOOR);
    if (name === "mad" || name === "qn") {
      let sc = mad;
      if (name === "qn") {
        const d = []; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) d.push(Math.abs(x[i] - x[j]));
        d.sort((a, b) => a - b); const h = Math.floor(n / 2) + 1, k = Math.min(Math.max((h * (h - 1)) / 2, 1), d.length);
        sc = Math.max(2.2219 * d[k - 1], FLOOR);
      }
      const w = x.map((v) => (Math.abs(v - med) <= MADK * sc ? 1 : 0)), sw = w.reduce((a, b) => a + b, 0);
      return { est: sw ? x.reduce((a, v, i) => a + v * w[i], 0) / sw : med, w, lo: med - MADK * sc, hi: med + MADK * sc };
    }
    if (name === "biweight") {
      const c = 4.685; let T = med;
      for (let it = 0; it < 8; it++) {
        let sw = 0, swx = 0;
        x.forEach((v) => { const u = (v - T) / (c * mad); if (Math.abs(u) < 1) { const q = (1 - u * u) * (1 - u * u); sw += q; swx += q * v; } });
        if (sw <= 0) break; const Tn = swx / sw, done = Math.abs(Tn - T) < 1e-4 * (Math.abs(T) + 1e-3); T = Tn; if (done) break;
      }
      const w = x.map((v) => { const u = (v - T) / (c * mad); return Math.abs(u) < 1 ? (1 - u * u) * (1 - u * u) : 0; });
      return { est: T, w, lo: T - c * mad, hi: T + c * mad };
    }
    const w = x.map((v) => (v >= med ? 1 : 0)), sw = w.reduce((a, b) => a + b, 0);   // upper
    return { est: sw ? x.reduce((a, v, i) => a + v * w[i], 0) / sw : med, w, lo: med, hi: Infinity };
  }
  function burst(r, p, H) {
    const x = [];
    for (let i = 0; i < 14; i++) x.push(Math.round(p.level * (1 + p.src * H.gauss(r)) * (r() < p.f ? p.k : 1) + p.read * H.gauss(r)));
    return x;
  }
  const NAMES = ["mad", "qn", "biweight", "upper"];

  function efig4(H) {
    const { el, L, C } = H, p = SC[state.sc], svg = H.$("efig4"); svg.replaceChildren();
    const x = burst(H.rng(state.seed * 977 + 13), p, H);
    const cut = p.f > 0 ? p.level * 0.8 : -Infinity, bright = x.filter((v) => v >= cut), dark = x.filter((v) => v < cut);
    const lo0 = Math.min(...bright, p.level), hi0 = Math.max(...bright, p.level), pad = Math.max(1.2, (hi0 - lo0) * 0.08), lo = lo0 - pad, hi = hi0 + pad;
    const zone = p.f > 0 ? 120 : 0, bx = 150 + zone, bw = 520 - zone, X = (v) => bx + ((v - lo) / (hi - lo)) * bw, col = [C.s1, C.s3, C.s4, C.s2];
    const order = x.map((v, i) => i).sort((a, b) => x[a] - x[b]);
    NAMES.forEach((nm, r) => {
      const y = 50 + r * 86, e = est(nm, x, H);
      el("text", { x: 20, y: y + 5, "font-size": 15, "font-weight": 600, fill: C.ink, "font-family": "ui-monospace,Menlo,monospace" }, svg, nm);
      el("line", { x1: 150, x2: 670, y1: y + 26, y2: y + 26, stroke: C.grid }, svg);
      if (zone) { el("rect", { x: 150, y: y - 30, width: zone - 14, height: 56, rx: 6, fill: C.ink, opacity: 0.045 }, svg); }
      const gl = Math.max(bx, X(Math.max(lo, e.lo))), gh = Math.min(bx + bw, X(Math.min(hi, e.hi)));
      if (gh > gl && e.hi > lo) el("rect", { x: gl, y: y - 30, width: Math.max(3, gh - gl), height: 56, rx: 6, fill: col[r], opacity: 0.1 }, svg);
      const stacks = {}; let di = 0;
      order.forEach((i) => {
        const v = x[i], w = e.w[i]; let cx, cy;
        if (v < cut) { cx = 162 + (di % 9) * 10; cy = y + 16 - Math.floor(di / 9) * 11; di++; }
        else { cx = X(v); const key = Math.round(cx / 9), st = (stacks[key] = (stacks[key] || 0) + 1) - 1; cx += (st % 2) * 9 - 4.5; cy = y + 17 - Math.floor(st / 2) * 8.5; }
        el("circle", { cx, cy, r: 4, fill: w > 0 ? col[r] : "#fff", "fill-opacity": w > 0 ? 0.25 + 0.75 * w : 1, stroke: w > 0 ? col[r] : C.ink3, "stroke-width": 1.4 }, svg);
      });
      const inBright = e.est >= lo, ex = inBright ? X(e.est) : 150 + (zone - 14) / 2;
      el("line", { x1: X(p.level), x2: X(p.level), y1: y - 34, y2: y + 30, stroke: C.ink3, "stroke-width": 1.5, "stroke-dasharray": "4 3" }, svg);
      el("line", { x1: ex, x2: ex, y1: y - 34, y2: y + 30, stroke: col[r], "stroke-width": 2.5 }, svg);
      const err = H.K * Math.log10(p.level / e.est), used = e.w.filter((q) => q > 0).length;
      el("text", { x: 690, y: y - 4, "font-size": 14, "font-weight": 600, fill: C.ink }, svg, e.est.toFixed(p.level < 100 ? 2 : 0) + " counts");
      el("text", { x: 690, y: y + 15, "font-size": 12.5, fill: Math.abs(err) > 0.05 ? "#c9302c" : C.ink2, "font-weight": Math.abs(err) > 0.05 ? 600 : 400 }, svg, L("誤差 ", "error ") + (err >= 0 ? "+" : "") + H.fmt(err, 3) + " OD · " + L("用了 ", "used ") + used + "/14");
    });
    if (zone) el("text", { x: 150 + (zone - 14) / 2, y: 392, "text-anchor": "middle", "font-size": 12, fill: C.ink3 }, svg, L("被氣泡遮住（" + dark.length + " 個）", "hit by bubbles (" + dark.length + ")"));
    [lo0, p.level, hi0].forEach((v, i) => { if (i === 1 || Math.abs(X(v) - X(p.level)) > 60) el("text", { x: X(v), y: 392, "text-anchor": "middle", "font-size": 12, fill: C.ink3 }, svg, i === 1 ? L("真實值 ", "true ") + v : v); });
    if (!zone) el("text", { x: 20, y: 392, "font-size": 12, fill: C.ink3 }, svg, L("感測器 counts →", "sensor counts →"));
    const notes = {
      clean: L("乾淨時四個估計器幾乎重合。注意 upper 的線總是在右邊一點：它只用亮的那一半，所以估計值固定偏高一點。", "When clean, all four nearly coincide. Note that upper always sits slightly to the right: it uses only the brighter half, so its estimate is a little high by construction."),
      low: L("只有 32 個 counts 時，大多數樣本是同一個整數。mad、qn、biweight 的「正常範圍」縮成一條線（寬度為 0），只留下眾數，其他全丟。真實值是 32.35，它們只能回報 32 或 33。", "With only 32 counts most samples are the same integer. For mad, qn and biweight the normal range collapses to a line of zero width: they keep the mode and drop the rest. The true value is 32.35, yet they can only return 32 or 33."),
      b15: L("被氣泡遮到的樣本落在左邊遠處。四個估計器都把它們排除了，所以這個 burst 大家都對。多按幾次「換一個 burst」，偶爾會遇到氣泡樣本特別多的一次。", "Samples hit by bubbles land far to the left. All four exclude them, so everyone gets this burst right. Press New burst a few times: occasionally a burst has many more bubble samples."),
      b35: L("當接近一半的樣本被遮，中位數本身可能被拉到左邊或卡在兩群中間。mad、qn、biweight 以中位數為中心，會跟著錯；upper 只取中位數以上，比較容易還留在亮的那一群。多按幾次看看誰先垮。", "When nearly half the samples are hit, the median itself can be dragged left or stuck between the two groups. mad, qn and biweight centre on the median and go wrong with it; upper takes only what lies above the median and is more likely to stay in the bright group. Press a few times and see who fails first."),
    };
    H.$("e_note").textContent = notes[state.sc];
  }

  function etab(H) {
    const { L } = H, rows = NAMES.concat(["mean"]), cols = ["clean", "low", "b15", "b35"], res = {};
    cols.forEach((c, ci) => {
      const r = H.rng(100 + ci), p = SC[c], acc = {}; rows.forEach((n) => (acc[n] = []));
      for (let b = 0; b < 4000; b++) {
        const lv = c === "low" ? 32 + r() : p.level, x = burst(r, Object.assign({}, p, { level: lv }), H);
        rows.forEach((n) => acc[n].push(H.K * Math.log10(lv / (n === "mean" ? H.mean(x) : est(n, x, H).est))));
      }
      rows.forEach((n) => (res[n + c] = [H.median(acc[n]), acc[n].filter((v) => Math.abs(v) > 0.05).length / acc[n].length]));
    });
    const head = [L("乾淨（2400 counts）", "Clean (2400 counts)"), L("counts 很少（32–33）", "Few counts (32–33)"), L("15% 樣本被遮一半", "15% of samples half-blocked"), L("35% 樣本被遮一半", "35% of samples half-blocked")];
    let h = `<tr><th>${L("估計器", "Estimator")}</th>` + head.map((t) => `<th class="num">${t}</th>`).join("") + "</tr>";
    rows.forEach((n) => {
      h += `<tr><td>${n === "mean" ? L("單純平均（對照）", "plain mean (control)") : "<code>" + n + "</code>"}</td>` + cols.map((c) => {
        const v = res[n + c], pc = v[1] * 100;
        return `<td class="c" style="background:rgba(235,104,52,${(Math.min(1, v[1] / 0.5) * 0.45).toFixed(3)})">${(v[0] >= 0 ? "+" : "") + H.fmt(v[0], 3)} · <b>${pc < 0.05 ? "0" : pc < 10 ? pc.toFixed(1) : pc.toFixed(0)}%</b></td>`;
      }).join("") + "</tr>";
    });
    H.$("e_tab").innerHTML = h;
  }

  function loopfig(H) {
    const { el, L, C } = H, svg = H.$("loopfig"); svg.replaceChildren();
    const box = (x, y, w, h, t1, t2, fill, ink) => {
      el("rect", { x, y, width: w, height: h, rx: 14, fill: fill || "#f5f5f7", stroke: fill ? "none" : "#d2d2d7" }, svg);
      el("text", { x: x + w / 2, y: y + h / 2 + (t2 ? -3 : 5), "text-anchor": "middle", "font-size": 14, "font-weight": 600, fill: ink || C.ink }, svg, t1);
      if (t2) el("text", { x: x + w / 2, y: y + h / 2 + 15, "text-anchor": "middle", "font-size": 12, fill: ink || C.ink3 }, svg, t2);
    };
    const pipe = (d) => el("path", { d, fill: "none", stroke: C.s1, "stroke-width": 5, "stroke-linecap": "round", "stroke-linejoin": "round", opacity: 0.55 }, svg);
    const arr = (x, y, dir) => el("path", { d: dir === "r" ? `M${x - 7} ${y - 7}L${x + 5} ${y}L${x - 7} ${y + 7}Z` : dir === "l" ? `M${x + 7} ${y - 7}L${x - 5} ${y}L${x + 7} ${y + 7}Z` : `M${x - 7} ${y - 7}L${x} ${y + 5}L${x + 7} ${y - 7}Z`, fill: C.s1 }, svg);
    pipe("M150 150 V70 H330"); pipe("M430 70 H520"); pipe("M650 70 H730 V250 H190"); arr(250, 70, "r"); arr(475, 70, "r"); arr(690, 70, "r"); arr(460, 250, "l"); arr(730, 160, "d");
    // beaker
    el("path", { d: "M70 140 V285 Q70 300 85 300 H215 Q230 300 230 285 V140", fill: "#fff", stroke: C.ink2, "stroke-width": 2 }, svg);
    el("rect", { x: 72, y: 190, width: 156, height: 108, rx: 10, fill: C.s1, opacity: 0.16 }, svg);
    el("rect", { x: 125, y: 284, width: 50, height: 8, rx: 4, fill: C.ink2 }, svg);
    el("text", { x: 150, y: 232, "text-anchor": "middle", "font-size": 14, "font-weight": 600, fill: C.ink }, svg, L("燒杯 50 mL", "Beaker 50 mL"));
    el("text", { x: 150, y: 252, "text-anchor": "middle", "font-size": 12, fill: C.ink3 }, svg, L("持續攪拌", "stirred throughout"));
    box(330, 42, 100, 56, L("蠕動幫浦", "Pump"), "~60 mL/min");
    box(520, 42, 130, 56, L("光度計 1", "Photometer 1"), L("傾斜版", "tilted"), C.s2, "#fff");
    box(540, 222, 130, 56, L("光度計 2", "Photometer 2"), L("光纖簡化版", "fibre, simplified"), C.s3, "#fff");
    // pipette & biodrop
    el("path", { d: "M52 96 L52 30", stroke: C.s4, "stroke-width": 4, "stroke-linecap": "round" }, svg); el("path", { d: "M45 96 L52 112 L59 96Z", fill: C.s4 }, svg);
    el("text", { x: 20, y: 22, "font-size": 12.5, "font-weight": 600, fill: C.ink2 }, svg, L("① 加 1 mL 工作液", "① add 1 mL working stock"));
    el("path", { d: "M236 200 C300 200 300 150 356 150", fill: "none", stroke: C.ink3, "stroke-width": 1.5, "stroke-dasharray": "5 4" }, svg);
    box(356, 124, 110, 52, "BioDrop", L("1 cm，600 nm", "1 cm, 600 nm"), C.ink, "#fff");
    el("text", { x: 300, y: 196, "font-size": 12.5, "font-weight": 600, fill: C.ink2 }, svg, L("④ 取 1 mL", "④ take 1 mL"));
    el("text", { x: 790, y: 164, "font-size": 12, fill: C.ink3 }, svg, L("管路體積 vₜ", "hold-up vₜ"));
    el("text", { x: 585, y: 310, "text-anchor": "middle", "font-size": 12, fill: C.ink3 }, svg, L("兩台串聯：同一份液體先後流過", "in series: the same liquid passes both"));
  }

  const Cn = (n, V) => 2.5 * (1 - Math.pow((V - 1) / V, n));
  function helper(H) {
    const { el, L, C } = H, n = +H.$("h_n").value, vt = +H.$("h_vt").value, V = 50 + vt;
    H.$("h_nv").textContent = n; H.$("h_vtv").textContent = vt.toFixed(1);
    const a = [], b = []; for (let i = 0; i <= 50; i++) { a.push([i, Cn(i, 50)]); b.push([i, Cn(i, V)]); }
    const p = H.plot(H.$("cnfig"), { x: [0, 50], y: [0, 1.8], xt: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50], xlab: L("加樣次數 n", "additions n"), ylab: "Cₙ (mg/mL)",
      series: [{ pts: a, color: C.s1, name: "V = 50" }].concat(vt > 0 ? [{ pts: b, color: C.s2, name: "V = " + V }] : []), tipx: (v) => "n = " + v, tipy: (v) => v.toFixed(4) + " mg/mL" });
    for (let i = 5; i <= 50; i += 5) el("circle", { cx: p.X(i), cy: p.Y(Cn(i, 50)), r: 5, fill: [10, 25, 40].includes(i) ? C.s3 : C.s4, stroke: "#fff", "stroke-width": 2 }, p.g);
    const x10 = p.X(10); el("rect", { x: x10, y: p.b.y, width: p.b.x + p.b.w - x10, height: p.b.h, fill: C.ink, opacity: 0.035 }, p.g);
    el("text", { x: x10 + 8, y: p.b.y + p.b.h - 10, "font-size": 12, fill: C.ink3 }, p.g, L("n ≥ 10：BioDrop 加做 5 倍稀釋", "n ≥ 10: also read a 5-fold dilution on the BioDrop"));
    el("line", { x1: p.X(n), x2: p.X(n), y1: p.b.y, y2: p.b.y + p.b.h, stroke: C.ink, "stroke-dasharray": "3 3" }, p.g);
    const c = Cn(n, V), th = 2.3 * c, stop = n > 0 && n % 5 === 0, ch = [10, 25, 40].includes(n);
    const what = n === 0 ? L("空白：四個估計器各 3 筆", "Blank: 3 readings per estimator") : ch ? L("四估計器 + 氣泡挑戰", "Four estimators + bubble challenge") : stop ? L("四估計器各 3 筆", "3 readings per estimator") : L("mad，3 筆", "mad, 3 readings");
    H.readout("h_read", [[c.toFixed(4), "Cₙ (mg/mL)"], [(c * 8.3).toFixed(2) + " × 10⁸", L("顆粒 / mL", "particles / mL")], [th.toFixed(2), L("BioDrop 理論 OD", "BioDrop, theory")],
      [(c * 0.396 * 5).toFixed(2), L("inline 預估（9/19 斜率 ×5）", "inline estimate (19 Sept slope ×5)")], [2.3 * Cn(n, 50) > 1 ? L("直讀 + 稀釋", "direct + diluted") : L("直讀", "direct"), "BioDrop"], [what, L("這一站要做", "at this stop")]]);
  }

  function hypfig(H) {
    const { el, L, C } = H, th = [], bd = [], il = [], xs = [];
    for (let c = 0; c <= 1.6001; c += 0.02) xs.push(c);
    const bdf = (c, s) => { const o = s * c; return o / (1 + 0.12 * o); };       // gentle saturation, for illustration
    xs.forEach((c) => { th.push([c, 2.3 * c]); bd.push([c, bdf(c, 2.3)]); il.push([c, 0.8 * 2.3 * c]); });
    const p = H.plot(H.$("hypfig"), { x: [0, 1.6], y: [0, 4], xlab: "SiO₂ (mg/mL)", ylab: "OD600", series: [] });
    const band = (lo, hi, col) => { let d = ""; xs.forEach((c, i) => (d += (i ? "L" : "M") + p.X(c) + " " + p.Y(Math.min(4, hi(c))))); xs.slice().reverse().forEach((c) => (d += "L" + p.X(c) + " " + p.Y(lo(c)))); el("path", { d: d + "Z", fill: col, opacity: 0.13 }, p.g); };
    band((c) => bdf(c, 1.8) * 0.9, (c) => bdf(c, 2.8), C.s1); band((c) => 0.6 * 1.8 * c, (c) => 1.0 * 2.8 * c * 0.9, C.s2);
    const line = (pts, col, dash) => el("path", { d: pts.map((q, i) => (i ? "L" : "M") + p.X(q[0]) + " " + p.Y(Math.min(4, q[1]))).join(""), fill: "none", stroke: col, "stroke-width": 2, "stroke-dasharray": dash || "" }, p.g);
    line(th.filter((q) => q[1] <= 4), C.ink3, "5 4"); line(bd, C.s1); line(il, C.s2);
    el("text", { x: p.X(1.12), y: p.Y(2.72), "font-size": 12.5, fill: C.ink2 }, p.g, L("BioDrop 直讀：往下彎（H2）", "BioDrop direct: bends down (H2)"));
    el("text", { x: p.X(1.0), y: p.Y(1.42), "font-size": 12.5, fill: C.ink2 }, p.g, L("inline：斜率較低（H3）", "inline: lower slope (H3)"));
    el("text", { x: p.X(0.06), y: p.Y(0.95), "font-size": 12.5, fill: C.ink2 }, p.g, L("低濃度：三者貼近（H1）", "low range: all close (H1)"));
  }

  window.drawAssay = function () {
    const H = window.OD600; if (!H) return;
    efig4(H); etab(H); loopfig(H); helper(H); hypfig(H);
  };
  document.addEventListener("DOMContentLoaded", () => {
    const H = () => window.OD600, g = (id) => document.getElementById(id);
    g("e_sc").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      state.sc = b.dataset.s; g("e_sc").querySelectorAll("button").forEach((q) => q.setAttribute("aria-pressed", q === b)); efig4(H());
    }));
    g("e_new").addEventListener("click", () => { state.seed++; efig4(H()); });
    ["h_n", "h_vt"].forEach((id) => g(id).addEventListener("input", () => helper(H())));
  });
})();

/* OD600 signal-processing study: interactive figures. No dependencies. */
(function () {
  "use strict";
  const D = window.DATA, K = 5, NS = "http://www.w3.org/2000/svg";
  const C = { s1: "#2a78d6", s2: "#eb6834", s3: "#1baf7a", s4: "#eda100", ink: "#1d1d1f", ink2: "#515154", ink3: "#86868b", grid: "#e8e8ed" };
  const $ = (id) => document.getElementById(id);
  const lang = () => document.documentElement.dataset.lang;
  const L = (zh, en) => (lang() === "zh" ? zh : en);
  const fmt = (v, d) => (v < 0 ? "−" : "") + Math.abs(v).toFixed(d);
  const tip = $("tip");

  function el(tag, attrs, parent, text) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function rng(seed) { // mulberry32
    let a = seed >>> 0;
    return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function gauss(r) { let u = 0; while (u === 0) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }
  const median = (a) => { const s = Array.from(a).sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : 0.5 * (s[n / 2 - 1] + s[n / 2]); };
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) * (y - m), 0) / (a.length - 1)); };
  function madMean(x, floor) {
    const med = median(x), mad = Math.max(median(x.map((v) => Math.abs(v - med))) * 1.4826, floor);
    const kept = x.filter((v) => Math.abs(v - med) <= 3 * mad);
    return kept.length ? mean(kept) : med;
  }
  function ticks(lo, hi, n) {
    const span = hi - lo, step0 = Math.pow(10, Math.floor(Math.log10(span / n))), err = span / n / step0;
    const step = step0 * (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1), out = [];
    for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(10));
    return out;
  }

  /* Generic plot. o: {x:[lo,hi], y:[lo,hi], xlab, ylab, logx, box:{x,y,w,h}, series:[{pts:[[x,y]], color, type, w, r, name}], xt, yt, xfmt, yfmt} */
  function plot(svg, o, keep) {
    if (!keep) svg.replaceChildren();
    const vb = svg.viewBox.baseVal, b = o.box || { x: 62, y: 14, w: vb.width - 82, h: vb.height - 62 };
    const tx = (v) => (o.logx ? Math.log10(v) : v);
    const X = (v) => b.x + ((tx(v) - tx(o.x[0])) / (tx(o.x[1]) - tx(o.x[0]))) * b.w;
    const Y = (v) => b.y + b.h - ((v - o.y[0]) / (o.y[1] - o.y[0])) * b.h;
    const g = el("g", {}, svg);
    const yt = o.yt || ticks(o.y[0], o.y[1], 5), xt = o.xt || ticks(o.x[0], o.x[1], 7);
    yt.forEach((v) => {
      el("line", { x1: b.x, x2: b.x + b.w, y1: Y(v), y2: Y(v), stroke: v === 0 && o.y[0] < 0 ? C.ink3 : C.grid, "stroke-width": 1 }, g);
      el("text", { x: b.x - 8, y: Y(v) + 4, "text-anchor": "end", "font-size": 12, fill: C.ink3 }, g, o.yfmt ? o.yfmt(v) : String(v));
    });
    xt.forEach((v) => el("text", { x: X(v), y: b.y + b.h + 18, "text-anchor": "middle", "font-size": 12, fill: C.ink3 }, g, o.xfmt ? o.xfmt(v) : String(v)));
    el("line", { x1: b.x, x2: b.x + b.w, y1: b.y + b.h, y2: b.y + b.h, stroke: C.ink3, "stroke-width": 1 }, g);
    if (o.xlab) el("text", { x: b.x + b.w / 2, y: b.y + b.h + 40, "text-anchor": "middle", "font-size": 13, fill: C.ink2 }, g, o.xlab);
    if (o.ylab) el("text", { x: b.x - 46, y: b.y + b.h / 2, "text-anchor": "middle", "font-size": 13, fill: C.ink2, transform: `rotate(-90 ${b.x - 46} ${b.y + b.h / 2})` }, g, o.ylab);
    const clipId = svg.id + "c" + (keep ? "2" : "1");
    const cp = el("clipPath", { id: clipId }, g); el("rect", { x: b.x, y: b.y - 4, width: b.w, height: b.h + 8 }, cp);
    const pg = el("g", { "clip-path": `url(#${clipId})` }, g);
    (o.series || []).forEach((s) => {
      if (s.type === "dots") s.pts.forEach((p) => el("circle", { cx: X(p[0]), cy: Y(p[1]), r: s.r || 3, fill: s.color, stroke: "#fff", "stroke-width": s.ring == null ? 1 : s.ring }, pg));
      else {
        let d = "";
        s.pts.forEach((p, i) => { d += (i ? (s.type === "step" ? "H" + X(p[0]).toFixed(1) + "V" + Y(p[1]).toFixed(1) : "L" + X(p[0]).toFixed(1) + " " + Y(p[1]).toFixed(1)) : "M" + X(p[0]).toFixed(1) + " " + Y(p[1]).toFixed(1)); });
        el("path", { d, fill: "none", stroke: s.color, "stroke-width": s.w || 2, "stroke-linejoin": "round", "stroke-linecap": "round", "stroke-dasharray": s.dash || "" }, pg);
      }
    });
    // hover: nearest point across series that carry a name
    const hs = (o.series || []).filter((s) => s.name);
    if (hs.length) {
      const dot = el("circle", { r: 5, fill: "none", stroke: C.ink, "stroke-width": 1.5, opacity: 0 }, g);
      const hit = el("rect", { x: b.x, y: b.y, width: b.w, height: b.h, fill: "transparent" }, g);
      hit.addEventListener("pointermove", (ev) => {
        const r = svg.getBoundingClientRect(), sx = ((ev.clientX - r.left) / r.width) * vb.width, sy = ((ev.clientY - r.top) / r.height) * vb.height;
        let best = null, bd = 1e9;
        hs.forEach((s) => s.pts.forEach((p) => { const dx = X(p[0]) - sx, dy = (Y(p[1]) - sy) * 0.5, dd = dx * dx + dy * dy; if (dd < bd) { bd = dd; best = [s, p]; } }));
        if (!best) return;
        dot.setAttribute("cx", X(best[1][0])); dot.setAttribute("cy", Y(best[1][1])); dot.setAttribute("opacity", 1);
        const wrap = svg.parentNode.getBoundingClientRect();
        tip.textContent = best[0].name + " · " + (o.tipx ? o.tipx(best[1][0]) : best[1][0]) + " → " + (o.tipy ? o.tipy(best[1][1]) : best[1][1]);
        tip.style.left = window.scrollX + r.left + (X(best[1][0]) / vb.width) * r.width + "px";
        tip.style.top = window.scrollY + r.top + (Y(best[1][1]) / vb.height) * r.height + "px";
        tip.style.opacity = 1; void wrap;
      });
      hit.addEventListener("pointerleave", () => { tip.style.opacity = 0; dot.setAttribute("opacity", 0); });
    }
    return { X, Y, g, b };
  }
  const readout = (id, items) => { $(id).innerHTML = items.map((i) => `<div><b>${i[0]}</b><span>${i[1]}</span></div>`).join(""); };

  /* ---------------------------------------------------------------- 01 beam */
  function beam() {
    const od = +$("b_od").value, i0 = Math.round(Math.pow(10, +$("b_i0").value)), T = Math.pow(10, -od / K);
    $("b_odv").textContent = od.toFixed(2); $("b_i0v").textContent = i0.toLocaleString();
    const I = i0 * T, svg = $("beam"); svg.replaceChildren();
    const y = 95;
    el("rect", { x: 40, y: y - 26, width: 70, height: 52, rx: 10, fill: C.s4 }, svg);
    el("text", { x: 75, y: y + 5, "text-anchor": "middle", "font-size": 14, "font-weight": 600, fill: "#fff" }, svg, "LED");
    el("rect", { x: 110, y: y - 9, width: 250, height: 18, fill: C.s4, opacity: 0.85 }, svg);
    el("rect", { x: 360, y: y - 62, width: 150, height: 124, rx: 12, fill: "#f5f5f7", stroke: "#d2d2d7" }, svg);
    el("rect", { x: 360, y: y - 9, width: 150, height: 18, fill: C.s4, opacity: 0.85 - 0.6 * (1 - T) }, svg);
    const r = rng(11), n = Math.round(Math.min(260, od * 90));
    for (let i = 0; i < n; i++) el("ellipse", { cx: 370 + r() * 130, cy: y - 52 + r() * 104, rx: 4.2, ry: 2, fill: C.ink3, opacity: 0.75, transform: `rotate(${r() * 180} ${0} ${0})` }, svg).setAttribute("transform", "");
    for (let i = 0; i < Math.min(14, Math.round((1 - T) * 16)); i++) { const a = (r() - 0.5) * 2.2, x0 = 380 + r() * 110; el("line", { x1: x0, y1: y, x2: x0 + 70 * Math.cos(a), y2: y + 70 * Math.sin(a), stroke: C.s4, "stroke-width": 1.5, opacity: 0.45 }, svg); }
    el("rect", { x: 510, y: y - 9, width: 250, height: 18, fill: C.s4, opacity: Math.max(0.04, 0.85 * T) }, svg);
    el("rect", { x: 760, y: y - 30, width: 90, height: 60, rx: 10, fill: C.ink }, svg);
    el("text", { x: 805, y: y + 5, "text-anchor": "middle", "font-size": 13, "font-weight": 600, fill: "#fff" }, svg, L("偵測器", "detector"));
    el("text", { x: 235, y: y - 22, "text-anchor": "middle", "font-size": 13, fill: C.ink2 }, svg, "I₀");
    el("text", { x: 635, y: y - 22, "text-anchor": "middle", "font-size": 13, fill: C.ink2 }, svg, "I = I₀ × T");
    el("text", { x: 435, y: y + 82, "text-anchor": "middle", "font-size": 13, fill: C.ink2 }, svg, L("flow cuvette（2 mm 光程）", "flow cuvette (2 mm path)"));
    const step = I >= 1 ? K * Math.log10((Math.floor(I) + 1) / Math.max(1, Math.floor(I))) : NaN;
    readout("b_read", [[(T * 100).toFixed(T < 0.1 ? 2 : 1) + "%", L("穿透率 T", "transmittance T")], [od.toFixed(2), L("回報的 OD（×5）", "reported OD (×5)")],
      [I < 10 ? I.toFixed(1) : Math.round(I).toLocaleString(), L("偵測器 counts", "detector counts")], [isNaN(step) ? L("讀不到", "unreadable") : step.toFixed(step < 0.01 ? 4 : 3), L("1 count 值多少 OD", "OD per count")]]);
  }

  /* ---------------------------------------------------------------- 02 chain */
  function chain() {
    const svg = $("chainfig"); svg.replaceChildren();
    const box = (x, y, w, h, t1, t2, fill, ink) => {
      el("rect", { x, y, width: w, height: h, rx: 12, fill: fill || "#f5f5f7", stroke: fill ? "none" : "#d2d2d7" }, svg);
      el("text", { x: x + w / 2, y: y + (t2 ? h / 2 - 3 : h / 2 + 5), "text-anchor": "middle", "font-size": 13.5, "font-weight": 600, fill: ink || C.ink }, svg, t1);
      if (t2) el("text", { x: x + w / 2, y: y + h / 2 + 15, "text-anchor": "middle", "font-size": 11.5, fill: ink || C.ink3 }, svg, t2);
    };
    const arrow = (x1, y1, x2, y2, c) => { el("line", { x1, y1, x2, y2, stroke: c || C.ink3, "stroke-width": 1.5 }, svg); const a = Math.atan2(y2 - y1, x2 - x1); el("path", { d: `M${x2} ${y2}L${x2 - 8 * Math.cos(a - 0.4)} ${y2 - 8 * Math.sin(a - 0.4)}L${x2 - 8 * Math.cos(a + 0.4)} ${y2 - 8 * Math.sin(a + 0.4)}Z`, fill: c || C.ink3 }, svg); };
    el("text", { x: 20, y: 22, "font-size": 12.5, "font-weight": 600, fill: C.ink3 }, svg, L("光學", "OPTICS"));
    box(20, 36, 92, 54, "LED", L("琥珀色，脈衝", "amber, pulsed"), C.s4, "#fff");
    box(140, 36, 92, 54, L("透鏡", "Lens"), L("+ 2 mm 針孔", "+ 2 mm pinhole"));
    box(260, 36, 100, 54, L("分光片", "Splitter"), "90 / 10");
    box(400, 36, 120, 54, "Flow cuvette", L("2 mm 光程", "2 mm path"));
    box(560, 36, 130, 54, L("Sample 感測器", "Sample sensor"), "16-bit", C.s1, "#fff");
    box(245, 128, 130, 54, L("Reference 感測器", "Reference sensor"), "16-bit", C.s2, "#fff");
    arrow(112, 63, 138, 63, C.s4); arrow(232, 63, 258, 63, C.s4); arrow(360, 63, 398, 63, C.s4); arrow(520, 63, 558, 63, C.s4); arrow(310, 90, 310, 126, C.s4);
    el("text", { x: 379, y: 55, "text-anchor": "middle", "font-size": 11, fill: C.ink3 }, svg, "90%");
    el("text", { x: 326, y: 112, "font-size": 11, fill: C.ink3 }, svg, "10%");
    el("text", { x: 20, y: 222, "font-size": 12.5, "font-weight": 600, fill: C.ink3 }, svg, L("運算", "ARITHMETIC"));
    const steps = [[L("暗場", "Dark"), L("4 樣本中位數", "median of 4")], [L("亮場 burst", "Lit burst"), L("16 樣本，丟 2", "16, drop 2")], [L("MAD 門檻", "MAD gate"), L("3×MAD 後平均", "mean in 3×MAD")],
      [L("扣暗場", "− dark"), "net = lit − dark"], [L("比值", "Ratio"), "S / R"], [L("空白", "Blank"), L("只設一次", "set once")], ["log₁₀", L("只取一次", "taken once")], ["× 5", L("光程係數", "path factor")]];
    const w = 104, gap = 10, x0 = 20;
    steps.forEach((s, i) => { box(x0 + i * (w + gap), 236, w, 56, s[0], s[1]); if (i) arrow(x0 + i * (w + gap) - gap, 264, x0 + i * (w + gap) - 1, 264); });
    el("path", { d: "M625 90 V206 H72", fill: "none", stroke: C.s1, "stroke-width": 1.5 }, svg);
    el("path", { d: "M310 182 V200 H150", fill: "none", stroke: C.s2, "stroke-width": 1.5 }, svg);
    arrow(72, 206, 72, 234, C.s1); arrow(150, 200, 150, 234, C.s2);
    el("text", { x: 470, y: 200, "font-size": 11.5, fill: C.ink3 }, svg, L("原始 counts", "raw counts"));
    el("text", { x: 918, y: 316, "text-anchor": "end", "font-size": 13, "font-weight": 600, fill: C.ink }, svg, "→ OD600");
  }

  /* ---------------------------------------------------------------- 3.1 counts */
  function qfig() {
    const n = Math.round(Math.pow(10, +$("q_n").value)); $("q_nv").textContent = n.toLocaleString();
    const step = (N) => K * Math.log10((N + 1) / N), pts = [];
    for (let e = 1; e <= 3.7; e += 0.02) { const N = Math.pow(10, e); pts.push([N, step(N)]); }
    const p = plot($("qfig"), { x: [10, 5000], y: [0, 0.2], logx: true, xt: [10, 30, 100, 300, 1000, 3000], xlab: L("通道上的 counts", "counts on the channel"), ylab: L("每 count 的 OD", "OD per count"),
      series: [{ pts, color: C.s1, name: L("1 count", "1 count") }], tipx: (v) => Math.round(v) + " counts", tipy: (v) => v.toFixed(4) + " OD" });
    [[32, L("7/21 運轉", "21 Jul run"), C.s2, -8], [265, L("9/02", "2 Sep"), C.s3, -22], [304, L("10/09", "9 Oct"), C.s4, -8]].forEach((m) => {
      el("circle", { cx: p.X(m[0]), cy: p.Y(step(m[0])), r: 6, fill: m[2], stroke: "#fff", "stroke-width": 2 }, p.g);
      el("text", { x: p.X(m[0]) + 10, y: p.Y(step(m[0])) + m[3], "font-size": 12.5, fill: C.ink2 }, p.g, m[1] + " · " + step(m[0]).toFixed(3));
    });
    el("line", { x1: p.X(n), x2: p.X(n), y1: p.b.y, y2: p.b.y + p.b.h, stroke: C.ink, "stroke-width": 1, "stroke-dasharray": "3 3" }, p.g);
    readout("q_read", [[step(n).toFixed(step(n) < 0.01 ? 4 : 3), L("1 count 的 OD（×5）", "OD per count (×5)")], [(K * 0.4343 * 0.2887 / n).toFixed(4), L("量化雜訊 σ（OD）", "quantisation σ (OD)")], [(100 / n).toFixed(n > 500 ? 2 : 1) + "%", L("1 count 佔訊號比例", "one count as share of signal")]]);
  }

  /* ---------------------------------------------------------------- 3.2 Jensen */
  function jfig() {
    const s = +$("j_s").value / 100; $("j_sv").textContent = (s * 100).toFixed(0) + "%";
    const an = (x) => K * 0.2171 * x * x, pts = []; for (let x = 0; x <= 0.5001; x += 0.01) pts.push([x * 100, an(x)]);
    const r = rng(5), sims = [];
    for (let x = 0.05; x <= 0.5001; x += 0.05) { let a = 0, b = 0, n = 40000; for (let i = 0; i < n; i++) { const I = Math.max(0.05, 1 + x * gauss(r)); a += -Math.log10(I); b += I; } sims.push([x * 100, K * (a / n + Math.log10(b / n))]); }
    const p = plot($("jfig"), { x: [0, 50], y: [0, 0.35], xlab: L("相對雜訊 σr（%）", "relative noise σr (%)"), ylab: L("多報的 OD", "OD over-read"), xfmt: (v) => v + "%",
      series: [{ pts, color: C.s1, name: L("公式", "formula") }, { pts: sims, color: C.s2, type: "dots", r: 4, name: L("模擬", "simulated") }], tipx: (v) => v.toFixed(0) + "%", tipy: (v) => "+" + v.toFixed(4) + " OD" });
    el("circle", { cx: p.X(s * 100), cy: p.Y(an(s)), r: 7, fill: "none", stroke: C.ink, "stroke-width": 2 }, p.g);
    el("text", { x: p.b.x + 12, y: p.b.y + 16, "font-size": 12.5, fill: C.ink2 }, p.g, L("線：公式　點：模擬（高雜訊時公式略低估）", "line: formula · dots: simulation (the formula runs slightly low at high noise)"));
    readout("j_read", [["+" + an(s).toFixed(4), L("「先 log 再平均」多報的 OD（×5）", "OD over-read by log-then-average (×5)")], ["+" + (an(s) / K).toFixed(4), L("未乘光程係數", "before the path factor")]]);
  }

  /* ---------------------------------------------------------------- 3.3 bubbles */
  function ofig() {
    const f = +$("o_f").value / 100, k = +$("o_k").value / 100; $("o_fv").textContent = (f * 100).toFixed(0) + "%"; $("o_kv").textContent = (k * 100).toFixed(0) + "%";
    const r = rng(21), N = 2000, n = 14, base = 2400, res = { mean: [], trim: [], med: [], up: [] };
    for (let b = 0; b < N; b++) {
      const x = []; for (let i = 0; i < n; i++) x.push(Math.round(base * (1 + 0.004 * gauss(r)) * (r() < f ? k : 1)));
      const s = x.slice().sort((a, c) => a - c);
      res.mean.push(mean(x)); res.trim.push(mean(s.slice(3, 11))); res.med.push(median(x)); res.up.push(mean(s.slice(8, 13)));
    }
    const rows = [[L("單純平均", "plain mean"), res.mean, C.s2], [L("截尾平均 20%", "trimmed mean 20%"), res.trim, C.s4], [L("中位數", "median"), res.med, C.s1], [L("上側分位帶 60–90%", "upper band 60–90%"), res.up, C.s3]]
      .map((q) => { const od = q[1].map((v) => K * Math.log10(base / v)); return [q[0], mean(od), sd(od), q[2]]; });
    const svg = $("ofig"); svg.replaceChildren();
    const x0 = 210, w = 620, max = Math.max(0.3, ...rows.map((q) => q[1] + q[2])) * 1.08, lo = -0.06, X = (v) => x0 + ((v - lo) / (max - lo)) * w;
    ticks(lo, max, 6).forEach((v) => { el("line", { x1: X(v), x2: X(v), y1: 14, y2: 206, stroke: v === 0 ? C.ink3 : C.grid }, svg); el("text", { x: X(v), y: 224, "text-anchor": "middle", "font-size": 12, fill: C.ink3 }, svg, v === 0 ? "0" : fmt(v, 2)); });
    el("text", { x: x0 + w / 2, y: 244, "text-anchor": "middle", "font-size": 13, fill: C.ink2 }, svg, L("偏差（OD，已乘 5）", "bias (OD, ×5 applied)"));
    rows.forEach((q, i) => {
      const y = 28 + i * 46;
      el("text", { x: x0 - 12, y: y + 5, "text-anchor": "end", "font-size": 13.5, fill: C.ink }, svg, q[0]);
      const a = X(Math.min(0, q[1])), bw = Math.max(2, Math.abs(X(q[1]) - X(0)));
      el("rect", { x: a, y: y - 11, width: bw, height: 22, rx: 4, fill: q[3] }, svg);
      el("line", { x1: X(q[1] - q[2]), x2: X(q[1] + q[2]), y1: y, y2: y, stroke: C.ink, "stroke-width": 1.5 }, svg);
      el("text", { x: X(q[1] + q[2]) + 8, y: y + 5, "font-size": 12.5, fill: C.ink2 }, svg, (q[1] >= 0 ? "+" : "") + fmt(q[1], 3) + "  ± " + q[2].toFixed(3));
    });
    const th = -K * Math.log10(1 - f * (1 - k));
    el("line", { x1: X(th), x2: X(th), y1: 10, y2: 44, stroke: C.ink, "stroke-dasharray": "3 3" }, svg);
    el("text", { x: X(th) + 6, y: 12, "font-size": 11.5, fill: C.ink3 }, svg, L("公式預測 ", "formula ") + "+" + th.toFixed(3));
  }

  /* ---------------------------------------------------------------- 3.4 MAD staircase */
  function mfig() {
    const s = +$("m_s").value; $("m_sv").textContent = s.toFixed(2);
    const r = rng(8), a = [], b = [], id = [];
    for (let lv = 32; lv <= 33.0001; lv += 0.025) {
      let m1 = 0, m2 = 0; const N = 500;
      for (let j = 0; j < N; j++) { const x = []; for (let i = 0; i < 14; i++) x.push(Math.round(lv + s * gauss(r))); m1 += mean(x); m2 += madMean(x, 1e-6); }
      a.push([lv, m1 / N]); b.push([lv, m2 / N]); id.push([lv, lv]);
    }
    plot($("mfig"), { x: [32, 33], y: [31.9, 33.1], xt: [32, 32.25, 32.5, 32.75, 33], yt: [32, 32.25, 32.5, 32.75, 33], xlab: L("真實光強（counts）", "true level (counts)"), ylab: L("估計器回報（counts）", "estimator output (counts)"),
      series: [{ pts: id, color: C.ink3, w: 1.5, dash: "4 4" }, { pts: a, color: C.s1, name: L("單純平均", "plain mean") }, { pts: b, color: C.s2, name: L("目前韌體", "current firmware") }], tipx: (v) => v.toFixed(2), tipy: (v) => v.toFixed(3) });
  }

  /* ---------------------------------------------------------------- 3.5 stray */
  function sfig() {
    const f = (od, s) => -K * Math.log10(Math.pow(10, -od / K) + s) + K * Math.log10(1 + s);
    const mk = (s) => { const p = []; for (let x = 0; x <= 12.001; x += 0.1) p.push([x, f(x, s)]); return p; };
    plot($("sfig"), { x: [0, 12], y: [0, 12], xlab: L("真實 OD（×5 刻度）", "true OD (×5 scale)"), ylab: L("看起來的 OD", "apparent OD"),
      series: [{ pts: [[0, 0], [12, 12]], color: C.ink3, w: 1.5, dash: "4 4" }, { pts: mk(0.001), color: C.s1, name: "s = 0.1%" }, { pts: mk(0.01), color: C.s2, name: "s = 1%" }, { pts: mk(0.05), color: C.s3, name: "s = 5%" }], tipx: (v) => v.toFixed(1), tipy: (v) => v.toFixed(2) });
  }

  /* ---------------------------------------------------------------- 3.6 EWMA */
  function efig() {
    const tau = +$("e_t").value, mu = 0.25; $("e_tv").textContent = tau.toFixed(1) + " h";
    const tr = [], sm = []; let y = 0.05; const dt = 0.02; let seen = null;
    for (let t = 0; t <= 20.001; t += dt) {
      const v = 0.05 * Math.exp(mu * Math.min(t, 10)); y = tau > 0 ? y + (dt / tau) * (v - y) : v;
      if (Math.round(t / dt) % 5 === 0) { tr.push([t, v]); sm.push([t, y]); }
      if (seen === null && t > 10 && y >= 0.05 * Math.exp(2.5) * 0.95) seen = t;
    }
    const p = plot($("efig"), { x: [0, 20], y: [0, 0.7], xlab: L("時間（h）", "time (h)"), ylab: "OD", series: [{ pts: tr, color: C.ink3, name: L("真實", "true") }, { pts: sm, color: C.s2, name: L("平滑後", "smoothed") }], tipx: (v) => v.toFixed(1) + " h", tipy: (v) => v.toFixed(3) });
    el("line", { x1: p.X(10), x2: p.X(10), y1: p.b.y, y2: p.b.y + p.b.h, stroke: C.ink, "stroke-dasharray": "3 3" }, p.g);
    readout("e_read", [[(100 * mu * tau / (1 + mu * tau)).toFixed(0) + "%", L("指數期被低估的比例（μ = 0.25 h⁻¹）", "under-read during growth (μ = 0.25 h⁻¹)")], [seen === null ? "> 10 h" : (seen - 10).toFixed(1) + " h", L("到達平台 95% 的延遲", "delay to reach 95% of plateau")]]);
  }

  /* ---------------------------------------------------------------- 04 real data */
  function hfig() {
    const h = D.hist.filter((q) => q[0] >= 20), svg = $("hfig"); svg.replaceChildren();
    const b = { x: 62, y: 14, w: 818, h: 188 }, max = 1300, X = (v) => b.x + ((v - 19.5) / 14.5) * b.w, Y = (v) => b.y + b.h - (v / max) * b.h;
    [0, 400, 800, 1200].forEach((v) => { el("line", { x1: b.x, x2: b.x + b.w, y1: Y(v), y2: Y(v), stroke: C.grid }, svg); el("text", { x: b.x - 8, y: Y(v) + 4, "text-anchor": "end", "font-size": 12, fill: C.ink3 }, svg, v); });
    h.forEach((q) => {
      const isInt = q[0] % 1 === 0, r = el("rect", { x: X(q[0]) - 9, y: Y(q[1]), width: 18, height: Math.max(1, b.y + b.h - Y(q[1])), rx: 3, fill: isInt ? C.s1 : C.s2 }, svg);
      r.addEventListener("pointermove", () => { const bb = r.getBoundingClientRect(); tip.textContent = q[0] + " counts · " + q[1] + L(" 筆", " readings"); tip.style.left = window.scrollX + bb.left + bb.width / 2 + "px"; tip.style.top = window.scrollY + bb.top + "px"; tip.style.opacity = 1; });
      r.addEventListener("pointerleave", () => (tip.style.opacity = 0));
      if (q[1] > 150) el("text", { x: X(q[0]), y: Y(q[1]) - 5, "text-anchor": "middle", "font-size": 11.5, fill: C.ink2 }, svg, q[1]);
    });
    for (let v = 20; v <= 33; v++) el("text", { x: X(v), y: b.y + b.h + 18, "text-anchor": "middle", "font-size": 12, fill: C.ink3 }, svg, v);
    el("line", { x1: b.x, x2: b.x + b.w, y1: b.y + b.h, y2: b.y + b.h, stroke: C.ink3 }, svg);
    el("text", { x: b.x + b.w / 2, y: b.y + b.h + 40, "text-anchor": "middle", "font-size": 13, fill: C.ink2 }, svg, L("reference counts（藍：整數；橘：半整數）", "reference counts (blue: integer; orange: half-integer)"));
    el("text", { x: b.x - 46, y: b.y + b.h / 2, "text-anchor": "middle", "font-size": 13, fill: C.ink2, transform: `rotate(-90 ${b.x - 46} ${b.y + b.h / 2})` }, svg, L("讀值筆數", "readings"));
  }
  function zfig() {
    const z = D.zoom, svg = $("zfig"); svg.replaceChildren();
    const od = z.t.map((t, i) => [t, z.od[i]]), rc = z.t.map((t, i) => [t, z.rc[i]]);
    const x0 = z.a, x1 = z.a + 24, xt = []; for (let v = Math.ceil(x0 / 4) * 4; v <= x1; v += 4) xt.push(v);
    const lo = Math.floor(Math.min(...z.od) * 20) / 20, hi = Math.ceil(Math.max(...z.od) * 20) / 20;
    const p1 = plot(svg, { box: { x: 62, y: 14, w: 818, h: 190 }, x: [x0, x1], y: [lo, hi], xt: [], ylab: "OD600", yfmt: (v) => v.toFixed(2), series: [{ pts: od, color: C.s1, w: 1.5, name: "OD600" }], tipx: (v) => v.toFixed(1) + " h", tipy: (v) => v.toFixed(3) }, false);
    plot(svg, { box: { x: 62, y: 232, w: 818, h: 90 }, x: [x0, x1], y: [31.5, 33.5], yt: [32, 33], xt, xlab: L("經過時間（h）", "elapsed time (h)"), ylab: "counts", series: [{ pts: rc, color: C.s2, type: "step", w: 2, name: "reference" }], tipx: (v) => v.toFixed(1) + " h", tipy: (v) => v + " counts" }, true);
    z.t.forEach((t, i) => { if (i && Math.round(z.rc[i]) !== Math.round(z.rc[i - 1])) el("line", { x1: p1.X(t), x2: p1.X(t), y1: 14, y2: 322, stroke: C.s2, "stroke-width": 1, "stroke-dasharray": "2 3", opacity: 0.7 }, p1.g); });
  }
  function sio2fig() {
    const c = D.sio2.c, od = D.sio2.od, svg = $("sio2fig"); svg.replaceChildren();
    let sxx = 0, sx = 0, sy = 0, sxy = 0, n = 0; c.forEach((x, i) => { if (x <= 0.7) { n++; sx += x; sy += od[i]; sxx += x * x; sxy += x * od[i]; } });
    const m = (n * sxy - sx * sy) / (n * sxx - sx * sx), q = (sy - m * sx) / n;
    plot(svg, { box: { x: 62, y: 14, w: 370, h: 228 }, x: [0, 1.4], y: [-0.05, 0.55], xlab: "SiO₂ (mg/mL)", ylab: L("讀值（未乘 5）", "reading (no ×5)"),
      series: [{ pts: [[0, q], [1.4, q + 1.4 * m]], color: C.ink3, w: 1.5, dash: "4 4" }, { pts: c.map((x, i) => [x, od[i]]), color: C.s1, type: "dots", r: 3.2, name: L("讀值", "reading") }], tipx: (v) => v.toFixed(3) + " mg/mL", tipy: (v) => v.toFixed(4) }, false);
    plot(svg, { box: { x: 520, y: 14, w: 360, h: 228 }, x: [0, 1.4], y: [-0.01, 0.04], xlab: "SiO₂ (mg/mL)", ylab: L("殘差", "residual"), yfmt: (v) => fmt(v, 2),
      series: [{ pts: c.map((x, i) => [x, od[i] - (q + m * x)]), color: C.s2, type: "dots", r: 3.2, name: L("殘差", "residual") }], tipx: (v) => v.toFixed(3) + " mg/mL", tipy: (v) => (v >= 0 ? "+" : "") + fmt(v, 4) }, true);
    el("text", { x: 76, y: 30, "font-size": 12, fill: C.ink3 }, svg, L(`虛線：≤ 0.7 mg/mL 的直線，斜率 ${m.toFixed(3)}`, `dashed: line through ≤ 0.7 mg/mL, slope ${m.toFixed(3)}`));
  }

  /* ---------------------------------------------------------------- 05 settling */
  function settle() {
    const d = +$("st_d").value; $("st_dv").textContent = d.toFixed(2) + " µm";
    const v = (1300 * 9.81 * Math.pow(d * 1e-6, 2)) / (18 * 0.00089) * 3.6e6; // mm/h
    readout("st_read", [[v < 0.1 ? v.toFixed(3) : v.toFixed(2) + "", "mm / h"], [(v / 60).toFixed(3), L("1 分鐘沉多少 mm", "mm in one minute")], [v > 0 ? (10 / v < 100 ? (10 / v).toFixed(1) : Math.round(10 / v)) + " h" : "—", L("沉 10 mm 需要", "time to sink 10 mm")]]);
  }

  /* ---------------------------------------------------------------- 06 ladder table */
  function ladder() {
    const targets = [0.02, 0.04, 0.08, 0.12, 0.2, 0.3, 0.4, 0.55, 0.7, 0.9, 1.05, 1.2], stock = 25, take = 0.5;
    let V = 50, Cc = 0, mg = 0, html = `<tr><th>${L("階", "Level")}</th><th class="num">${L("目標濃度 (mg/mL)", "Target (mg/mL)")}</th><th class="num">${L("本次加入原液 (µL)", "Stock to add (µL)")}</th><th class="num">${L("累計微球 (mg)", "Beads used (mg)")}</th><th class="num">${L("顆粒數 (/mL)", "Particles (/mL)")}</th><th class="num">${L("預期 OD，1 cm", "Expected OD, 1 cm")}</th><th class="num">${L("預期讀值 ×5", "Expected reading ×5")}</th></tr>`;
    html += `<tr><td>L00</td><td class="num">0</td><td class="num">—</td><td class="num">0</td><td class="num">0</td><td class="num">0</td><td class="num">0</td></tr>`;
    targets.forEach((t, i) => {
      const add = (V * (t - Cc)) / (stock - t); mg += add * stock; V = V + add - take; Cc = t;
      html += `<tr><td>L${String(i + 1).padStart(2, "0")}</td><td class="num">${t.toFixed(2)}</td><td class="num">${Math.round(add * 1000)}</td><td class="num">${mg.toFixed(1)}</td><td class="num">${(t * 8.3).toFixed(2)} × 10⁸</td><td class="num">${(t * 2.3).toFixed(2)}</td><td class="num">${(t * 0.396 * 5).toFixed(2)}</td></tr>`;
    });
    $("ladder").innerHTML = html;
  }

  function drawAll() { beam(); chain(); qfig(); jfig(); ofig(); mfig(); sfig(); efig(); hfig(); zfig(); sio2fig(); settle(); ladder(); }
  [["b_od", beam], ["b_i0", beam], ["q_n", qfig], ["j_s", jfig], ["o_f", ofig], ["o_k", ofig], ["m_s", mfig], ["e_t", efig], ["st_d", settle]].forEach((p) => $(p[0]).addEventListener("input", p[1]));

  function setLang(l) {
    document.documentElement.dataset.lang = l; document.documentElement.lang = l === "zh" ? "zh-Hant" : "en";
    $("bzh").setAttribute("aria-pressed", l === "zh"); $("ben").setAttribute("aria-pressed", l === "en");
    try { localStorage.setItem("od600lang", l); } catch (e) { /* storage may be blocked */ }
    drawAll();
  }
  $("bzh").addEventListener("click", () => setLang("zh")); $("ben").addEventListener("click", () => setLang("en"));
  let saved = null; try { saved = localStorage.getItem("od600lang"); } catch (e) { /* ignore */ }
  setLang(saved === "en" ? "en" : "zh");
})();

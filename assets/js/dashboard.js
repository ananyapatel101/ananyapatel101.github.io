// Homepage dashboard: XYZ Pvt Ltd (company code IN10) at a glance.
// Every figure comes from the project data files (projects/*/data/*.csv) and ties to Part 5's trial balance at 30.09.2026.
(function () {
  "use strict";

  // ---------- data ----------
  var DATA = {
    profit: [
      { label: "Sales", value: 32400000, kind: "up", tech: "411000 Sales - Domestic (PL.REV)" },
      { label: "Other income (rent, interest)", value: 1012500, kind: "up", tech: "421000 FD interest 1,12,500 + 422000 rent 9,00,000 (PL.OI)" },
      { label: "Raw materials", value: -19440000, kind: "down", tech: "511000 Raw Material Consumed (PL.EXP.COMC)" },
      { label: "Salaries & staff benefits", value: -4560000, kind: "down", tech: "611000 + 612000 (PL.EXP.EMP)" },
      { label: "Running costs", value: -2230000, kind: "down", tech: "621000–662000: power, insurance, software, audit, repairs, freight (PL.EXP.OTH)" },
      { label: "Machine wear (depreciation)", value: -990000, kind: "down", tech: "641000 Depreciation (PL.EXP.DEP), from the asset register" },
      { label: "Loan interest", value: -375000, kind: "down", tech: "651000 Interest on Term Loan (PL.EXP.FIN)" },
      { label: "Income tax", value: -900000, kind: "down", tech: "671000 Current Tax Expense (PL.TAX)" },
      { label: "Profit", value: 4917500, kind: "total", tech: "XI. Profit for the period (PAT)" }
    ],
    owns: [
      { label: "Machines & equipment", short: "Machines", value: 15140000, tech: "111000–112900 net of accumulated depreciation (BS.A.NCA.PPE)" },
      { label: "Customer dues", value: 6480000, tech: "141000 Trade Receivables (BS.A.CA.TR)" },
      { label: "Stock", value: 6090000, tech: "131000 raw material + 132000 finished goods (BS.A.CA.INV)" },
      { label: "Cash & bank", value: 4875000, tech: "171000 HDFC current a/c + 172000 SBI FD (BS.A.CA.CCE)" },
      { label: "Other", value: 1308750, tech: "Prepaids, accrued interest, advances, input GST (BS.A.CA.OCA / STLA)" }
    ],
    funded: [
      { label: "Owner's money", value: 19056250, tech: "311000 share capital 1,00,00,000 + 321000 reserves 41,38,750 + period profit 49,17,500" },
      { label: "Bank loan", value: 7500000, tech: "251000 Term Loan - SBI (BS.EL.NCL.LTB)" },
      { label: "Supplier bills", value: 4860000, tech: "211000 Trade Payables (BS.EL.CL.TP)" },
      { label: "Other dues", value: 2477500, tech: "GR/IR, accruals, advance rent, GST, TDS, tax provision (BS.EL.CL.OCL / STP)" }
    ],
    close: [
      { label: "Electricity used in Sep, bill not in yet", value: -120000, tech: "A1 · FBS1 Dr 621000 / Cr 219500 · doc 0100000451" },
      { label: "September's share of the audit fee", value: -50000, tech: "A2 · FBS1 Dr 631000 / Cr 219500 · doc 0100000452" },
      { label: "Loan interest for September", value: -62500, tech: "A3 · FBS1 Dr 651000 / Cr 219500 · doc 0100000453" },
      { label: "Bank interest earned, not paid out yet", value: 18750, tech: "A4 · FBS1 Dr 152000 / Cr 421000 · accrued income" },
      { label: "October rent received early", value: -150000, tech: "D1 · FBS1 Dr 422000 / Cr 219600 · income deferred" },
      { label: "October software paid early", value: 90000, tech: "D2 · FBS1 Dr 151000 / Cr 624000 · prepaid expense" }
    ],
    buying: {
      start: "2026-09-01", end: "2026-10-26",
      series: [
        { key: "grir", label: "Goods arrived, bill not in yet", color: "var(--c1)",
          steps: [["2026-09-01", 0], ["2026-09-10", 348000], ["2026-09-18", 580000], ["2026-09-20", 0]] },
        { key: "vendor", label: "Bill we owe the supplier", color: "var(--c2)",
          steps: [["2026-09-01", 0], ["2026-09-20", 684400], ["2026-10-20", 0]] }
      ],
      events: [
        { date: "2026-09-03", label: "Order placed", tech: "ME21N PO 4500000118, 10 MT × ₹58,000" },
        { date: "2026-09-10", label: "Delivery 1 (6 t)", tech: "MIGO 101 → FI 5000000187: Dr 131000 / Cr 219100 ₹3,48,000" },
        { date: "2026-09-18", label: "Delivery 2 (4 t)", tech: "MIGO 101 → FI 5000000188: Dr 131000 / Cr 219100 ₹2,32,000" },
        { date: "2026-09-20", label: "Bill checked", tech: "MIRO 5100000093: Dr 219100 ₹5,80,000 + 161000 GST ₹1,04,400 / Cr vendor ₹6,84,400" },
        { date: "2026-10-20", label: "Paid", tech: "F110 run AP01 → 1500000123: Dr vendor / Cr 171100 ₹6,84,400" }
      ]
    },
    aging: {
      keys: [
        { key: "nd", label: "Not due yet", color: "var(--st-good)", icon: "✓" },
        { key: "a", label: "1–30 days late", color: "var(--st-warn)", icon: "!" },
        { key: "b", label: "31–60 days late", color: "var(--st-serious)", icon: "!!" },
        { key: "c", label: "61–90 days late", color: "var(--st-critical)", icon: "!!!" }
      ],
      rows: [
        { label: "Kalinga Auto Components", nd: 2832000, tech: "200001 · RV 1800000189 ₹16,52,000 + 1800000198 ₹11,80,000" },
        { label: "Pune Precision Tools", b: 1416000, tech: "200002 · RV 1800000176, 34 days overdue" },
        { label: "Nashik Pumps & Valves", b: 590000, c: 698000, tech: "200004 · RV 1800000160 (59 days) + DZ residual 1400000059 (80 days)" },
        { label: "Deccan Tractors", a: 944000, tech: "200003 · RV 1800000184, 16 days overdue" }
      ]
    },
    invoice: [
      { label: "Price: 1,000 units × ₹2,000", value: 2000000, kind: "up", tech: "PR00 2,000 INR/EA → VKOA ERL 411000" },
      { label: "Regular-customer discount (3%)", value: -60000, kind: "down", tech: "K007 −3% → VKOA ERS 412000 Sales Deductions" },
      { label: "GST added (18%)", value: 349200, kind: "up", tech: "JOIG IGST 18% → 221000 Output GST (passed on to the government)" },
      { label: "Invoice total", value: 2289200, kind: "total", tech: "VF01 → RV 1800000205, customer 200001" },
      { label: "Paid early: 2% off", value: -38800, kind: "down", tech: "Terms IN02 2% within 10 days → SKTO cash discount 663000" },
      { label: "Tax the customer kept back (TDS)", value: -1940, kind: "down", tech: "194Q 0.1% of ₹19,40,000 → 162000 TDS Receivable" },
      { label: "Cash in the bank", value: 2248460, kind: "total", tech: "F-28 → DZ 1400000088 on 14.10.2026, into 171200" }
    ],
    machines: {
      keys: [
        { key: "left", label: "Value left", color: "var(--c1)" },
        { key: "used", label: "Used up so far", color: "var(--c2)" }
      ],
      rows: [
        { label: "Machining cell MC-2", left: 8000000, used: 1600000, tech: "1100006 · APC ₹96,00,000 · 10 years · ₹80,000 a month" },
        { label: "CNC turning centre TC-2", left: 2160000, used: 720000, tech: "1100005 · APC ₹28,80,000 · 10 years" },
        { label: "Induction hardening machine", left: 1482000, used: 798000, tech: "1100004 · APC ₹22,80,000 · 10 years" },
        { label: "CNC turning centre TC-1", left: 690000, used: 510000, tech: "1100003 · APC ₹12,00,000 · 10 years" },
        { label: "Office equipment (AC, CCTV, copiers)", left: 840000, used: 360000, tech: "1200001–1200003 · class 1200 · 5 years" },
        { label: "Hydraulic press 150 T", left: 1170000, used: 30000, tech: "1100007 · bought Jul 2026" },
        { label: "Manual lathe LT-2 (sold in Oct)", left: 456000, used: 264000, tech: "1100002 · 15 years · sold 26.10 for ₹5,00,000 (F-92), profit ₹44,000" },
        { label: "Air compressor", left: 342000, used: 198000, tech: "1100001 · 15 years" },
        { label: "Gauges (small tools)", left: 0, used: 80000, tech: "1500001 · low-value assets, written off in year 1 (ZLVA)" }
      ]
    },
    limits: {
      keys: [{ key: "v", label: "Largest entry allowed", color: "var(--c1)" }],
      rows: [
        { label: "Temporary user", v: 100000, tech: "Tolerance group (blank) · TEMP01 · ₹50,000 per open item" },
        { label: "Accounts clerk", v: 500000, tech: "FI_CLERK · CLERK01 · ₹2,00,000 per open item" },
        { label: "Finance manager", v: 5000000, tech: "FI_MGR · MGR01 · ₹25,00,000 per open item" }
      ]
    }
  };
  window.DASH_DATA = DATA;

  // ---------- helpers ----------
  var NS = "http://www.w3.org/2000/svg";
  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function h(tag, cls, text, parent) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }
  function txt(parent, x, y, s, attrs) {
    var t = el("text", Object.assign({ x: x, y: y }, attrs || {}), parent);
    t.textContent = s;
    return t;
  }
  var inr = function (v) { return "₹" + Math.round(Math.abs(v)).toLocaleString("en-IN"); };
  function short(v) {
    var a = Math.abs(v);
    if (a >= 1e7) return "₹" + (a / 1e7).toFixed(2) + " Cr";
    if (a >= 1e5) return "₹" + (a / 1e5).toFixed(2) + " L";
    return inr(a);
  }
  function tick(v) {
    if (!v) return "0";
    return v >= 1e7 ? "₹" + +(v / 1e7).toFixed(2) + " Cr" : v >= 1e5 ? "₹" + +(v / 1e5).toFixed(2) + " L" : inr(v);
  }
  function signed(v) { return (v < 0 ? "−" : "+") + short(v); }
  function niceMax(v) {
    var p = Math.pow(10, Math.floor(Math.log10(v))), m = v / p;
    return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
  }
  // Bar with 4px rounded data-end, square at the baseline. dir: "right" | "left" | "both" | "none"
  function barPath(x, y, w, hgt, dir) {
    var r = Math.min(4, w / 2, hgt / 2);
    if (w <= 0) return "";
    var rl = dir === "left" || dir === "both" ? r : 0, rr = dir === "right" || dir === "both" ? r : 0;
    return "M" + (x + rl) + "," + y + "H" + (x + w - rr) +
      (rr ? "Q" + (x + w) + "," + y + " " + (x + w) + "," + (y + rr) : "") +
      "V" + (y + hgt - rr) +
      (rr ? "Q" + (x + w) + "," + (y + hgt) + " " + (x + w - rr) + "," + (y + hgt) : "") +
      "H" + (x + rl) +
      (rl ? "Q" + x + "," + (y + hgt) + " " + x + "," + (y + hgt - rl) : "") +
      "V" + (y + rl) +
      (rl ? "Q" + x + "," + y + " " + (x + rl) + "," + y : "") + "Z";
  }

  // ---------- tooltip ----------
  var tip;
  function ensureTip() {
    if (tip) return tip;
    tip = h("div", "viz-tip", null, document.body);
    tip.setAttribute("role", "status");
    return tip;
  }
  function showTip(rows, x, y) {
    var t = ensureTip();
    t.textContent = "";
    rows.forEach(function (r, i) {
      var line = h("div", i === 0 && r.head ? "tt-head" : "tt-row", null, t);
      if (r.color) { var k = h("span", "tt-key", null, line); k.style.background = r.color; }
      if (r.value !== undefined) h("b", null, r.value, line);
      if (r.label) h("span", null, r.label, line);
    });
    t.style.display = "block";
    var tw = t.offsetWidth, th = t.offsetHeight, vw = document.documentElement.clientWidth;
    var left = Math.min(Math.max(8, x + 14), vw - tw - 8);
    var top = y - th - 12 < window.scrollY + 8 ? y + 16 : y - th - 12;
    t.style.left = left + "px";
    t.style.top = top + "px";
  }
  function hideTip() { if (tip) tip.style.display = "none"; }
  function bindTip(node, rowsFn) {
    node.setAttribute("tabindex", "0");
    node.classList.add("hit");
    node.addEventListener("pointermove", function (e) { showTip(rowsFn(), e.pageX, e.pageY); });
    node.addEventListener("pointerleave", hideTip);
    node.addEventListener("focus", function () {
      var b = node.getBoundingClientRect();
      showTip(rowsFn(), b.left + window.scrollX + b.width / 2, b.top + window.scrollY);
    });
    node.addEventListener("blur", hideTip);
  }

  function svgFor(host, w, hgt, label) {
    host.textContent = "";
    var s = el("svg", { width: w, height: hgt, viewBox: "0 0 " + w + " " + hgt, role: "img", "aria-label": label }, host);
    return s;
  }

  // ---------- chart: horizontal waterfall ----------
  function waterfall(host, rows, title) {
    var W = host.clientWidth, narrow = W < 560;
    var labelW = narrow ? 0 : Math.min(230, W * 0.36), valW = 88;
    var rowH = narrow ? 50 : 34, barH = 18, top = 6;
    var H = top + rows.length * rowH + 6;
    var s = svgFor(host, W, H, title);
    var x0 = labelW, plotW = W - labelW - valW;
    var max = 0, run = 0;
    rows.forEach(function (r) { if (r.kind === "total") run = r.value; else run += r.value; max = Math.max(max, run, r.value); });
    var sx = function (v) { return x0 + (v / max) * plotW; };
    run = 0;
    rows.forEach(function (r, i) {
      var y = top + i * rowH + (narrow ? 20 : (rowH - barH) / 2);
      var a, b;
      if (r.kind === "total") { a = 0; b = r.value; run = r.value; }
      else { a = run; b = run + r.value; run = b; }
      var lo = Math.min(a, b), hi = Math.max(a, b);
      var color = r.kind === "total" ? "var(--c-total)" : r.value >= 0 ? "var(--c-pos)" : "var(--c-neg)";
      var lx = narrow ? 0 : labelW - 12, ly = narrow ? y - 6 : y + barH / 2 + 4;
      txt(s, lx, ly, r.label, { class: "v-label" + (r.kind === "total" ? " strong" : ""), "text-anchor": narrow ? "start" : "end" });
      // connector from previous bar end
      if (i > 0 && !narrow) el("line", { x1: sx(a), x2: sx(a), y1: y - (rowH - barH) + 2, y2: y, class: "v-connector" }, s);
      var bw = Math.max(2, sx(hi) - sx(lo));
      el("path", { d: barPath(sx(lo), y, bw, barH, r.kind === "total" || r.value >= 0 ? "right" : "left"), fill: color }, s);
      txt(s, Math.min(sx(hi) + 8, W - valW + 8), y + barH / 2 + 4, r.kind === "total" ? short(r.value) : signed(r.value), { class: "v-value" + (r.kind === "total" ? " strong" : "") });
      var hit = el("rect", { x: 0, y: y - (narrow ? 20 : 8), width: W, height: rowH, fill: "transparent" }, s);
      bindTip(hit, function () {
        return [{ head: true, label: r.label }, { value: r.kind === "total" ? inr(r.value) : (r.value < 0 ? "−" : "+") + inr(r.value), color: color, label: r.kind === "total" ? "running total" : r.value < 0 ? "takes away" : "adds" }];
      });
      hit.setAttribute("aria-label", r.label + ": " + inr(r.value));
    });
  }

  // ---------- chart: two balancing columns ----------
  function balance(host, left, right, title) {
    var W = host.clientWidth, H = 420, top = 34, bottom = 10;
    var s = svgFor(host, W, H, title);
    var total = left.reduce(function (a, r) { return a + r.value; }, 0);
    var narrow = W < 480;
    var colW = narrow ? 50 : Math.min(120, W * 0.2), gap = narrow ? 22 : Math.min(40, W * 0.06);
    var cxL = W / 2 - gap / 2 - colW, cxR = W / 2 + gap / 2;
    var plotH = H - top - bottom;
    function column(rows, cx, side, color, heading) {
      txt(s, cx + colW / 2, 16, heading, { class: "v-label strong", "text-anchor": "middle" });
      txt(s, cx + colW / 2, 30, short(total), { class: "v-axis", "text-anchor": "middle" });
      var y = H - bottom, placed = [];
      rows.forEach(function (r, i) {
        var hgt = (r.value / total) * plotH, y0 = y - hgt, last = i === rows.length - 1;
        // 2px surface gap between segments; only the top segment gets rounded corners
        var p = el("path", { d: colPath(cx, y0 + (last ? 0 : 2), colW, Math.max(1, hgt - (last ? 0 : 2)), last), fill: color }, s);
        placed.push({ r: r, mid: y0 + hgt / 2, node: p });
        y = y0;
      });
      // labels outside, pushed apart so they never overlap
      var minGap = 30;
      placed.sort(function (a, b) { return a.mid - b.mid; });
      var pos = placed.map(function (p) { return p.mid; });
      for (var it = 0; it < 30; it++) {
        for (var k = 1; k < pos.length; k++) if (pos[k] - pos[k - 1] < minGap) { var d = (minGap - (pos[k] - pos[k - 1])) / 2; pos[k - 1] -= d; pos[k] += d; }
        pos = pos.map(function (v) { return Math.min(Math.max(v, top + 14), H - bottom - 14); });
      }
      placed.forEach(function (p, k) {
        var lx = side === "left" ? cx - 10 : cx + colW + 10, anchor = side === "left" ? "end" : "start";
        el("line", { x1: side === "left" ? cx - 2 : cx + colW + 2, x2: side === "left" ? cx - 7 : cx + colW + 7, y1: p.mid, y2: pos[k], class: "v-connector" }, s);
        txt(s, lx, pos[k] - 2, narrow && p.r.short ? p.r.short : p.r.label, { class: "v-label", "text-anchor": anchor });
        txt(s, lx, pos[k] + 12, short(p.r.value), { class: "v-value strong", "text-anchor": anchor });
        bindTip(p.node, function () {
          return [{ head: true, label: p.r.label }, { value: inr(p.r.value), color: color, label: Math.round(p.r.value / total * 100) + "% of the total" }];
        });
        p.node.setAttribute("aria-label", p.r.label + ": " + inr(p.r.value));
      });
    }
    function colPath(x, y, w, hgt, round) {
      var r = round ? Math.min(4, hgt) : 0;
      return "M" + x + "," + (y + hgt) + "V" + (y + r) + (r ? "Q" + x + "," + y + " " + (x + r) + "," + y : "") +
        "H" + (x + w - r) + (r ? "Q" + (x + w) + "," + y + " " + (x + w) + "," + (y + r) : "") + "V" + (y + hgt) + "Z";
    }
    column(left, cxL, "left", "var(--c1)", narrow ? "Owns" : "What it owns");
    column(right, cxR, "right", "var(--c2)", narrow ? "Paid by" : "Who paid for it");
    txt(s, W / 2, H / 2, "=", { class: "v-equals", "text-anchor": "middle" });
  }

  // ---------- chart: diverging bars ----------
  function diverging(host, rows, title) {
    var W = host.clientWidth, narrow = W < 560;
    var labelW = narrow ? 0 : Math.min(260, W * 0.42);
    var rowH = narrow ? 50 : 36, barH = 18, top = 22;
    var H = top + rows.length * rowH + 4;
    var s = svgFor(host, W, H, title);
    var max = Math.max.apply(null, rows.map(function (r) { return Math.abs(r.value); }));
    var plotX = labelW, plotW = W - labelW, pad = 64;
    var mid = plotX + pad + (plotW - 2 * pad) * (max / (2 * max));
    var sc = (plotW - 2 * pad) / (2 * max);
    txt(s, mid - 8, 12, "← lowers profit", { class: "v-axis", "text-anchor": "end" });
    txt(s, mid + 8, 12, "raises profit →", { class: "v-axis" });
    if (!narrow) el("line", { x1: mid, x2: mid, y1: top - 4, y2: H, class: "v-baseline" }, s);
    rows.forEach(function (r, i) {
      var y = top + i * rowH + (narrow ? 20 : (rowH - barH) / 2);
      // on phones the labels sit above the bars, so the zero line is drawn per row and never crosses text
      if (narrow) el("line", { x1: mid, x2: mid, y1: y - 3, y2: y + barH + 3, class: "v-baseline" }, s);
      txt(s, narrow ? 0 : labelW - 12, narrow ? y - 6 : y + barH / 2 + 4, r.label, { class: "v-label", "text-anchor": narrow ? "start" : "end" });
      var w = Math.abs(r.value) * sc, color = r.value < 0 ? "var(--c-neg)" : "var(--c-pos)";
      var x = r.value < 0 ? mid - w : mid;
      el("path", { d: barPath(x, y, w, barH, r.value < 0 ? "left" : "right"), fill: color }, s);
      txt(s, r.value < 0 ? x - 6 : x + w + 6, y + barH / 2 + 4, signed(r.value), { class: "v-value", "text-anchor": r.value < 0 ? "end" : "start" });
      var hit = el("rect", { x: 0, y: y - (narrow ? 20 : 9), width: W, height: rowH, fill: "transparent" }, s);
      hit.setAttribute("aria-label", r.label + ": " + signed(r.value));
      bindTip(hit, function () { return [{ head: true, label: r.label }, { value: (r.value < 0 ? "−" : "+") + inr(r.value), color: color, label: r.value < 0 ? "lowers September profit" : "raises September profit" }]; });
    });
  }

  // ---------- chart: stacked horizontal bars ----------
  function stacked(host, spec, title, opts) {
    opts = opts || {};
    var W = host.clientWidth, narrow = W < 560;
    var labelW = narrow ? 0 : Math.min(250, W * 0.38), valW = 88;
    var rowH = narrow ? 48 : 34, barH = 18, top = 4;
    var H = top + spec.rows.length * rowH + 22;
    var s = svgFor(host, W, H, title);
    var totals = spec.rows.map(function (r) { return spec.keys.reduce(function (a, k) { return a + (r[k.key] || 0); }, 0); });
    var max = niceMax(Math.max.apply(null, totals));
    var x0 = labelW, plotW = W - labelW - valW, sc = plotW / max;
    // gridlines
    [0, 0.5, 1].forEach(function (f) {
      var gx = x0 + f * plotW;
      el("line", { x1: gx, x2: gx, y1: top, y2: H - 18, class: f === 0 ? "v-baseline" : "v-grid" }, s);
      txt(s, gx, H - 4, tick(max * f), { class: "v-axis", "text-anchor": f === 0 ? "start" : f === 1 ? "end" : "middle" });
    });
    spec.rows.forEach(function (r, i) {
      var y = top + i * rowH + (narrow ? 20 : (rowH - barH) / 2);
      txt(s, narrow ? 0 : labelW - 12, narrow ? y - 6 : y + barH / 2 + 4, r.label, { class: "v-label", "text-anchor": narrow ? "start" : "end" });
      var x = x0, present = spec.keys.filter(function (k) { return r[k.key]; });
      present.forEach(function (k, j) {
        var w = r[k.key] * sc, last = j === present.length - 1;
        el("path", { d: barPath(x, y, Math.max(1, w - (last ? 0 : 2)), barH, last ? "right" : "none"), fill: k.color }, s);
        x += w;
      });
      txt(s, x + 8, y + barH / 2 + 4, opts.valueFn ? opts.valueFn(r, totals[i]) : short(totals[i]), { class: "v-value" }, s);
      var hit = el("rect", { x: 0, y: y - (narrow ? 20 : 8), width: W, height: rowH, fill: "transparent" }, s);
      hit.setAttribute("aria-label", r.label + ": " + short(totals[i]));
      bindTip(hit, function () {
        var out = [{ head: true, label: r.label }];
        spec.keys.forEach(function (k) { if (r[k.key] || spec.keys.length > 1) out.push({ value: inr(r[k.key] || 0), color: k.color, label: k.label }); });
        if (spec.keys.length > 1) out.push({ value: inr(totals[i]), label: opts.totalLabel || "total" });
        return out;
      });
    });
  }

  // ---------- chart: step lines over time ----------
  function steps(host, spec, title) {
    var W = host.clientWidth, H = W < 560 ? 250 : 300, L = 8, R = 16, T = 18, B = W < 560 ? 40 : 70;
    var s = svgFor(host, W, H, title);
    var day = 864e5, t0 = Date.parse(spec.start), t1 = Date.parse(spec.end);
    var max = niceMax(Math.max.apply(null, spec.series.map(function (se) { return Math.max.apply(null, se.steps.map(function (p) { return p[1]; })); })));
    var sx = function (t) { return L + ((t - t0) / (t1 - t0)) * (W - L - R); };
    var sy = function (v) { return T + (1 - v / max) * (H - T - B); };
    [0, 0.5, 1].forEach(function (f) {
      var gy = sy(max * f);
      el("line", { x1: L, x2: W - R, y1: gy, y2: gy, class: f === 0 ? "v-baseline" : "v-grid" }, s);
      if (f) txt(s, L, gy - 5, tick(max * f), { class: "v-axis" });
    });
    function valueAt(se, t) {
      var v = 0; se.steps.forEach(function (p) { if (Date.parse(p[0]) <= t) v = p[1]; }); return v;
    }
    spec.series.forEach(function (se) {
      var d = "", prevY = null;
      se.steps.forEach(function (p, i) {
        var x = sx(Date.parse(p[0])), y = sy(p[1]);
        d += i === 0 ? "M" + x + "," + y : "H" + x + "V" + y;
        prevY = y;
      });
      d += "H" + sx(t1);
      el("path", { d: d + "V" + sy(0) + "H" + sx(t0) + "Z", fill: se.color, "fill-opacity": 0.1, stroke: "none" }, s);
      el("path", { d: d, fill: "none", stroke: se.color, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }, s);
    });
    // peak labels
    spec.series.forEach(function (se, i) {
      var peak = se.steps.reduce(function (a, p) { return p[1] > a[1] ? p : a; });
      var x = sx(Date.parse(peak[0])), y = sy(peak[1]);
      el("circle", { cx: x, cy: y, r: 4, fill: se.color, stroke: "var(--surface)", "stroke-width": 2 }, s);
      // first series labels to the left of its peak, the rest to the right, so neighbouring peaks don't collide
      txt(s, i === 0 ? x - 8 : x + 8, y - 8, short(peak[1]), { class: "v-value strong", "text-anchor": i === 0 ? "end" : "start" });
    });
    // event markers along the bottom
    var baseY = sy(0);
    var narrow = W < 560;
    spec.events.forEach(function (ev, i) {
      var x = sx(Date.parse(ev.date));
      var drop = narrow ? 0 : (i % 2) * 22;
      el("line", { x1: x, x2: x, y1: baseY, y2: baseY + 10 + drop, class: "v-connector" }, s);
      el("circle", { cx: x, cy: baseY, r: 4, fill: "var(--ink)", stroke: "var(--surface)", "stroke-width": 2 }, s);
      var anchor = narrow ? "middle" : x < 50 ? "start" : x > W - 60 ? "end" : "middle";
      // on phones the markers carry numbers and the list below the chart names them
      txt(s, narrow ? x + (i === 2 ? -5 : i === 3 ? 5 : 0) : x, baseY + 24 + drop, narrow ? String(i + 1) : ev.label, { class: "v-label small" + (narrow ? " strong" : ""), "text-anchor": anchor });
    });
    if (narrow) {
      var ol = h("ol", "ev-list", null, host);
      spec.events.forEach(function (ev) {
        var li = h("li", null, null, ol);
        h("b", null, new Date(Date.parse(ev.date)).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }), li);
        h("span", null, " " + ev.label, li);
      });
    }
    // crosshair
    var cross = el("line", { y1: T, y2: baseY, class: "v-cross", visibility: "hidden" }, s);
    var hit = el("rect", { x: L, y: 0, width: W - L - R, height: H, fill: "transparent" }, s);
    hit.setAttribute("aria-label", title + ". Use arrow keys to move through the dates.");
    var cur = t0;
    function show(t, px, py) {
      t = Math.round((t - t0) / day) * day + t0;
      t = Math.min(Math.max(t, t0), t1);
      cur = t;
      var x = sx(t);
      cross.setAttribute("x1", x); cross.setAttribute("x2", x); cross.setAttribute("visibility", "visible");
      var date = new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
      var rows = [{ head: true, label: date }];
      spec.series.forEach(function (se) { rows.push({ value: inr(valueAt(se, t)), color: se.color, label: se.label }); });
      spec.events.forEach(function (ev) { if (Date.parse(ev.date) === t) rows.push({ label: "● " + ev.label }); });
      showTip(rows, px, py);
    }
    hit.addEventListener("pointermove", function (e) {
      var b = s.getBoundingClientRect();
      var t = t0 + ((e.clientX - b.left - L) / (W - L - R)) * (t1 - t0);
      show(t, e.pageX, e.pageY);
    });
    hit.addEventListener("pointerleave", function () { cross.setAttribute("visibility", "hidden"); hideTip(); });
    hit.setAttribute("tabindex", "0");
    hit.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      var b = s.getBoundingClientRect();
      var t = cur + (e.key === "ArrowRight" ? day : -day);
      show(t, b.left + window.scrollX + sx(t), b.top + window.scrollY + T);
    });
    hit.addEventListener("focus", function () { var b = s.getBoundingClientRect(); show(cur, b.left + window.scrollX + sx(cur), b.top + window.scrollY + T); });
    hit.addEventListener("blur", function () { cross.setAttribute("visibility", "hidden"); hideTip(); });
  }

  // ---------- "chart": posting-period calendar (HTML) ----------
  function periods(host) {
    host.textContent = "";
    var grid = h("div", "periods", null, host);
    var months = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
    months.forEach(function (m, i) {
      var st = i < 5 ? "closed" : i === 5 ? "open" : "future";
      var c = h("div", "period " + st, null, grid);
      h("b", null, m, c);
      h("span", "p-num", String(i + 1).padStart(3, "0"), c);
      h("span", "p-st", st === "closed" ? "🔒 Closed" : st === "open" ? "✓ Open" : "Not open yet", c);
    });
    var sp = h("div", "period special", null, grid);
    h("b", null, "Last year's audit fixes", sp);
    h("span", "p-num", "013–016 / 2025", sp);
    h("span", "p-st", "🔑 Finance controllers only", sp);
  }

  // ---------- legend ----------
  function legend(host, keys) {
    var lg = h("div", "viz-legend", null, host);
    keys.forEach(function (k) {
      var it = h("span", "lg-item", null, lg);
      var sw = h("span", "lg-sw", null, it); sw.style.background = k.color;
      if (k.icon) h("span", "lg-ico", k.icon, it);
      h("span", null, k.label, it);
    });
  }

  // ---------- data table for the technical panel ----------
  function table(host, head, rows) {
    var wrap = h("div", "tech-table", null, host);
    var t = h("table", null, null, wrap), tr = h("tr", null, null, h("thead", null, null, t));
    head.forEach(function (c, i) { h("th", i > 0 && i < head.length - 1 ? "num" : null, c, tr); });
    var tb = h("tbody", null, null, t);
    rows.forEach(function (r) {
      var row = h("tr", null, null, tb);
      r.forEach(function (c, i) { h("td", i > 0 && i < r.length - 1 ? "num" : null, c, row); });
    });
  }

  // ---------- tab content ----------
  var TABS = [
    {
      id: "profit", tab: "Did it make money?", blocks: [{
        title: "From sales to profit, April to September 2026",
        draw: function (n) { waterfall(n, DATA.profit, "Waterfall from sales to profit"); },
        plain: [
          "Think of this as a staircase. It starts with all the money the company earned from selling its products. Each bar below takes away one kind of cost: the steel it bought, the salaries it paid, electricity, the bank's interest, tax.",
          "Whatever is left at the bottom is profit: the money the business actually kept."
        ],
        takeaway: "Out of every ₹100 the company brought in, it kept about ₹14.70 as profit. Most of the money (about ₹58) went on raw materials.",
        link: { href: "projects/fsv-month-end-close/", text: "How the statements were built (Part 5)" },
        tech: [
          "Profit & Loss per Schedule III, Division I, for H1 FY 2026-27 (periods 001–006, fiscal year variant V3, Apr–Mar).",
          "Grouped by Financial Statement Version INS3 (OB58). Each bar is an FSV node; the ranges come from chart of accounts INCA.",
          "Figures are after the September close (FBS1 accruals & deferrals). Profit before tax ₹58,17,500, tax ₹9,00,000, PAT ₹49,17,500.",
          "Margin = PAT ÷ total income (₹3,34,12,500) = 14.7%. Raw materials ÷ total income = 58.2%."
        ],
        table: function (n) { table(n, ["Line", "Amount", "Source"], DATA.profit.map(function (r) { return [r.label, (r.value < 0 ? "−" : "") + inr(r.value), r.tech]; })); }
      }]
    },
    {
      id: "balance", tab: "What does it own and owe?", blocks: [{
        title: "The balance sheet at 30 September 2026",
        draw: function (n) { balance(n, DATA.owns, DATA.funded, "Two columns of equal height: what the company owns and who paid for it"); },
        plain: [
          "The left column is everything the company has: machines, stock in the warehouse, money customers still owe it, and cash in the bank.",
          "The right column shows where the money for all of that came from: the owners, a bank loan, and bills the company hasn't paid yet.",
          "The two columns are always exactly the same height. Every rupee the company holds came from somewhere. If they don't match, there's a mistake in the books."
        ],
        takeaway: "Both sides are ₹3.39 crore, so the books balance. The owners have funded over half of the business, which makes it low-risk for lenders.",
        link: { href: "projects/fsv-month-end-close/statements.html", text: "Open the live statements (Part 5)" },
        tech: [
          "Balance Sheet per Schedule III from the post-close trial balance (38 G/L accounts, FS00), grouped by FSV INS3.",
          "Owner's money = share capital + reserves & surplus + profit for the period (the P&L result carried to equity by the FSV).",
          "Debt-to-equity = ₹75,00,000 ÷ ₹1,90,56,250 = 0.39. Current ratio = ₹1,87,53,750 ÷ ₹73,37,500 = 2.56.",
          "Receivables ₹64,80,000 tie to the AR open items in Part 3. GR/IR ₹3,40,000 ties to Part 2. Fixed assets tie to Part 4's register."
        ],
        table: function (n) {
          table(n, ["Item", "Amount", "Source"], DATA.owns.map(function (r) { return ["Owns · " + r.label, inr(r.value), r.tech]; })
            .concat(DATA.funded.map(function (r) { return ["Funded by · " + r.label, inr(r.value), r.tech]; })));
        }
      }]
    },
    {
      id: "close", tab: "Closing the month", blocks: [{
        title: "Month-end adjustments to September's profit",
        draw: function (n) { diverging(n, DATA.close, "Six month-end adjustments and how each moves profit"); },
        plain: [
          "On 30 September, some things had happened but no paperwork had arrived yet. The electricity was used, but the bill comes in October. Other things were the other way round: October's rent arrived early, in September.",
          "Month-end close fixes this, so each month shows only its own income and costs. Red bars lower September's profit and blue bars raise it. On 1 October each entry is reversed automatically, so nothing is counted twice."
        ],
        takeaway: "After the close, profit is ₹2.74 lakh lower (₹51.9 L → ₹49.2 L). Without these entries, September would have looked better than it really was.",
        stats: [["Profit before close", "₹51.9 L"], ["Profit after close", "₹49.2 L"], ["Current ratio", "2.68 → 2.56"]],
        link: { href: "projects/fsv-month-end-close/", text: "See the close step by step (Part 5)" },
        tech: [
          "Four accruals (A1–A4) and two deferrals (D1–D2) posted with FBS1 in period 006, doc type SA, with reversal date 01.10.2026 and reason 05.",
          "Reversed in period 007 with F.81 (doc type AB, documents 0100000461–466).",
          "Accrued expenses go to 219500 and income received in advance to 219600 (both current liabilities), which is why the current ratio drops.",
          "Net P&L effect: −1,20,000 − 50,000 − 62,500 + 18,750 − 1,50,000 + 90,000 = −₹2,73,750."
        ],
        table: function (n) { table(n, ["Adjustment", "Effect on profit", "Entry"], DATA.close.map(function (r) { return [r.label, (r.value < 0 ? "−" : "+") + inr(r.value), r.tech]; })); }
      }]
    },
    {
      id: "buying", tab: "Buying steel", blocks: [{
        title: "One purchase, from order to payment (Sep–Oct 2026)",
        draw: function (n) { steps(n, DATA.buying, "What the company owed on each day of the steel purchase"); },
        legend: DATA.buying.series,
        plain: [
          "The company ordered 10 tonnes of steel. It arrived in two trucks. While the bill hadn't arrived yet, the books still showed \"we have the goods, we'll owe for them\" (blue).",
          "When the supplier's bill came, the system checked the order, what was delivered and the bill against each other. They matched, so the blue amount became a bill to pay (orange), now including GST. A month later the payment run paid it automatically, on the due date."
        ],
        takeaway: "The company paid only for what it ordered and actually received, at the agreed price, and it paid on time.",
        link: { href: "projects/procure-to-pay/simulator.html", text: "Try the purchase simulator (Part 2)" },
        tech: [
          "Procure-to-pay in plant IN11: ME51N → ME21N → MIGO 101 ×2 → MIRO → F110. Blue line = GR/IR clearing 219100; orange line = vendor 100001 open item (recon 211000).",
          "OBYC account determination: BSX → 131000 inventory, WRX → 219100 GR/IR. GST input credit ₹1,04,400 (tax code I8) → 161000.",
          "Three-way match with GR-based invoice verification and OMR6 tolerances (PP 2% / ₹5,000, DQ ₹0). Payment terms NT30, run AP01 on 20.10.2026.",
          "No TDS under 194Q: IN10's turnover is below ₹10 crore. The ₹3,40,000 GR/IR in the trial balance is a second PO (paint, 4500000121) still waiting for its bill."
        ],
        table: function (n) { table(n, ["Date", "Step", "SAP posting"], DATA.buying.events.map(function (e) { return [e.date.split("-").reverse().join("."), e.label, e.tech]; })); }
      }]
    },
    {
      id: "selling", tab: "Selling & collecting", blocks: [{
        title: "Who owes the company money, and how late (30 Sep 2026)",
        draw: function (n) { stacked(n, DATA.aging, "Money owed by each customer, split by how late it is"); },
        legend: DATA.aging.keys,
        plain: [
          "When the company sells, customers usually get 30 days to pay. This chart shows how much each customer still owes and how late it is. Green isn't due yet. Yellow, orange and red get later and later.",
          "The later a payment is, the more likely it is never to be paid. So the finance team chases the red ones first."
        ],
        takeaway: "₹64.8 lakh is owed in total. Nearly half is not due yet, but Nashik Pumps has ₹6.98 lakh that is 80 days late and needs a call.",
        link: { href: "projects/order-to-cash/", text: "How sales and credit checks work (Part 3)" },
        tech: [
          "AR open items at 30.09.2026 (FBL5N-style), customers 200001–200004, reconciliation account 141000. They total ₹64,80,000, which ties to Part 5's trade receivables.",
          "Ageing by days overdue from the net due date (payment terms IN02). Buckets: not due, 1–30, 31–60, 61–90.",
          "SAP Credit Management (UKM_BP) blocks new orders when the oldest item is more than 60 days overdue, so customer 200004 would be blocked.",
          "Nashik's ₹6,98,000 is a residual item (DZ 1400000059) left when an earlier payment was short."
        ],
        table: function (n) {
          table(n, ["Customer", "Owed", "Detail"], DATA.aging.rows.map(function (r) {
            var t = DATA.aging.keys.reduce(function (a, k) { return a + (r[k.key] || 0); }, 0); return [r.label, inr(t), r.tech];
          }));
        }
      }, {
        title: "One sale: from the price tag to cash in the bank (Oct 2026)",
        draw: function (n) { waterfall(n, DATA.invoice, "From list price to cash received for one sale"); },
        plain: [
          "The company sold 1,000 parts to Kalinga at ₹2,000 each. Kalinga is a regular customer, so it gets 3% off. Then GST is added, and the company later passes that on to the government.",
          "Kalinga paid within 10 days, so it took a further 2% off for paying early. By law it also kept back a tiny slice as tax (TDS), which the company claims back from the tax office."
        ],
        takeaway: "An invoice of ₹22.89 lakh turned into ₹22.48 lakh of cash. The rest is not lost: it was an early-payment reward and a tax credit.",
        link: { href: "projects/order-to-cash/simulator.html", text: "Try the sales simulator (Part 3)" },
        tech: [
          "VA01 (credit check passed) → VL02N goods issue (Dr 531000 COGS / Cr 132000, ₹14,50,000) → VF01 billing (RV 1800000205) → F-28 incoming payment (DZ 1400000088).",
          "Pricing: PR00 − K007 3% + JOIG IGST 18% (Odisha customer, inter-state). VKOA: ERL → 411000, ERS → 412000.",
          "Cash discount 2% (terms IN02) posts to 663000. TDS 194Q 0.1% is deducted by the customer because its turnover is above ₹10 crore → 162000 TDS Receivable.",
          "Invoice ₹22,89,200 = received ₹22,48,460 + discount ₹38,800 + TDS ₹1,940."
        ],
        table: function (n) { table(n, ["Step", "Amount", "SAP"], DATA.invoice.map(function (r) { return [r.label, (r.value < 0 ? "−" : "") + inr(r.value), r.tech]; })); }
      }]
    },
    {
      id: "assets", tab: "Machines", blocks: [{
        title: "What each machine cost, and how much of it is used up (30 Sep 2026)",
        draw: function (n) { stacked(n, DATA.machines, "Machine cost split into value left and value used up", { totalLabel: "original cost" }); },
        legend: DATA.machines.keys,
        plain: [
          "A machine is bought once but used for years, a bit like a car that loses value every year you drive it. So its cost isn't counted all at once. A small slice is counted as a cost every month.",
          "Each bar is one machine's full price. The blue part is the value still left, and the orange part has already been counted as a cost (\"depreciation\")."
        ],
        takeaway: "The machines cost ₹1.97 crore and ₹1.51 crore of value is left. The newest machine cell is the biggest asset. In October a new machine was added and the old lathe was sold at a small profit.",
        link: { href: "projects/asset-accounting/simulator.html", text: "Try the asset simulator (Part 4)" },
        tech: [
          "Asset register of 11 assets in company code IN10, chart of depreciation IN10. Area 01 (Companies Act) posts to the ledger; area 15 (Income Tax Act, 15% WDV) is values only.",
          "Straight-line depreciation (key ZSLM) over Schedule II lives. Low-value assets are written off in year 1 (ZLVA). AO90 routes the postings: 111000/111900, 112000/112900 and 641000.",
          "Totals tie to the trial balance: cost ₹1,97,00,000, accumulated depreciation ₹45,60,000, net book value ₹1,51,40,000; H1 depreciation ₹9,90,000.",
          "October: F-90 into AUC 4000001 → AIBU settlement to 1100008 (₹21,60,000); F-92 sale of 1100002 for ₹5,00,000 (profit ₹44,000 → 423000); AFAB run ₹1,84,000."
        ],
        table: function (n) { table(n, ["Asset", "Cost", "Detail"], DATA.machines.rows.map(function (r) { return [r.label, inr(r.left + r.used), r.tech]; })); }
      }]
    },
    {
      id: "controls", tab: "Controls", blocks: [{
        title: "Who can post how much",
        draw: function (n) { stacked(n, DATA.limits, "Largest single entry each type of user may post"); },
        plain: [
          "Like spending limits on company cards, each person can only enter amounts up to their limit. A new temporary user can post up to ₹1 lakh, a clerk up to ₹5 lakh and the finance manager up to ₹50 lakh.",
          "If someone tries to enter a bigger amount, the system stops them. This protects against both honest typos and fraud."
        ],
        takeaway: "Bigger money needs a more senior person, and the system enforces it every time, not just when someone remembers to check.",
        link: { href: "projects/fi-enterprise-structure/validator.html", text: "Try the posting simulator (Part 1)" },
        tech: [
          "Tolerance groups in OBA4 for company code IN10, assigned to users in OB57: blank (TEMP01), FI_CLERK (CLERK01), FI_MGR (MGR01).",
          "Limits are per document and per open item. The per-open-item limits are ₹50,000, ₹2,00,000 and ₹25,00,000.",
          "Tested in the Part 1 unit tests, together with number ranges (FBN1), document types (OBA7) and field status (OBC4)."
        ],
        table: function (n) { table(n, ["User type", "Limit per entry", "Configuration"], DATA.limits.rows.map(function (r) { return [r.label, inr(r.v), r.tech]; })); }
      }, {
        title: "Which months are open for entries (financial year Apr 2026 – Mar 2027)",
        draw: function (n) { periods(n); },
        plain: [
          "The company's year runs April to March. Once a month is finished and checked, it is locked, like sealing the pages of a diary, so nobody can quietly change old numbers.",
          "Right now only September is open. Last year's special \"audit fix\" periods are open to finance controllers only."
        ],
        takeaway: "Old months can't be edited and future months can't be used early, so every report stays reliable.",
        link: { href: "projects/fi-enterprise-structure/", text: "How the company was set up (Part 1)" },
        tech: [
          "Fiscal year variant V3 (April–March, 12 periods + 4 special periods).",
          "OB52 posting period variant IN10: interval 1 opens 013–016/2025 for authorisation group FICL only; interval 2 opens 006/2026. Assets (A) are open for 006/2026 only.",
          "A posting dated 01.10.2026 fails until OB52 extends interval 2 to period 007 (unit tests UT-02 and UT-02b)."
        ],
        table: null
      }]
    }
  ];

  // ---------- build ----------
  function build(root) {
    var tabsEl = root.querySelector(".db-tabs"), panelsEl = root.querySelector(".db-panels");
    var drawn = {};
    TABS.forEach(function (t, i) {
      var b = h("button", "db-tab", t.tab, tabsEl);
      b.type = "button"; b.id = "tab-" + t.id;
      b.setAttribute("role", "tab"); b.setAttribute("aria-controls", "panel-" + t.id);
      b.setAttribute("aria-selected", i === 0 ? "true" : "false");
      b.tabIndex = i === 0 ? 0 : -1;
      var p = h("div", "db-panel", null, panelsEl);
      p.id = "panel-" + t.id; p.setAttribute("role", "tabpanel"); p.setAttribute("aria-labelledby", b.id);
      if (i) p.hidden = true;
      t.blocks.forEach(function (bl) {
        var card = h("article", "db-block", null, p);
        var viz = h("div", "viz-card", null, card);
        h("h3", "viz-title", bl.title, viz);
        if (bl.legend) legend(viz, bl.legend);
        var host = h("div", "viz", null, viz);
        bl.host = host;
        var ex = h("div", "explain", null, card);
        bl.plain.forEach(function (para) { h("p", null, para, ex); });
        var tk = h("div", "takeaway", null, ex);
        h("span", "tk-label", "The takeaway", tk);
        h("p", null, bl.takeaway, tk);
        if (bl.stats) {
          var st = h("div", "ex-stats", null, ex);
          bl.stats.forEach(function (s) { var d = h("div", null, null, st); h("span", null, s[0], d); h("b", null, s[1], d); });
        }
        var det = h("details", "tech", null, card);
        var sum = h("summary", null, null, det);
        h("span", null, "Technical details", sum);
        var body = h("div", "tech-body", null, det);
        var ul = h("ul", null, null, body);
        bl.tech.forEach(function (line) { h("li", null, line, ul); });
        if (bl.table) bl.table(body);
        var a = h("a", "ex-link", bl.link.text + " →", body);
        a.href = bl.link.href;
      });
    });
    function draw(t) {
      t.blocks.forEach(function (bl) { bl.draw(bl.host); bl.w = bl.host.clientWidth; });
      drawn[t.id] = true;
    }
    function select(i, focus) {
      var btns = tabsEl.querySelectorAll(".db-tab");
      btns.forEach(function (b, j) { b.setAttribute("aria-selected", j === i ? "true" : "false"); b.tabIndex = j === i ? 0 : -1; });
      panelsEl.querySelectorAll(".db-panel").forEach(function (p, j) { p.hidden = j !== i; });
      if (focus) btns[i].focus();
      btns[i].scrollIntoView({ block: "nearest", inline: "nearest" });
      hideTip();
      draw(TABS[i]);
    }
    tabsEl.addEventListener("click", function (e) {
      var b = e.target.closest(".db-tab"); if (!b) return;
      select(Array.prototype.indexOf.call(tabsEl.children, b));
    });
    tabsEl.addEventListener("keydown", function (e) {
      var btns = tabsEl.querySelectorAll(".db-tab"), i = Array.prototype.indexOf.call(btns, document.activeElement);
      if (e.key === "ArrowRight") { e.preventDefault(); select((i + 1) % btns.length, true); }
      if (e.key === "ArrowLeft") { e.preventDefault(); select((i - 1 + btns.length) % btns.length, true); }
    });
    // Deep link: index.html#dash-<tab id> opens that tab.
    function fromHash() {
      var m = /^#dash-(\w+)$/.exec(location.hash), i = m ? TABS.findIndex(function (t) { return t.id === m[1]; }) : -1;
      if (i >= 0) { select(i); root.scrollIntoView(); return true; }
      return false;
    }
    if (!fromHash()) draw(TABS[0]);
    window.addEventListener("hashchange", fromHash);
    var raf;
    window.addEventListener("resize", function () {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(function () {
        TABS.forEach(function (t) { t.blocks.forEach(function (bl) { if (bl.host.clientWidth && bl.host.clientWidth !== bl.w) { bl.draw(bl.host); bl.w = bl.host.clientWidth; } }); });
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var root = document.querySelector("[data-dashboard]");
    if (root) build(root);
  });
})();

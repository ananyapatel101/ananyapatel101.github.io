// UI for the IN10 procure-to-pay simulator. Logic lives in p2p-core.js; data in data/p2p_data.js.
(function () {
  "use strict";
  var D = P2P_DATA, C = D.config, V = window.IN10P2P;
  var NUM = ["poQty", "poPrice", "grQty", "invQty", "invPrice"];
  var TXT = ["priceControl", "grDate", "invDate", "invRef"];
  var BOOL = ["tds", "mrbr"];
  var STAGES = [
    ["gr", "1 · Goods receipt (MIGO)", [["nogr", ""], ["mmper", "MM period (OMSY / MMPV)"], ["ob52gr", "FI posting period (OB52)"], ["overdel", "Over-delivery tolerance (PO item)"]]],
    ["ir", "2 · Invoice verification (MIRO)", [["ob52ir", "FI posting period (OB52)"], ["grbiv", "GR-based invoice verification"], ["dup", "Duplicate invoice check (OMRDC / OMRM)"], ["dq", "Quantity variance (OMR6 key DQ)"], ["pp", "Price variance (OMR6 key PP)"]]],
    ["pay", "3 · Payment run (F110)", [["block", "Payment block (MRBR)"], ["due", "Due date (terms NT30)"]]]
  ];
  var activeTest = "P2P-01";
  var $ = function (id) { return document.getElementById(id); };
  var inr = V.inr;
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var dmy = function (s) { return s.slice(8, 10) + "." + s.slice(5, 7) + "." + s.slice(0, 4); };

  $("presets").innerHTML = D.tests.map(function (t) {
    var cls = t.expect.outcome === "error" ? "error" : t.expect.outcome;
    return '<button type="button" class="preset exp-' + cls + '" data-test="' + t.id + '" aria-pressed="false" title="' + esc(t.scenario) + '">' + t.id + "</button>";
  }).join("");

  function readForm() {
    var p = {};
    NUM.forEach(function (f) { p[f] = Math.max(0, +$("f-" + f).value || 0); });
    TXT.forEach(function (f) { p[f] = $("f-" + f).value; });
    BOOL.forEach(function (f) { p[f] = $("f-" + f).checked; });
    if (!p.grDate) p.grDate = "2026-09-18";
    if (!p.invDate) p.invDate = "2026-09-20";
    if (!p.poQty) p.poQty = 1;
    if (!p.poPrice) p.poPrice = 1;
    return p;
  }
  var OUTCOME = {
    paid: "paid in the F110 run", blocked: "posted, but held by payment block R", notdue: "posted, not yet due in this run", error: "stopped by a control"
  };
  function load(t) {
    NUM.concat(TXT).forEach(function (f) { $("f-" + f).value = t.input[f]; });
    BOOL.forEach(function (f) { $("f-" + f).checked = !!t.input[f]; });
    activeTest = t.id;
    $("preset-desc").textContent = t.id + ": " + t.scenario + ". Expected: " + OUTCOME[t.expect.outcome] + ".";
    run();
  }

  function run() {
    var p = readForm(), r = V.validate(C, p);
    document.querySelectorAll(".preset").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.test === activeTest)); });

    var last = r.checks[r.checks.length - 1];
    var b;
    if (r.outcome === "paid") {
      b = ['ok', "✓", "Paid · document " + r.pay.doc, "Invoice " + r.ir.doc + " cleared on " + dmy(r.pay.date) + ". ₹" + inr(r.pay.amount) + " to vendor " + C.vendor.id + " by bank transfer from HDFC1."];
    } else if (r.outcome === "blocked") {
      b = ['warn', "!", "Invoice " + r.ir.doc + " posted · blocked for payment", last.detail];
    } else if (r.outcome === "notdue") {
      b = ['warn', "…", "Invoice " + r.ir.doc + " posted · not due yet", last.detail];
    } else {
      b = ['bad', "✕", "Stopped at " + (last.stage === "gr" ? "goods receipt" : "invoice verification"), last.detail];
    }
    $("banner").innerHTML = '<div class="banner ' + b[0] + '"><span class="pill"><span class="ico" aria-hidden="true">' + b[1] + "</span>" + esc(b[2]) + "</span><p>" + esc(b[3]) + "</p></div>";

    var grir = r.ir ? r.grir : r.gr ? -r.gr.value : 0;
    $("tiles").innerHTML = [
      ["GR/IR 219100 for this PO", grir === 0 ? "₹0 · cleared" : "₹" + inr(Math.abs(grir)) + (grir < 0 ? " Cr" : " Dr")],
      ["Vendor net payable", r.ir ? "₹" + inr(r.ir.net) : "–"],
      ["Due date (NT30)", r.ir ? dmy(r.ir.dueDate) : "–"]
    ].map(function (t) { return '<div class="tile"><span>' + t[0] + "</span><b>" + t[1] + "</b></div>"; }).join("");

    var done = {};
    r.checks.forEach(function (ch) { done[ch.id] = ch; });
    $("checks").innerHTML = STAGES.map(function (st) {
      var items = st[2].filter(function (s) { return s[0] !== "nogr" || done.nogr; });
      return '<p class="stage-h">' + st[1] + '</p><ol class="checks">' + items.map(function (s) {
        var ch = done[s[0]];
        var cls = !ch ? "skip" : ch.status;
        var icon = { skip: "·", pass: "✓", fail: "✕", warn: "!" }[cls];
        var status = !ch ? "Not reached" : { pass: "Passed", fail: "Failed", warn: "Payment block R", skip: "Skipped" }[ch.status];
        var label = ch ? ch.label : s[1];
        return '<li class="' + cls + '"><span class="st" aria-hidden="true">' + icon + "</span><div><b>" + esc(label) + ' <span class="small muted">· ' + status + "</span></b>" +
          (ch ? "<p>" + esc(ch.detail) + "</p>" : "") + "</div></li>";
      }).join("") + "</ol>";
    }).join("");

    var docs = [];
    if (r.gr) docs.push(["WE · goods receipt", r.gr.doc, "Material doc " + r.gr.matDoc + " · " + dmy(p.grDate) + " · period " + String(r.gr.period).padStart(3, "0"), r.gr.lines]);
    if (r.ir) docs.push(["RE · vendor invoice", r.ir.doc, dmy(p.invDate) + " · period " + String(r.ir.period).padStart(3, "0") + (r.ir.blocked ? " · payment block R" : ""), r.ir.lines]);
    if (r.pay) docs.push(["KZ · outgoing payment", r.pay.doc, dmy(r.pay.date) + " · run " + C.f110.id, r.pay.lines]);
    $("docs").innerHTML = docs.length ? docs.map(function (d) {
      var dr = 0, cr = 0;
      var rows = d[3].map(function (l) {
        dr += l.dr; cr += l.cr;
        return '<tr><td class="mono">' + l.pk + '</td><td><span class="mono">' + l.account + "</span> " + esc(l.text) + (l.note ? "<small>" + esc(l.note) + "</small>" : "") +
          '</td><td class="num">' + (l.dr ? inr(l.dr) : "") + '</td><td class="num">' + (l.cr ? inr(l.cr) : "") + "</td></tr>";
      }).join("");
      return '<div><div class="doc-h"><span><b>' + d[1] + "</b> · " + d[0] + "</span><span>" + esc(d[2]) + '</span></div><div class="scroll-x"><table class="stmt">' +
        '<thead><tr><th>PK</th><th>Account</th><th class="num">Debit ₹</th><th class="num">Credit ₹</th></tr></thead><tbody>' + rows +
        '</tbody><tfoot><tr><td></td><td class="small muted">' + (dr === cr ? "Balanced" : "Out of balance") + '</td><td class="num">' + inr(dr) + '</td><td class="num">' + inr(cr) + "</td></tr></tfoot></table></div></div>";
    }).join("") : '<p class="muted small">No document posted. The first control stopped the flow before anything reached the ledger.</p>';
  }

  $("presets").addEventListener("click", function (e) {
    var btn = e.target.closest(".preset");
    if (btn) load(D.tests.filter(function (t) { return t.id === btn.dataset.test; })[0]);
  });
  $("form").addEventListener("input", function () { activeTest = null; $("preset-desc").textContent = "Custom entry, no unit test selected."; run(); });
  $("form").addEventListener("submit", function (e) { e.preventDefault(); });

  load(D.tests[0]);
})();

// UI for the IN10 order-to-cash simulator. Logic lives in o2c-core.js; data in data/o2c_data.js.
(function () {
  "use strict";
  var D = O2C_DATA, C = D.config, V = window.IN10O2C;
  var NUM = ["qty", "price", "discPct", "stock", "shortPay"];
  var TXT = ["customer", "acctGroup", "orderDate", "pgiDate", "billDate", "payDate", "poster"];
  var BOOL = ["creditRelease", "pgiDone", "discTaken", "tds"];
  var STAGES = [
    ["so", "1 · Sales order (VA01)", [["pricing", "Pricing (ZIN001)"], ["credit", "Credit check (segment IN10)"]]],
    ["pgi", "2 · Delivery & goods issue (VL01N / VL02N)", [["nopgi", ""], ["mmper", "MM period (OMSY / MMPV)"], ["ob52pgi", "FI posting period (OB52)"], ["stock", "Unrestricted stock at plant IN11"]]],
    ["bill", "3 · Billing (VF01)", [["pgi", "Goods issue status of the delivery"], ["vkoa", "Revenue account determination (VKOA)"], ["ob52bill", "FI posting period (OB52)"]]],
    ["pay", "4 · Incoming payment (F-28)", [["ob52pay", "FI posting period (OB52)"], ["oba4", "User tolerance (OBA4)"], ["disc", "Cash discount (terms IN02)"], ["tol", "Payment difference (OBA3 group IN10)"]]]
  ];
  var activeTest = "O2C-01";
  var $ = function (id) { return document.getElementById(id); };
  var inr = V.inr;
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var dmy = function (s) { return s.slice(8, 10) + "." + s.slice(5, 7) + "." + s.slice(0, 4); };

  $("f-customer").innerHTML = Object.keys(C.customers).map(function (id) {
    var c = C.customers[id];
    return '<option value="' + id + '">' + id + " · " + esc(c.name) + " (" + esc(c.regionName) + ")</option>";
  }).join("");

  $("presets").innerHTML = D.tests.map(function (t) {
    return '<button type="button" class="preset exp-' + t.expect.outcome + '" data-test="' + t.id + '" aria-pressed="false" title="' + esc(t.scenario) + '">' + t.id + "</button>";
  }).join("");

  function readForm() {
    var p = {};
    NUM.forEach(function (f) { p[f] = +$("f-" + f).value || 0; });
    ["qty", "price", "discPct", "stock"].forEach(function (f) { p[f] = Math.max(0, p[f]); });
    p.discPct = Math.min(p.discPct, 100);
    TXT.forEach(function (f) { p[f] = $("f-" + f).value; });
    BOOL.forEach(function (f) { p[f] = $("f-" + f).checked; });
    if (!p.orderDate) p.orderDate = "2026-10-01";
    if (!p.pgiDate) p.pgiDate = "2026-10-05";
    if (!p.billDate) p.billDate = "2026-10-05";
    if (!p.payDate) p.payDate = "2026-10-14";
    if (!p.qty) p.qty = 1;
    if (!p.price) p.price = 1;
    return p;
  }
  var OUTCOME = {
    cleared: "invoice paid and cleared", residual: "cleared with a residual item left open", blocked: "order saved with a credit block", error: "stopped by a control"
  };
  function load(t) {
    NUM.concat(TXT).forEach(function (f) { $("f-" + f).value = t.input[f]; });
    BOOL.forEach(function (f) { $("f-" + f).checked = !!t.input[f]; });
    activeTest = t.id;
    $("preset-desc").textContent = t.id + ": " + t.scenario + ". Expected: " + OUTCOME[t.expect.outcome] + ".";
    run();
  }
  var STAGE_NAME = { so: "the sales order", pgi: "goods issue", bill: "billing", pay: "the incoming payment" };

  function run() {
    var p = readForm(), r = V.validate(C, p), cu = C.customers[p.customer];
    document.querySelectorAll(".preset").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.test === activeTest)); });

    var last = r.checks[r.checks.length - 1];
    var b;
    if (r.outcome === "cleared") {
      b = ["ok", "✓", "Cleared · payment " + r.pay.doc, "Invoice " + r.bill.doc + " cleared on " + dmy(r.pay.date) + ". ₹" + inr(r.pay.received) + " received from customer " + p.customer + " into HDFC incoming clearing 171200."];
    } else if (r.outcome === "residual") {
      b = ["warn", "!", "Payment " + r.pay.doc + " posted · residual item ₹" + inr(Math.abs(r.pay.residual)), last.detail];
    } else if (r.outcome === "blocked") {
      b = ["warn", "!", "Order " + r.order.doc + " saved · credit block", last.detail];
    } else {
      b = ["bad", "✕", "Stopped at " + STAGE_NAME[last.stage], last.detail];
    }
    $("banner").innerHTML = '<div class="banner ' + b[0] + '"><span class="pill"><span class="ico" aria-hidden="true">' + b[1] + "</span>" + esc(b[2]) + "</span><p>" + esc(b[3]) + "</p></div>";

    var o = r.order, pct = Math.round(o.exposure / o.limit * 100);
    var bal = r.pay ? (r.pay.residual ? "₹" + inr(Math.abs(r.pay.residual)) + (r.pay.residual > 0 ? " Dr" : " Cr") : "₹0 · cleared") : r.bill ? "₹" + inr(r.bill.inv) + " Dr" : "–";
    $("tiles").innerHTML = [
      ["Credit exposure", pct + "% of ₹" + inr(o.limit / 100000) + " L"],
      ["Order value incl. GST", "₹" + inr(o.inv)],
      ["This invoice still open", bal]
    ].map(function (t) { return '<div class="tile"><span>' + t[0] + "</span><b>" + t[1] + "</b></div>"; }).join("");
    $("meter").innerHTML = '<div class="meter-bar" role="img" aria-label="Open receivables ₹' + inr(o.openAR) + ", this order ₹" + inr(o.inv) + ", limit ₹" + inr(o.limit) + '">' +
      '<span class="m-open" style="width:' + Math.min(100, o.openAR / Math.max(o.limit, o.exposure) * 100) + '%"></span>' +
      '<span class="m-new' + (o.exposure > o.limit ? " over" : "") + '" style="width:' + Math.min(100, o.inv / Math.max(o.limit, o.exposure) * 100) + '%"></span>' +
      '<i style="left:' + (o.limit / Math.max(o.limit, o.exposure) * 100) + '%"></i></div>' +
      '<p class="small muted"><span class="key k-open"></span>Open AR ₹' + inr(o.openAR) + ' <span class="key k-new"></span>This order ₹' + inr(o.inv) + " · limit ₹" + inr(o.limit) + (o.overdue > 0 ? " · oldest item " + o.overdue + " days overdue" : "") + "</p>";

    var done = {};
    r.checks.forEach(function (ch) { done[ch.id] = ch; });
    $("checks").innerHTML = STAGES.map(function (st) {
      var items = st[2].filter(function (s) { return s[0] !== "nopgi" || done.nopgi; });
      return '<p class="stage-h">' + st[1] + '</p><ol class="checks">' + items.map(function (s) {
        var ch = done[s[0]];
        var cls = !ch ? "skip" : ch.status;
        var icon = { skip: "·", pass: "✓", fail: "✕", warn: "!" }[cls];
        var status = !ch ? "Not reached" : { pass: "Passed", fail: "Failed", warn: "Needs follow-up", skip: "Skipped" }[ch.status];
        var label = ch ? ch.label : s[1];
        return '<li class="' + cls + '"><span class="st" aria-hidden="true">' + icon + "</span><div><b>" + esc(label) + ' <span class="small muted">· ' + status + "</span></b>" +
          (ch ? "<p>" + esc(ch.detail) + "</p>" : "") + "</div></li>";
      }).join("") + "</ol>";
    }).join("");

    var docs = [];
    if (r.pgi) docs.push(["WL · goods issue", r.pgi.doc, "Delivery " + r.pgi.dlv + " · material doc " + r.pgi.matDoc + " · " + dmy(p.pgiDate) + " · period " + String(r.pgi.period).padStart(3, "0"), r.pgi.lines]);
    if (r.bill) docs.push(["RV · customer invoice", r.bill.doc, "Billing " + r.bill.bilDoc + " · " + dmy(p.billDate) + " · period " + String(r.bill.period).padStart(3, "0"), r.bill.lines]);
    if (r.pay) docs.push(["DZ · incoming payment", r.pay.doc, dmy(r.pay.date) + " · F-28 by " + p.poster + " · period " + String(r.pay.period).padStart(3, "0"), r.pay.lines]);
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
    }).join("") : '<p class="muted small">No accounting document posted. A sales order and a delivery are logistics documents; the ledger is only touched at goods issue, billing and payment.</p>';
  }

  $("presets").addEventListener("click", function (e) {
    var btn = e.target.closest(".preset");
    if (btn) load(D.tests.filter(function (t) { return t.id === btn.dataset.test; })[0]);
  });
  $("form").addEventListener("input", function () { activeTest = null; $("preset-desc").textContent = "Custom entry, no unit test selected."; run(); });
  $("form").addEventListener("submit", function (e) { e.preventDefault(); });

  load(D.tests[0]);
})();

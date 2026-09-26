// UI for the IN10 asset accounting simulator. Logic lives in aa-core.js; data in data/aa_data.js.
(function () {
  "use strict";
  var D = AA_DATA, C = D.config, V = window.IN10AA;
  var NUM = ["machine", "install", "saleValue", "afabPer"];
  var TXT = ["asset", "cls", "invDate", "instDate", "capDate", "poster", "ret", "retPost", "retValue"];
  var BOOL = ["settle"];
  var STAGES = [
    ["master", "1 · Asset master (AS01)", [["acctdet", "Account determination (AO90)"]]],
    ["acq", "2 · Acquisition into AUC (F-90)", [["existing", ""], ["ob52acq", "FI posting period (OB52)"], ["oba4", "User tolerance (OBA4)"], ["aucpost", "Posted to asset under construction"]]],
    ["cap", "3 · Settlement (AIBU)", [["settle", ""], ["ob52cap", "FI posting period (OB52)"], ["capdate", "AUC settlement (AIBU)"]]],
    ["ret", "4 · Retirement (F-92 / ABAVN)", [["noret", ""], ["novalue", ""], ["ajab", "Asset fiscal year (AJRW / AJAB)"], ["ob52ret", "FI posting period (OB52)"], ["retdate", "Value date vs capitalisation date"], ["oba4ret", ""], ["result", "Retirement posted"]]],
    ["afab", "5 · Depreciation run (AFAB)", [["ob52afab", "FI posting period (OB52)"], ["run", "Planned depreciation, area 01"]]]
  ];
  var OPTIONAL = { existing: 1, settle: 1, noret: 1, novalue: 1, oba4ret: 1 };
  var activeTest = "AA-01";
  var $ = function (id) { return document.getElementById(id); };
  var inr = V.inr;
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var dmy = function (s) { return s.slice(8, 10) + "." + s.slice(5, 7) + "." + s.slice(0, 4); };

  $("f-asset").innerHTML = '<option value="' + C.newAsset.id + '">' + C.newAsset.id + " · " + esc(C.newAsset.text) + " (new)</option>" +
    Object.keys(C.assets).map(function (id) {
      var a = C.assets[id];
      return '<option value="' + id + '">' + id + " · " + esc(a.text) + "</option>";
    }).join("");

  $("presets").innerHTML = D.tests.map(function (t) {
    return '<button type="button" class="preset exp-' + t.expect.outcome + '" data-test="' + t.id + '" aria-pressed="false" title="' + esc(t.scenario) + '">' + t.id + "</button>";
  }).join("");

  function syncGroups() {
    $("g-new").disabled = $("f-asset").value !== C.newAsset.id;
    var r = $("f-ret").value;
    ["retPost", "retValue"].forEach(function (f) { $("f-" + f).disabled = r === "none"; });
    $("f-saleValue").disabled = r !== "sale";
  }
  function readForm() {
    var p = {};
    NUM.forEach(function (f) { p[f] = Math.max(0, +$("f-" + f).value || 0); });
    TXT.forEach(function (f) { p[f] = $("f-" + f).value; });
    BOOL.forEach(function (f) { p[f] = $("f-" + f).checked; });
    var dflt = { invDate: "2026-10-09", instDate: "2026-10-16", capDate: "2026-10-20", retPost: "2026-10-26", retValue: "2026-10-26" };
    Object.keys(dflt).forEach(function (f) { if (!p[f]) p[f] = dflt[f]; });
    if (!p.afabPer) p.afabPer = 7;
    return p;
  }
  var OUTCOME = { posted: "all documents posted", held: "AUC held, not depreciated", error: "stopped by a control" };
  function load(t) {
    NUM.concat(TXT).forEach(function (f) { $("f-" + f).value = t.input[f]; });
    BOOL.forEach(function (f) { $("f-" + f).checked = !!t.input[f]; });
    activeTest = t.id;
    $("preset-desc").textContent = t.id + ": " + t.scenario + ". Expected: " + OUTCOME[t.expect.outcome] + ".";
    syncGroups();
    run();
  }
  var STAGE_NAME = { master: "the asset master", acq: "acquisition", cap: "settlement", ret: "retirement", afab: "the depreciation run" };

  function run() {
    var p = readForm(), r = V.validate(C, p);
    document.querySelectorAll(".preset").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.test === activeTest)); });

    var last = r.checks[r.checks.length - 1], b;
    if (r.outcome === "posted") {
      var what = r.ret ? (r.ret.type === "sale" ? "Asset " + r.asset.id + " sold, " + (r.ret.gainLoss >= 0 ? "profit ₹" + inr(r.ret.gainLoss) : "loss ₹" + inr(-r.ret.gainLoss)) : "Asset " + r.asset.id + " scrapped, loss ₹" + inr(-r.ret.gainLoss))
               : r.cap ? "Asset " + r.asset.id + " capitalised at ₹" + inr(r.cap.value) : "Asset " + r.asset.id + " depreciated";
      b = ["ok", "✓", "Posted · " + what, "Depreciation run " + r.afab.doc + " for period " + String(r.afab.period).padStart(3, "0") + ": this asset's share is ₹" + inr(r.afab.dep) + "."];
    } else if (r.outcome === "held") {
      b = ["warn", "!", "Invoices posted · AUC " + C.newAsset.auc + " held in CWIP", last.detail];
    } else {
      b = ["bad", "✕", "Stopped at " + STAGE_NAME[last.stage], last.detail];
    }
    $("banner").innerHTML = '<div class="banner ' + b[0] + '"><span class="pill"><span class="ico" aria-hidden="true">' + b[1] + "</span>" + esc(b[2]) + "</span><p>" + esc(b[3]) + "</p></div>";

    var a = r.asset, stopped = r.outcome === "error";
    var apc = a ? (r.acq && !r.cap ? 0 : a.cost) : 0;
    var nbv = stopped ? null : r.nbvEnd;
    var tax = stopped ? "–" : r.outcome === "held" ? "₹0 · not in use" : r.ret ? "₹0 · sold/scrapped" : "₹" + inr(r.taxDepFY) + (r.taxDays !== null && r.taxDays < 180 ? " · half rate" : "");
    $("tiles").innerHTML = [
      ["APC, area 01", a && (r.cap || p.asset !== C.newAsset.id) ? "₹" + inr(a.cost) : r.acq ? "₹" + inr(r.acq.aucValue) + " AUC" : "–"],
      ["NBV after the run", nbv === null ? "–" : "₹" + inr(nbv)],
      ["Tax dep FY 26-27 (area 15)", tax]
    ].map(function (t) { return '<div class="tile"><span>' + t[0] + "</span><b>" + t[1] + "</b></div>"; }).join("");

    if (a && !stopped && r.outcome !== "held" && !r.ret && apc) {
      var acc = apc - nbv;
      $("meter").innerHTML = '<div class="meter-bar" role="img" aria-label="Accumulated depreciation ₹' + inr(acc) + ", net book value ₹" + inr(nbv) + '">' +
        '<span class="m-acc" style="width:' + (acc / apc * 100) + '%"></span><span class="m-nbv" style="width:' + (nbv / apc * 100) + '%"></span></div>' +
        '<p class="small muted"><span class="key k-acc"></span>Accumulated depreciation ₹' + inr(acc) + ' <span class="key k-nbv"></span>Net book value ₹' + inr(nbv) +
        (a.life ? " · life " + a.life / 12 + " years" : " · low-value asset") + "</p>";
    } else if (r.ret) {
      $("meter").innerHTML = '<p class="small muted">Retired: APC ₹' + inr(a.cost) + " − accumulated depreciation ₹" + inr(r.ret.accDep) + " = NBV ₹" + inr(r.ret.nbv) + " on the value date.</p>";
    } else {
      $("meter").innerHTML = "";
    }

    var done = {};
    r.checks.forEach(function (ch) { done[ch.id] = ch; });
    $("checks").innerHTML = STAGES.map(function (st) {
      var items = st[2].filter(function (s) { return !OPTIONAL[s[0]] || done[s[0]]; });
      if (done.existing && st[0] === "cap") items = [];
      if (done.existing && st[0] === "acq") items = items.filter(function (s) { return s[0] === "existing"; });
      if (done.settle) items = items.filter(function (s) { return s[0] === "settle" || st[0] !== "cap"; });
      if (done.noret && st[0] === "ret") items = items.filter(function (s) { return s[0] === "noret"; });
      if (!items.length) return "";
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
    if (r.acq) r.acq.docs.forEach(function (d) { docs.push(["KR · vendor invoice to AUC", d.doc, dmy(d.date) + " · " + d.tcode + " by " + p.poster, d.lines]); });
    if (r.cap) docs.push(["AA · AUC settlement", r.cap.doc, dmy(r.cap.date) + " · AIBU", r.cap.lines]);
    if (r.ret) docs.push([r.ret.docType + (r.ret.type === "sale" ? " · asset sale" : " · scrapping"), r.ret.doc, dmy(r.ret.date) + " · " + r.ret.tcode + " · value date " + dmy(p.retValue), r.ret.lines]);
    if (r.afab && r.afab.lines.length) docs.push(["AF · depreciation run (this asset)", r.afab.doc, "Period " + String(r.afab.period).padStart(3, "0") + "/2026 · AFAB", r.afab.lines]);
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
    }).join("") : '<p class="muted small">No accounting document posted. A control stopped the flow before the first posting.</p>';
  }

  $("presets").addEventListener("click", function (e) {
    var btn = e.target.closest(".preset");
    if (btn) load(D.tests.filter(function (t) { return t.id === btn.dataset.test; })[0]);
  });
  $("form").addEventListener("input", function () { activeTest = null; $("preset-desc").textContent = "Custom entry, no unit test selected."; syncGroups(); run(); });
  $("form").addEventListener("change", function () { syncGroups(); run(); });
  $("form").addEventListener("submit", function (e) { e.preventDefault(); });

  load(D.tests[0]);
})();

// UI for the IN10 posting simulator. Logic lives in validator-core.js; data in data/es_data.js.
(function () {
  "use strict";
  var D = ES_DATA, V = window.IN10Validator;
  var FIELDS = ["docType", "user", "postingDate", "specialPeriod", "amount", "currency", "drAccount", "drCostCenter", "crAccount", "crCostCenter"];
  var STEPS = [
    ["fyv", "Fiscal year & period (V3)"], ["ob52", "Posting period open (OB52)"], ["oba7", "Document type allows account types (OBA7)"],
    ["fbn1", "Number range (FBN1)"], ["obc4", "Field status (OBC4)"], ["ob08", "Exchange rate (OB08)"], ["oba4", "Tolerance group (OBA4)"]
  ];
  var openP07 = false, activeTest = "UT-01";
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function inr(n) {
    var s = String(Math.round(n)), last3 = s.slice(-3), rest = s.slice(0, -3);
    return (rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," : "") + last3;
  }
  function opts(el, list) { el.innerHTML = list.map(function (o) { return '<option value="' + esc(o[0]) + '">' + esc(o[1]) + "</option>"; }).join(""); }

  // ---------- populate controls ----------
  opts($("f-docType"), Object.keys(D.docTypes).map(function (k) { return [k, k + " · " + D.docTypes[k].text]; }));
  opts($("f-user"), Object.keys(D.users).map(function (k) { var u = D.users[k]; return [k, k + " · " + (u.group || "no group") + (u.authGroup ? " · " + u.authGroup : "")]; }));
  var acctList = Object.keys(D.accounts).map(function (k) { var a = D.accounts[k]; return [k, a.type + " · " + k + " " + a.text.replace(/ \(recon \d+\)/, "")]; });
  opts($("f-drAccount"), acctList);
  opts($("f-crAccount"), acctList);
  var ccList = [["", "None"]].concat(Object.keys(D.costCenters).map(function (k) { return [k, k + " · " + D.costCenters[k]]; }));
  opts($("f-drCostCenter"), ccList);
  opts($("f-crCostCenter"), ccList);

  $("presets").innerHTML = D.tests.map(function (t) {
    return '<button type="button" class="preset exp-' + (t.expect === "posted" ? "posted" : "error") + '" data-test="' + t.id + '" aria-pressed="false" title="' + esc(t.scenario) + '">' + t.id + "</button>";
  }).join("");

  function cfg() {
    if (!openP07) return D;
    var c = JSON.parse(JSON.stringify(D));
    Object.keys(c.ob52).forEach(function (t) { var r = c.ob52[t]; (r.int2 || r.int1).toPer = 7; });
    return c;
  }
  function readForm() {
    var p = {};
    FIELDS.forEach(function (f) { p[f] = $("f-" + f).value; });
    p.amount = Math.max(0, +p.amount || 0);
    return p;
  }
  function load(test) {
    FIELDS.forEach(function (f) { $("f-" + f).value = test.input[f]; });
    openP07 = !!test.openP07;
    $("open-p07").checked = openP07;
    activeTest = test.id;
    $("preset-desc").textContent = test.id + ": " + test.scenario + ". Expected: " +
      (test.expect === "posted" ? "posts as document " + test.doc : "blocked at " + STEPS.filter(function (s) { return s[0] === test.expect; })[0][1]) + ".";
    run();
  }

  // ---------- render ----------
  function run() {
    var c = cfg(), p = readForm();
    var r = V.validate(c, p);
    document.querySelectorAll(".preset").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.test === activeTest)); });

    var last = r.checks[r.checks.length - 1];
    $("banner").innerHTML = r.posted
      ? '<div class="banner ok"><span class="pill"><span class="ico" aria-hidden="true">✓</span>Document ' + r.document + " posted</span>" +
        "<p>Company code IN10 · fiscal year " + r.year + " · period " + String(r.period).padStart(3, "0") + " · ₹" + inr(r.local) + " in local currency</p></div>"
      : '<div class="banner bad"><span class="pill"><span class="ico" aria-hidden="true">!</span>Posting blocked</span><p>' + esc(last.detail) + "</p></div>";

    var done = {};
    r.checks.forEach(function (ch) { done[ch.id] = ch; });
    $("checks").innerHTML = STEPS.map(function (s) {
      var ch = done[s[0]];
      var cls = !ch ? "skip" : ch.ok ? "pass" : "fail";
      var icon = !ch ? "·" : ch.ok ? "✓" : "✕";
      var status = !ch ? "Not reached" : ch.ok ? "Passed" : "Failed";
      return '<li class="' + cls + '"><span class="st" aria-hidden="true">' + icon + "</span><div><b>" + s[1] + ' <span class="small muted">· ' + status + "</span></b>" +
        (ch ? "<p>" + esc(ch.detail) + "</p>" : "") + "</div></li>";
    }).join("");

    var dr = D.accounts[p.drAccount], cr = D.accounts[p.crAccount];
    var pk = { S: ["40", "50"], K: ["21", "31"], D: ["01", "15"] };
    var local = r.local || Math.round(p.amount);
    $("entry").innerHTML = '<thead><tr><th>PK</th><th>Account</th><th>Cost center</th><th class="num">Debit</th><th class="num">Credit</th></tr></thead><tbody>' +
      "<tr><td class=\"mono\">" + pk[dr.type][0] + "</td><td>" + esc(dr.id + " · " + dr.text) + "</td><td class=\"mono\">" + (p.drCostCenter || "–") + '</td><td class="num">' + inr(p.amount) + " " + p.currency + '</td><td class="num"></td></tr>' +
      "<tr><td class=\"mono\">" + pk[cr.type][1] + "</td><td>" + esc(cr.id + " · " + cr.text) + "</td><td class=\"mono\">" + (p.crCostCenter || "–") + '</td><td class="num"></td><td class="num">' + inr(p.amount) + " " + p.currency + "</td></tr>" +
      "</tbody>" + (p.currency !== "INR" && r.local ? '<tfoot><tr><td colspan="5" class="small muted">Local currency amount ₹' + inr(local) + "</td></tr></tfoot>" : "");

    renderOb52(c);
  }

  function ivText(iv) {
    if (!iv) return "–";
    var f = function (p, y) { return String(p).padStart(3, "0") + "/" + y; };
    return f(iv.fromPer, iv.fromYear) + " – " + f(iv.toPer, iv.toYear);
  }
  function renderOb52(c) {
    $("ob52").innerHTML = '<thead><tr><th>Account type</th><th>Interval 1</th><th>Auth group</th><th>Interval 2</th></tr></thead><tbody>' +
      Object.keys(c.ob52).map(function (t) {
        var r = c.ob52[t];
        return "<tr><td class=\"mono\">" + t + '</td><td class="mono">' + ivText(r.int1) + '</td><td class="mono">' + (r.int1 && r.int1.authGroup || "–") +
          '</td><td class="mono">' + ivText(r.int2) + "</td></tr>";
      }).join("") + "</tbody>";
  }

  // ---------- events ----------
  $("presets").addEventListener("click", function (e) {
    var b = e.target.closest(".preset");
    if (b) load(D.tests.filter(function (t) { return t.id === b.dataset.test; })[0]);
  });
  $("form").addEventListener("input", function () { activeTest = null; $("preset-desc").textContent = "Custom entry, no unit test selected."; run(); });
  $("form").addEventListener("submit", function (e) { e.preventDefault(); });
  $("open-p07").addEventListener("change", function (e) { openP07 = e.target.checked; run(); });

  load(D.tests[0]);
})();

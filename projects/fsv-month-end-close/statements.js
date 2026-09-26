// Live Schedule III statements for IN10. Data: window.FSV_DATA (data/fsv_data.js).
// Sign convention in the data: debit = positive, credit = negative.
(function () {
  "use strict";
  var D = window.FSV_DATA;
  var VIEWS = [
    { label: "Pre-close trial balance · 30.09.2026", upto: null },
    { label: "After FBS1 · 30.09.2026 (P06)", upto: "2026-09-30" },
    { label: "After F.81 · YTD to 01.10.2026 (P07)", upto: "2026-10-01" },
    { label: "After FB60 actual bill · YTD to 08.10.2026", upto: "2026-10-08" }
  ];
  var CREDIT_POSITIVE = /^(BS\.EL|PL\.REV|PL\.OI)/; // shown as positive when in credit
  var state = { view: 1, on: {}, truncated: false, open: {} };
  D.entries.forEach(function (e) { state.on[e.id] = true; });

  // ---------- formatting ----------
  function inr(n) {
    var neg = n < 0, s = Math.round(Math.abs(n)).toString();
    var last3 = s.slice(-3), rest = s.slice(0, -3);
    if (rest) last3 = "," + last3;
    rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
    return (neg ? "−" : "") + rest + last3;
  }
  function lakh(n) { return (n < 0 ? "−" : "") + "₹" + (Math.abs(n) / 1e5).toFixed(2) + " L"; }
  function signed(n) { return n === 0 ? "–" : (n > 0 ? "+" : "") + inr(n); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }

  // ---------- model ----------
  var nodes = {}, children = {};
  D.nodes.forEach(function (n) {
    nodes[n.id] = n;
    (children[n.parent] = children[n.parent] || []).push(n);
  });
  Object.keys(children).forEach(function (k) { children[k].sort(function (a, b) { return a.sort - b.sort; }); });
  var text = {};
  D.accounts.forEach(function (a) { text[a.a] = a.t; });
  var isPL = function (a) { return "456".indexOf(a.charAt(0)) >= 0; };
  var full = function (a) { return ("0000000000" + a).slice(-10); };

  function ranges(n) {
    if (state.truncated && n.id === "BS.A.CA.INV") return [{ f: "131", t: "139", d: true, c: true }];
    return n.ranges;
  }
  // FSV lookup: string compare on the stored 10-character account, the way the range check behaves.
  function nodesFor(acct, bal) {
    var key = full(acct), hits = [];
    D.nodes.forEach(function (n) {
      ranges(n).forEach(function (r) {
        if (key >= r.f && key <= r.t && ((bal >= 0 && r.d) || (bal < 0 && r.c))) hits.push(n.id);
      });
    });
    return hits;
  }

  function linesInView(view) {
    var upto = VIEWS[view].upto;
    if (!upto) return [];
    return D.journal.filter(function (j) {
      if (j.Posting_Date > upto) return false;
      if (j.Entry_ID === "TRUEUP") return true;
      return !!state.on[j.Entry_ID];
    });
  }

  function balances(view) {
    var b = {};
    D.accounts.forEach(function (a) { b[a.a] = a.bal; });
    linesInView(view).forEach(function (j) { b[j.GL_Account] += j.Debit_INR - j.Credit_INR; });
    return b;
  }

  function roll(b) {
    var node = {}, acctNode = {}, issues = { na: [], dup: [] };
    D.nodes.forEach(function (n) { node[n.id] = 0; });
    Object.keys(b).forEach(function (a) {
      var hits = nodesFor(a, b[a]);
      var target = hits[0] || "NA";
      if (!hits.length) issues.na.push(a);
      if (hits.length > 1) issues.dup.push(a);
      acctNode[a] = target;
      node[target] += b[a];
    });
    var pl = 0;
    Object.keys(b).forEach(function (a) { if (isPL(a)) pl += b[a]; });
    node["BS.EL.SF.RS.NR"] += pl; // net result shown inside Reserves & surplus
    // end items already hold their own balances; add child totals to parents
    (function sum(id) {
      (children[id] || []).forEach(function (c) { node[id] += sum(c.id); });
      return node[id];
    })("INS3");
    return { node: node, acctNode: acctNode, issues: issues, pl: pl };
  }

  function shown(id, v) { return CREDIT_POSITIVE.test(id) ? -v : v; }

  function metrics(r) {
    var n = r.node;
    var rev = -n["PL.REV"], oi = -n["PL.OI"];
    var ebitda = rev + oi - n["PL.EXP.COMC"] - n["PL.EXP.EMP"] - n["PL.EXP.OTH"];
    var assets = n["BS.A"], el = -n["BS.EL"];
    return {
      pat: -r.pl, ebitda: ebitda, income: rev + oi,
      assets: assets, el: el,
      cr: n["BS.A.CA"] / -n["BS.EL.CL"]
    };
  }

  // ---------- render ----------
  var base = roll(balances(0));
  var baseM = metrics(base);

  function render() {
    var b = balances(state.view);
    var r = roll(b);
    var m = metrics(r);
    renderKpis(m, r);
    renderStatement("bs", "BS", r, b);
    renderStatement("pl", "PL", r, b);
    document.getElementById("bs-asof").textContent = VIEWS[state.view].label;
    document.getElementById("pl-asof").textContent = state.view >= 2 ? "YTD Apr – Oct 2026" : "YTD Apr – Sep 2026";
    renderIntegrity(r);
    renderJournal();
    renderChart();
    document.querySelectorAll("#view-seg button").forEach(function (btn) {
      btn.setAttribute("aria-pressed", String(+btn.dataset.view === state.view));
    });
  }

  function renderKpis(m, r) {
    var balanced = Math.round(m.assets - m.el) === 0 && r.issues.na.length === 0;
    var k = [
      ["Profit after tax", lakh(m.pat), m.pat - baseM.pat],
      ["EBITDA", lakh(m.ebitda), m.ebitda - baseM.ebitda],
      ["Total income", lakh(m.income), m.income - baseM.income],
      ["Current ratio", m.cr.toFixed(2), null, (m.cr - baseM.cr)]
    ];
    var html = k.map(function (x) {
      var d = x[2] !== null ? (x[2] === 0 ? "No change vs pre-close" : signed(x[2]) + " vs pre-close")
        : (Math.abs(x[3]) < 0.005 ? "No change vs pre-close" : (x[3] > 0 ? "+" : "−") + Math.abs(x[3]).toFixed(2) + " vs pre-close");
      return '<div class="kpi"><span class="k-label">' + x[0] + '</span><span class="k-value">' + x[1] + '</span><span class="k-delta">' + d + "</span></div>";
    }).join("");
    html += '<div class="kpi check ' + (balanced ? "ok" : "bad") + '"><span class="k-label">Balance check</span>' +
      '<span class="pill"><span class="ico" aria-hidden="true">' + (balanced ? "✓" : "!") + "</span>" +
      (balanced ? "Balanced" : "Out of balance") + "</span>" +
      '<span class="k-delta">Assets ' + inr(m.assets) + "<br>Equity + liabilities " + inr(m.el) +
      (balanced ? "" : "<br>Not assigned " + inr(r.node.NA)) + "</span></div>";
    document.getElementById("kpis").innerHTML = html;
  }

  function renderStatement(elId, rootId, r, b) {
    var rows = ['<thead><tr><th>FSV item</th><th class="num">Current ₹</th><th class="num">Pre-close ₹</th><th class="num">Change</th></tr></thead><tbody>'];
    function walk(id, depth) {
      (children[id] || []).forEach(function (n) {
        if (n.id === "PL.TAX") {
          // Division I: IX. Profit before tax sits between expenses and X. Tax expense (no exceptional items)
          var pbt = -r.pl + r.node["PL.TAX"], bpbt = -base.pl + base.node["PL.TAX"];
          rows.push('<tr class="total"><td>IX. Profit before tax</td><td class="num">' + inr(pbt) + '</td><td class="num">' + inr(bpbt) + '</td><td class="num delta">' + signed(pbt - bpbt) + "</td></tr>");
        }
        var v = shown(n.id, r.node[n.id]), pv = shown(n.id, base.node[n.id]), dv = v - pv;
        var accts = Object.keys(b).filter(function (a) { return r.acctNode[a] === n.id; });
        var label = esc(n.text);
        if (accts.length) {
          label = '<button type="button" class="exp-btn" aria-expanded="' + !!state.open[n.id] + '" data-node="' + n.id + '">' + label + "</button>";
        }
        rows.push('<tr class="l' + Math.min(n.level, 5) + (dv ? " changed" : "") + '"><td>' + label + '</td><td class="num">' + inr(v) +
          '</td><td class="num">' + inr(pv) + '</td><td class="num delta">' + signed(dv) + "</td></tr>");
        if (accts.length && state.open[n.id]) {
          accts.forEach(function (a) {
            var av = shown(n.id, b[a]);
            rows.push('<tr class="acct-row"><td>' + full(a) + " · " + esc(text[a]) + '</td><td class="num">' + inr(av) + '</td><td class="num"></td><td class="num"></td></tr>');
          });
        }
        if (n.id === "BS.EL.SF.RS" && state.open[n.id]) {
          rows.push('<tr class="acct-row"><td>Net result (P&amp;L, not yet carried forward)</td><td class="num">' + inr(-r.pl) + '</td><td class="num"></td><td class="num"></td></tr>');
        }
        walk(n.id, depth + 1);
      });
    }
    walk(rootId, 0);
    if (rootId === "BS") {
      var m = metrics(r);
      if (r.node.NA) {
        rows.push('<tr class="na"><td>Not assigned (' + r.issues.na.join(", ") + ')</td><td class="num">' + inr(r.node.NA) + '</td><td class="num">' + inr(base.node.NA) + '</td><td class="num delta">' + signed(r.node.NA - base.node.NA) + "</td></tr>");
      }
      rows.push('<tr class="total"><td>Total assets</td><td class="num">' + inr(m.assets) + '</td><td class="num">' + inr(baseM.assets) + '</td><td class="num delta">' + signed(m.assets - baseM.assets) + "</td></tr>");
      rows.push('<tr class="total"><td>Total equity and liabilities</td><td class="num">' + inr(m.el) + '</td><td class="num">' + inr(baseM.el) + '</td><td class="num delta">' + signed(m.el - baseM.el) + "</td></tr>");
    } else {
      rows.push('<tr class="total"><td>XI. Profit for the period</td><td class="num">' + inr(-r.pl) + '</td><td class="num">' + inr(-base.pl) + '</td><td class="num delta">' + signed(-r.pl + base.pl) + "</td></tr>");
    }
    rows.push("</tbody>");
    document.getElementById(elId).innerHTML = rows.join("");
  }

  function renderIntegrity(r) {
    var total = D.accounts.length;
    var assigned = total - r.issues.na.length;
    var cells = [
      [assigned + " / " + total, "Accounts assigned", assigned !== total],
      [r.issues.na.length, "In Not assigned", r.issues.na.length > 0],
      [r.issues.dup.length, "Assigned twice", r.issues.dup.length > 0]
    ];
    document.getElementById("integrity").innerHTML = cells.map(function (c) {
      return '<div class="' + (c[2] ? "bad" : "") + '"><b>' + c[0] + "</b><span>" + c[1] + "</span></div>";
    }).join("");
  }

  function renderJournal() {
    var lines = linesInView(state.view);
    var el = document.getElementById("journal");
    document.getElementById("jr-count").textContent = lines.length + " lines · every document Dr = Cr";
    if (!lines.length) {
      el.innerHTML = '<tbody><tr><td class="muted">Pre-close view: no FBS1 or F.81 postings yet. Choose "After FBS1" to post the September close.</td></tr></tbody>';
      return;
    }
    var rows = ['<thead><tr><th>Doc</th><th>T-code</th><th>Date</th><th>PK</th><th>G/L</th><th>Account</th><th class="num">Debit ₹</th><th class="num">Credit ₹</th><th>Entry</th></tr></thead><tbody>'];
    lines.forEach(function (j) {
      rows.push("<tr><td class=\"mono\">" + j.Document + "</td><td class=\"mono\">" + j.TCode + "</td><td class=\"mono\">" + j.Posting_Date.split("-").reverse().join(".") +
        "</td><td class=\"mono\">" + j.Posting_Key + "</td><td class=\"mono\">" + j.GL_Account + "</td><td>" + esc(j.GL_Text) +
        '</td><td class="num">' + (j.Debit_INR ? inr(j.Debit_INR) : "") + '</td><td class="num">' + (j.Credit_INR ? inr(j.Credit_INR) : "") +
        "</td><td class=\"mono\">" + (j.Entry_ID === "TRUEUP" ? "True-up" : j.Entry_ID) + "</td></tr>");
    });
    rows.push("</tbody>");
    el.innerHTML = rows.join("");
  }

  // ---------- chart ----------
  var chart = null;
  function impactOf(e) {
    // profit effect of the FBS1 entry: credit to a P&L account raises profit, debit lowers it
    var v = 0;
    if (isPL(e.dr)) v -= e.amt;
    if (isPL(e.cr)) v += e.amt;
    return v;
  }
  function renderChart() {
    if (!window.Chart) {
      document.getElementById("impact-note").textContent = "Chart library could not load. The figures are in the P&L table above.";
      return;
    }
    var active = state.view === 1 || state.view === 0;
    var SHORT = { A1: "Power accrual", A2: "Audit fee", A3: "Loan interest", A4: "FD interest", D1: "Oct rent", D2: "Oct software" };
    var labels = D.entries.map(function (e) { return e.id + " " + (SHORT[e.id] || e.type); });
    var vals = D.entries.map(impactOf);
    var colors = D.entries.map(function (e, i) {
      if (!state.on[e.id]) return css("--rule-strong");
      return vals[i] >= 0 ? css("--debit") : css("--critical");
    });
    var ink2 = css("--ink-2"), grid = css("--rule");
    var totalOn = D.entries.reduce(function (s, e, i) { return s + (state.on[e.id] ? vals[i] : 0); }, 0);
    document.getElementById("impact-note").textContent =
      "Net effect of the switched-on entries: " + signed(totalOn) + " on September profit." +
      (active ? "" : " After F.81 these effects reverse into October, which is why YTD profit returns to its pre-close level.");
    var cfg = {
      type: "bar",
      data: { labels: labels, datasets: [{ data: vals, backgroundColor: colors, borderRadius: 4, borderSkipped: false, barThickness: 16 }] },
      options: {
        indexAxis: "y", responsive: true, maintainAspectRatio: false, animation: { duration: 250 },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: function (items) { var e = D.entries[items[0].dataIndex]; return e.id + " · " + e.type; },
              label: function (item) {
                var e = D.entries[item.dataIndex];
                return [e.text, "Dr " + e.dr + " / Cr " + e.cr + " · ₹" + inr(e.amt), "Profit effect " + signed(item.raw) + (state.on[e.id] ? "" : " (switched off)")];
              }
            }
          }
        },
        scales: {
          x: { grid: { color: grid }, border: { color: grid }, ticks: { color: ink2, callback: function (v) { return (v / 1000) + "k"; } } },
          y: { grid: { display: false }, border: { color: grid }, ticks: { color: ink2, font: { family: "Calibri", size: 11 } } }
        }
      }
    };
    if (chart) { chart.data = cfg.data; chart.options = cfg.options; chart.update(); }
    else { chart = new Chart(document.getElementById("impact"), cfg); }
  }

  // ---------- controls ----------
  var tg = document.getElementById("toggles");
  tg.innerHTML = D.entries.map(function (e) {
    return '<label class="tg" for="tg-' + e.id + '" title="' + esc(e.text + " · " + e.basis) + '"><input type="checkbox" id="tg-' + e.id + '" data-entry="' + e.id + '" checked>' +
      "<b>" + e.id + "</b> " + esc(e.type) + ' <span class="amt">₹' + inr(e.amt) + "</span></label>";
  }).join("");
  tg.addEventListener("change", function (ev) {
    var id = ev.target.getAttribute("data-entry");
    if (id) { state.on[id] = ev.target.checked; render(); }
  });
  document.getElementById("view-seg").addEventListener("click", function (ev) {
    var btn = ev.target.closest("button[data-view]");
    if (btn) { state.view = +btn.dataset.view; render(); }
  });
  document.getElementById("sim-trunc").addEventListener("change", function (ev) {
    state.truncated = ev.target.checked;
    base = roll(balances(0)); // a broken mapping affects the pre-close column too
    baseM = metrics(base);
    render();
  });
  document.querySelectorAll("#bs, #pl").forEach(function (t) {
    t.addEventListener("click", function (ev) {
      var btn = ev.target.closest(".exp-btn");
      if (btn) { state.open[btn.dataset.node] = !state.open[btn.dataset.node]; render(); }
    });
  });
  function rethemeChart() { if (chart) { chart.destroy(); chart = null; } renderChart(); }
  document.addEventListener("themechange", rethemeChart);
  if (window.matchMedia) {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    if (mq.addEventListener) mq.addEventListener("change", rethemeChart);
  }

  render();
})();

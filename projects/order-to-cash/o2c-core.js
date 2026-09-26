// IN10 order-to-cash simulator: runs one sales order item through the credit
// check (VA01), post goods issue (VL02N), billing (VF01) and the incoming
// payment (F-28) in a fixed order. Hard errors stop the flow; a credit block
// saves the order but holds it; a payment outside tolerance leaves a residual
// item. Pure function, shared by simulator.html and the build-time test (node).
(function (root) {
  "use strict";

  function fiscal(dateStr) {
    // FYV V3: April = period 01; the fiscal year is named after the April it starts in
    var y = +dateStr.slice(0, 4), m = +dateStr.slice(5, 7);
    return { year: m >= 4 ? y : y - 1, period: ((m - 4 + 12) % 12) + 1 };
  }
  var key = function (year, period) { return year * 100 + period; };
  var pad = function (n, w) { return String(n).padStart(w, "0"); };
  var fmtPer = function (y, p) { return y + "/" + pad(p, 2); };
  function inr(n) {
    var neg = n < 0, s = String(Math.abs(Math.round(n))), last3 = s.slice(-3), rest = s.slice(0, -3);
    return (neg ? "-" : "") + (rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," : "") + last3;
  }
  function addDays(dateStr, n) {
    var d = new Date(dateStr + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function daysBetween(a, b) { return Math.round((new Date(b + "T00:00:00Z") - new Date(a + "T00:00:00Z")) / 864e5); }
  var dmy = function (s) { return s.slice(8, 10) + "." + s.slice(5, 7) + "." + s.slice(0, 4); };

  function periodOpen(cfg, types, year, period) {
    var k = key(year, period);
    for (var i = 0; i < types.length; i++) {
      var iv = cfg.ob52[types[i]];
      if (!iv || k < key(iv.fromYear, iv.fromPer) || k > key(iv.toYear, iv.toPer)) return { ok: false, type: types[i] };
    }
    return { ok: true };
  }

  function line(pk, acct, text, dr, cr, note) {
    return { pk: pk, account: acct, text: text, dr: dr || 0, cr: cr || 0, note: note || "" };
  }

  function validate(cfg, p) {
    var checks = [];
    var out = { checks: checks, order: null, pgi: null, bill: null, pay: null, outcome: null, stopId: null };
    function add(stage, id, label, status, detail) { checks.push({ stage: stage, id: id, label: label, status: status, detail: detail }); }
    function stop(outcome, id) { out.outcome = outcome; out.stopId = id; return out; }
    var A = cfg.accounts, M = cfg.material, T = cfg.accountText;
    var cu = cfg.customers[p.customer];
    var custText = cu.name + " (recon " + A.recon + ")";

    // ---------- 1. Sales order (VA01): pricing and credit check ----------
    var gross = Math.round(p.qty * p.price);
    var k007 = Math.round(gross * p.discPct / 100);
    var net = gross - k007;
    var intra = cu.region === cfg.plantRegion;
    var taxes = intra
      ? [{ cond: "JOCG", key: "JOC", pct: cfg.gst.intra.JOCG, amt: Math.round(net * cfg.gst.intra.JOCG / 100) },
         { cond: "JOSG", key: "JOS", pct: cfg.gst.intra.JOSG, amt: Math.round(net * cfg.gst.intra.JOSG / 100) }]
      : [{ cond: "JOIG", key: "JOI", pct: cfg.gst.inter.JOIG, amt: Math.round(net * cfg.gst.inter.JOIG / 100) }];
    var tax = taxes.reduce(function (s, t) { return s + t.amt; }, 0);
    var inv = net + tax;
    var openAR = cu.openItems.reduce(function (s, o) { return s + o.amount; }, 0);
    var exposure = openAR + inv;
    var overdue = cu.openItems.reduce(function (m, o) { return Math.max(m, daysBetween(o.due, p.orderDate)); }, 0);
    out.order = { doc: pad(cfg.numbers.SO + 1, 10), gross: gross, k007: k007, net: net, taxes: taxes, tax: tax, inv: inv, intra: intra,
                  openAR: openAR, exposure: exposure, limit: cu.limit, overdue: overdue, blocked: false };

    add("so", "pricing", "Pricing (ZIN001)", "pass",
      "PR00 " + p.qty + " " + M.uom + " × ₹" + inr(p.price) + " = ₹" + inr(gross) + (k007 ? ", K007 −" + p.discPct + "% ₹" + inr(k007) : "") + ", net ₹" + inr(net) + ". " +
      (intra ? "Customer in " + cu.regionName + ", same state as plant IN11: CGST 9% + SGST 9%" : "Customer in " + cu.regionName + ", plant IN11 in Maharashtra: IGST 18%") +
      " = ₹" + inr(tax) + ". Order value ₹" + inr(inv) + ".");

    var overLimit = exposure > cu.limit, tooOld = overdue > cfg.credit.maxOverdueDays;
    if (overLimit || tooOld) {
      var why = [];
      if (overLimit) why.push("exposure ₹" + inr(openAR) + " open + ₹" + inr(inv) + " this order = ₹" + inr(exposure) + ", above the limit of ₹" + inr(cu.limit));
      if (tooOld) why.push("the oldest open item is " + overdue + " days overdue, above the " + cfg.credit.maxOverdueDays + "-day rule");
      if (!p.creditRelease) {
        out.order.blocked = true;
        add("so", "credit", "Credit check (segment " + cfg.credit.segment + ")", "warn",
          "Order " + out.order.doc + " is saved with a credit block: " + why.join("; and ") + ". No delivery can be created until credit management releases it in UKM_MY_DCDS.");
        return stop("blocked", "credit");
      }
      add("so", "credit", "Credit check (segment " + cfg.credit.segment + ")", "pass",
        "Blocked on save (" + why.join("; ") + "), then released in UKM_MY_DCDS by the credit manager.");
    } else {
      add("so", "credit", "Credit check (segment " + cfg.credit.segment + ")", "pass",
        "Exposure ₹" + inr(exposure) + " of ₹" + inr(cu.limit) + " (" + Math.round(exposure / cu.limit * 100) + "%)" +
        (overdue > 0 ? ", oldest item " + overdue + " days overdue (rule: " + cfg.credit.maxOverdueDays + ")" : ", nothing overdue") + ".");
    }

    // ---------- 2. Delivery and post goods issue (VL01N / VL02N, movement 601) ----------
    if (p.pgiDone) {
      var g = fiscal(p.pgiDate), mm = cfg.mmPeriod;
      var prev = mm.period === 1 ? { year: mm.year - 1, period: 12 } : { year: mm.year, period: mm.period - 1 };
      var inCur = g.year === mm.year && g.period === mm.period;
      var inPrev = mm.allowPrevious && g.year === prev.year && g.period === prev.period;
      if (!inCur && !inPrev) {
        add("pgi", "mmper", "MM period (OMSY / MMPV)", "fail",
          "Goods issue date " + dmy(p.pgiDate) + " falls in period " + fmtPer(g.year, g.period) + ". Materials Management only allows " +
          fmtPer(mm.year, mm.period) + (mm.allowPrevious ? " and " + fmtPer(prev.year, prev.period) : "") + ". The delivery is saved but goods issue can't be posted until MMPV moves the period.");
        return stop("error", "mmper");
      }
      add("pgi", "mmper", "MM period (OMSY / MMPV)", "pass", "Period " + fmtPer(g.year, g.period) + " is " + (inCur ? "the current" : "the previous") + " MM period.");

      var po = periodOpen(cfg, ["+", "M", "S"], g.year, g.period);
      if (!po.ok) {
        add("pgi", "ob52pgi", "FI posting period (OB52)", "fail", "Posting period " + pad(g.period, 3) + " " + g.year + " is not open for account type " + po.type + ".");
        return stop("error", "ob52pgi");
      }
      add("pgi", "ob52pgi", "FI posting period (OB52)", "pass", "Period " + pad(g.period, 3) + " " + g.year + " is open for account types +, M, S.");

      if (p.qty > p.stock) {
        add("pgi", "stock", "Unrestricted stock at plant IN11", "fail",
          "Goods issue needs " + p.qty + " " + M.uom + " but only " + p.stock + " " + M.uom + " is unrestricted in IN11. Negative stock isn't allowed, so PGI fails. Deliver " + p.stock + " " + M.uom + " now and the rest later, or wait for production.");
        return stop("error", "stock");
      }
      add("pgi", "stock", "Unrestricted stock at plant IN11", "pass", p.qty + " of " + p.stock + " " + M.uom + " available.");
      var cogs = Math.round(p.qty * M.stdPrice);
      out.pgi = { doc: pad(cfg.numbers.WL + 1, 10), matDoc: pad(cfg.numbers.matDoc + 1, 10), dlv: pad(cfg.numbers.DLV + 1, 10), period: g.period, cogs: cogs,
        lines: [line("81", A.GBB_VAX, T[A.GBB_VAX], cogs, 0, "GBB-VAX · " + p.qty + " " + M.uom + " × standard ₹" + inr(M.stdPrice)),
                line("99", A.BSX, T[A.BSX], 0, cogs, "BSX · valuation class " + M.valClass)] };
    } else {
      add("pgi", "nopgi", "Post goods issue (VL02N)", "skip", "Delivery " + pad(cfg.numbers.DLV + 1, 10) + " created, goods issue not posted.");
    }

    // ---------- 3. Billing (VF01, type F2 → accounting document RV) ----------
    var bilDoc = pad(cfg.numbers.BIL + 1, 10);
    if (!out.pgi) {
      add("bill", "pgi", "Goods issue status of the delivery", "fail",
        "Billing type F2 is delivery-related. Delivery " + pad(cfg.numbers.DLV + 1, 10) + " has no goods issue yet, so it doesn't appear in the billing due list (VF04) and VF01 has nothing to bill.");
      return stop("error", "pgi");
    }
    add("bill", "pgi", "Goods issue status of the delivery", "pass", "Goods issue " + out.pgi.matDoc + " posted, so the delivery is due for billing.");

    if (!p.acctGroup) {
      add("bill", "vkoa", "Revenue account determination (VKOA)", "fail",
        "Billing document " + bilDoc + " is saved, but no accounting document is created: material " + M.id + " has no account assignment group, so KOFI finds no G/L account for key ERL. Fix the material master and release the billing to accounting in VFX3.");
      return stop("error", "vkoa");
    }
    add("bill", "vkoa", "Revenue account determination (VKOA)", "pass",
      "KOFI: sales org IN10, customer group 01, material group " + p.acctGroup + ". ERL → " + A.ERL + ", ERS → " + A.ERS + ".");

    var b = fiscal(p.billDate);
    var pb = periodOpen(cfg, ["+", "D", "S"], b.year, b.period);
    if (!pb.ok) {
      add("bill", "ob52bill", "FI posting period (OB52)", "fail",
        "Billing document " + bilDoc + " is saved, but posting period " + pad(b.period, 3) + " " + b.year + " is not open for account type " + pb.type + ". Release it to accounting in VFX3 once the period is open.");
      return stop("error", "ob52bill");
    }
    add("bill", "ob52bill", "FI posting period (OB52)", "pass", "Period " + pad(b.period, 3) + " " + b.year + " is open for account types +, D, S.");

    var terms = cfg.terms;
    var billLines = [line("01", p.customer, custText, inv, 0, "Terms " + terms.key + " · " + terms.discPct + "% by " + dmy(addDays(p.billDate, terms.discDays)) + " · net " + dmy(addDays(p.billDate, terms.netDays))),
                     line("50", A.ERL, T[A.ERL], 0, gross, "ERL · PR00")];
    if (k007) billLines.push(line("40", A.ERS, T[A.ERS], k007, 0, "ERS · K007 " + p.discPct + "%"));
    taxes.forEach(function (t) { billLines.push(line("50", A.GST, T[A.GST], 0, t.amt, t.key + " · " + t.cond + " " + t.pct + "%")); });
    out.bill = { doc: pad(cfg.numbers.RV + 1, 10), bilDoc: bilDoc, period: b.period, lines: billLines, inv: inv,
                 discDate: addDays(p.billDate, terms.discDays), dueDate: addDays(p.billDate, terms.netDays) };

    // ---------- 4. Incoming payment (F-28) ----------
    var f = fiscal(p.payDate);
    var pp = periodOpen(cfg, ["+", "D", "S"], f.year, f.period);
    if (!pp.ok) {
      add("pay", "ob52pay", "FI posting period (OB52)", "fail", "Posting period " + pad(f.period, 3) + " " + f.year + " is not open for account type " + pp.type + ".");
      return stop("error", "ob52pay");
    }
    add("pay", "ob52pay", "FI posting period (OB52)", "pass", "Period " + pad(f.period, 3) + " " + f.year + " is open for account types +, D, S.");

    var u = cfg.users[p.poster];
    if (inv > u.perDocument || inv > u.perOpenItem) {
      var lim = inv > u.perDocument ? ["per-document", u.perDocument] : ["per-open-item", u.perOpenItem];
      add("pay", "oba4", "User tolerance (OBA4)", "fail",
        p.poster + " is in group " + u.group + ". Clearing ₹" + inr(inv) + " exceeds its " + lim[0] + " limit of ₹" + inr(lim[1]) + ". Receipts this size are posted by the finance manager (MGR01).");
      return stop("error", "oba4");
    }
    add("pay", "oba4", "User tolerance (OBA4)", "pass", p.poster + " (" + u.group + ") may post up to ₹" + inr(u.perDocument) + " per document and ₹" + inr(u.perOpenItem) + " per open item.");

    var discFull = Math.round(net * terms.discPct / 100);
    var dayNo = daysBetween(p.billDate, p.payDate);
    var inTerms = dayNo <= terms.discDays;
    var tds = p.tds ? Math.round(net * cfg.tds.rate / 100) : 0;
    var received = inv - (p.discTaken ? discFull : 0) - tds - p.shortPay;
    var disc = p.discTaken && inTerms ? discFull : 0;
    var diff = inv - disc - tds - received; // positive = customer paid short
    var PT = cfg.paymentTolerance;
    var tol = Math.min(PT.abs, Math.round(inv * PT.pct / 100));

    add("pay", "disc", "Cash discount (terms " + terms.key + ")", p.discTaken && !inTerms ? "warn" : "pass",
      !p.discTaken ? "Customer paid without deducting the discount." :
      inTerms ? "Paid on day " + dayNo + ", within " + terms.discDays + " days: " + terms.discPct + "% of the net value ₹" + inr(net) + " = ₹" + inr(discFull) + " (OBY6: discount base is net of tax)." :
      "Paid on day " + dayNo + ", after the " + terms.discDays + "-day discount period, but the customer still deducted ₹" + inr(discFull) + ". SAP allows no discount, so that amount is a shortfall.");

    var payLines = [line("40", A.bankIn, T[A.bankIn], received, 0, "HDFC1 / CUR01 · received " + dmy(p.payDate))];
    if (disc) payLines.push(line("40", A.SKT, T[A.SKT], disc, 0, "SKT · " + terms.discPct + "% of ₹" + inr(net)));
    if (tds) payLines.push(line("40", A.tdsRec, T[A.tdsRec], tds, 0, cfg.tds.section + " · " + cfg.tds.rate + "% of ₹" + inr(net) + " deducted by customer"));
    var result;
    if (Math.abs(diff) <= tol) {
      if (diff > 0) payLines.push(line("40", A.ZDI, T[A.ZDI], diff, 0, "ZDI · short payment written off"));
      if (diff < 0) payLines.push(line("50", A.ZDI, T[A.ZDI], 0, -diff, "ZDI · overpayment written off"));
      add("pay", "tol", "Payment difference (OBA3 group " + PT.group + ")", "pass",
        diff === 0 ? "Amount received matches the open item after discount and TDS." :
        "Difference ₹" + inr(Math.abs(diff)) + " is within ₹" + inr(tol) + " (₹" + inr(PT.abs) + " or " + PT.pct + "%, whichever is lower), so it is written off to " + A.ZDI + " automatically.");
      result = "cleared";
    } else {
      payLines.push(diff > 0 ? line("06", p.customer, custText, diff, 0, "Residual item · still owed by the customer") : line("16", p.customer, custText, 0, -diff, "Residual item · credit for the customer"));
      add("pay", "tol", "Payment difference (OBA3 group " + PT.group + ")", "warn",
        "Difference ₹" + inr(Math.abs(diff)) + " is above the ₹" + inr(tol) + " tolerance. The invoice is cleared and a residual item of ₹" + inr(Math.abs(diff)) +
        " is left open on the customer account for the AR team to follow up (dunning or a credit note decision).");
      result = "residual";
    }
    payLines.push(line("15", p.customer, custText, 0, inv, "Clears " + out.bill.doc));
    out.pay = { doc: pad(cfg.numbers.DZ + 1, 10), date: p.payDate, period: f.period, received: received, discount: disc, tds: tds, diff: diff,
                writeOff: result === "cleared" ? diff : null, residual: result === "residual" ? diff : null, lines: payLines };
    return stop(result, result);
  }

  var api = { validate: validate, fiscal: fiscal, inr: inr, addDays: addDays, daysBetween: daysBetween };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.IN10O2C = api;
})(this);

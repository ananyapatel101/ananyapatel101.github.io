// IN10 procure-to-pay simulator: runs one purchase order item through goods
// receipt (MIGO), invoice verification (MIRO) and the payment run (F110) in a
// fixed order. Hard errors stop the flow; tolerance breaches post the invoice
// with payment block R. Pure function, shared by simulator.html and the
// build-time test (node).
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
  var dmy = function (s) { return s.slice(8, 10) + "." + s.slice(5, 7) + "." + s.slice(0, 4); };
  var normRef = function (s) { return String(s || "").trim().toUpperCase(); };

  function periodOpen(cfg, types, year, period) {
    var k = key(year, period);
    for (var i = 0; i < types.length; i++) {
      var iv = cfg.ob52[types[i]];
      if (!iv || k < key(iv.fromYear, iv.fromPer) || k > key(iv.toYear, iv.toPer)) return { ok: false, type: types[i] };
    }
    return { ok: true };
  }

  function line(pk, acct, cfg, dr, cr, note) {
    return { pk: pk, account: acct, text: cfg.accountText[acct], dr: dr || 0, cr: cr || 0, note: note || "" };
  }

  function validate(cfg, p) {
    var checks = [];
    var out = { checks: checks, gr: null, ir: null, pay: null, grir: 0, outcome: null, stopId: null };
    function add(stage, id, label, status, detail) { checks.push({ stage: stage, id: id, label: label, status: status, detail: detail }); }
    function stop(outcome, id) { out.outcome = outcome; out.stopId = id; return out; }
    var A = cfg.accounts, M = cfg.material;

    // ---------- 1. Goods receipt (MIGO, movement type 101) ----------
    if (p.grQty > 0) {
      var g = fiscal(p.grDate), mm = cfg.mmPeriod;
      var prev = mm.period === 1 ? { year: mm.year - 1, period: 12 } : { year: mm.year, period: mm.period - 1 };
      var inCur = g.year === mm.year && g.period === mm.period;
      var inPrev = mm.allowPrevious && g.year === prev.year && g.period === prev.period;
      if (!inCur && !inPrev) {
        add("gr", "mmper", "MM period (OMSY / MMPV)", "fail",
          "GR date " + dmy(p.grDate) + " falls in period " + fmtPer(g.year, g.period) + ". Materials Management only allows postings in " +
          fmtPer(mm.year, mm.period) + (mm.allowPrevious ? " and " + fmtPer(prev.year, prev.period) : "") + ". Run MMPV to move the MM period first.");
        return stop("error", "mmper");
      }
      add("gr", "mmper", "MM period (OMSY / MMPV)", "pass", "Period " + fmtPer(g.year, g.period) + " is " + (inCur ? "the current" : "the previous") + " MM period.");

      var po = periodOpen(cfg, ["+", "M", "S"], g.year, g.period);
      if (!po.ok) {
        add("gr", "ob52gr", "FI posting period (OB52)", "fail", "Posting period " + pad(g.period, 3) + " " + g.year + " is not open for account type " + po.type + ".");
        return stop("error", "ob52gr");
      }
      add("gr", "ob52gr", "FI posting period (OB52)", "pass", "Period " + pad(g.period, 3) + " " + g.year + " is open for account types +, M, S.");

      var maxQty = p.poQty * (1 + cfg.overdeliveryPct / 100);
      if (p.grQty > maxQty + 1e-9) {
        add("gr", "overdel", "Over-delivery tolerance (PO item)", "fail",
          p.grQty + " " + M.uom + " received against " + p.poQty + " " + M.uom + " ordered. The " + cfg.overdeliveryPct + "% tolerance allows up to " + (+maxQty.toFixed(3)) + " " + M.uom + ".");
        return stop("error", "overdel");
      }
      add("gr", "overdel", "Over-delivery tolerance (PO item)", "pass", p.grQty + " of " + p.poQty + " " + M.uom + " received, within the " + cfg.overdeliveryPct + "% tolerance.");

      var grValue = Math.round(p.grQty * p.poPrice);
      var stockValue = p.priceControl === "S" ? Math.round(p.grQty * M.stdPrice) : grValue;
      var grLines = [line("89", A.BSX, cfg, stockValue, 0, "BSX · " + p.grQty + " " + M.uom + " × ₹" + inr(p.priceControl === "S" ? M.stdPrice : p.poPrice))];
      var grDiff = grValue - stockValue;
      if (grDiff > 0) grLines.push(line("83", A.PRD, cfg, grDiff, 0, "PRD · PO price above standard"));
      if (grDiff < 0) grLines.push(line("93", A.PRD, cfg, 0, -grDiff, "PRD · PO price below standard"));
      grLines.push(line("96", A.WRX, cfg, 0, grValue, "WRX · " + p.grQty + " " + M.uom + " × PO price ₹" + inr(p.poPrice)));
      out.gr = { doc: pad(cfg.numbers.WE + 1, 10), matDoc: pad(cfg.numbers.matDoc + 1, 10), year: g.year, period: g.period, value: grValue, lines: grLines };
    } else {
      add("gr", "nogr", "Goods receipt (MIGO 101)", "skip", "No goods receipt entered.");
    }

    // ---------- 2. Invoice verification (MIRO) ----------
    var f = fiscal(p.invDate);
    var pi = periodOpen(cfg, ["+", "K", "M", "S"], f.year, f.period);
    if (!pi.ok) {
      add("ir", "ob52ir", "FI posting period (OB52)", "fail", "Posting period " + pad(f.period, 3) + " " + f.year + " is not open for account type " + pi.type + ".");
      return stop("error", "ob52ir");
    }
    add("ir", "ob52ir", "FI posting period (OB52)", "pass", "Period " + pad(f.period, 3) + " " + f.year + " is open for account types +, K, M, S.");

    if (!out.gr) {
      add("ir", "grbiv", "GR-based invoice verification", "fail",
        "No goods receipt exists for PO " + cfg.po.id + " item " + cfg.po.item + ". With GR-based IV the invoice has nothing to match, so it can only be parked (MIR7) until the goods arrive.");
      return stop("error", "grbiv");
    }
    add("ir", "grbiv", "GR-based invoice verification", "pass", "Invoice matched to GR " + out.gr.matDoc + " (" + p.grQty + " " + M.uom + ").");

    var ref = normRef(p.invRef);
    var dup = cfg.postedInvoices.filter(function (x) { return x.vendor === cfg.vendor.id && normRef(x.ref) === ref; })[0];
    if (!ref) {
      add("ir", "dup", "Duplicate invoice check (OMRDC / OMRM)", "fail", "Enter the vendor's invoice number in Reference. It is required for the duplicate check.");
      return stop("error", "dup");
    }
    if (dup) {
      add("ir", "dup", "Duplicate invoice check (OMRDC / OMRM)", "fail",
        "Reference " + ref + " from vendor " + cfg.vendor.id + " was already posted as document " + dup.doc + " on " + dmy(dup.date) + ". IN10 sets this message to an error, not a warning.");
      return stop("error", "dup");
    }
    add("ir", "dup", "Duplicate invoice check (OMRDC / OMRM)", "pass", "Reference " + ref + " has not been posted before for vendor " + cfg.vendor.id + ".");

    var T = cfg.tolerance, blocks = [];
    var qtyVar = Math.round((p.invQty - p.grQty) * p.poPrice);
    if (qtyVar > T.DQ.upperAbs) {
      blocks.push("DQ");
      add("ir", "dq", "Quantity variance (OMR6 key DQ)", "warn",
        "Invoiced " + p.invQty + " " + M.uom + " but only " + p.grQty + " " + M.uom + " received. Variance ₹" + inr(qtyVar) + " is above the DQ limit of ₹" + inr(T.DQ.upperAbs) + ", so the invoice posts with payment block R.");
    } else {
      add("ir", "dq", "Quantity variance (OMR6 key DQ)", "pass", "Invoiced quantity " + p.invQty + " " + M.uom + " is covered by the goods receipt.");
    }

    var priceVar = Math.round((p.invPrice - p.poPrice) * p.invQty);
    var pct = (p.invPrice - p.poPrice) / p.poPrice * 100;
    var pctTxt = (pct >= 0 ? "+" : "") + pct.toFixed(2) + "%";
    var ppBreach = priceVar > 0 ? (priceVar > T.PP.upperAbs || pct > T.PP.upperPct) : priceVar < 0 ? (-priceVar > T.PP.lowerAbs || -pct > T.PP.lowerPct) : false;
    if (ppBreach) {
      blocks.push("PP");
      add("ir", "pp", "Price variance (OMR6 key PP)", "warn",
        "Invoice price ₹" + inr(p.invPrice) + " vs PO ₹" + inr(p.poPrice) + ": ₹" + inr(priceVar) + " (" + pctTxt + "). " +
        (priceVar > 0 ? "Upper limits are ₹" + inr(T.PP.upperAbs) + " or " + T.PP.upperPct + "%" : "Lower limits are ₹" + inr(T.PP.lowerAbs) + " or " + T.PP.lowerPct + "%") +
        ", whichever is reached first, so the invoice posts with payment block R.");
    } else {
      add("ir", "pp", "Price variance (OMR6 key PP)", "pass",
        priceVar === 0 ? "Invoice price equals the PO price." : "Variance ₹" + inr(priceVar) + " (" + pctTxt + ") is within ₹" + inr(T.PP.upperAbs) + " and " + T.PP.upperPct + "%.");
    }

    var invValue = Math.round(p.invQty * p.invPrice);
    var grirDebit = Math.round(p.invQty * p.poPrice);
    var cgst = Math.round(invValue * cfg.gst.cgst / 100), sgst = Math.round(invValue * cfg.gst.sgst / 100);
    var tds = p.tds ? Math.round(invValue * cfg.tds.rate / 100) : 0;
    var gross = invValue + cgst + sgst, net = gross - tds;
    var irLines = [line("86", A.WRX, cfg, grirDebit, 0, "WRX · clears GR/IR at PO price")];
    var diff = invValue - grirDebit;
    if (diff !== 0) {
      var diffAcct = p.priceControl === "S" ? A.PRD : A.BSX;
      var tag = p.priceControl === "S" ? "PRD · standard price stays fixed" : "BSX · moving average price absorbs it";
      irLines.push(diff > 0 ? line(p.priceControl === "S" ? "83" : "89", diffAcct, cfg, diff, 0, tag) : line(p.priceControl === "S" ? "93" : "99", diffAcct, cfg, 0, -diff, tag));
    }
    irLines.push(line("40", A.GST, cfg, cgst, 0, "Tax code " + cfg.gst.code + " · CGST " + cfg.gst.cgst + "%"));
    irLines.push(line("40", A.GST, cfg, sgst, 0, "Tax code " + cfg.gst.code + " · SGST " + cfg.gst.sgst + "%"));
    if (tds) irLines.push(line("50", A.TDS, cfg, 0, tds, "TDS " + cfg.tds.section + " · " + cfg.tds.rate + "% of ₹" + inr(invValue)));
    irLines.push(line("31", A.vendor, cfg, 0, net, "Ref " + ref + " · terms " + cfg.terms.key + (blocks.length ? " · block R" : "")));
    var due = addDays(p.invDate, cfg.terms.days);
    out.ir = {
      doc: pad(cfg.numbers.RE + 1, 10), year: f.year, period: f.period, lines: irLines, invValue: invValue, gst: cgst + sgst, tds: tds,
      gross: gross, net: net, blocked: blocks.length > 0, blocks: blocks, dueDate: due, priceVar: priceVar, qtyVar: qtyVar
    };
    out.grir = grirDebit - out.gr.value; // positive = debit balance (invoiced, not received)

    // ---------- 3. Payment run (F110) ----------
    var R = cfg.f110;
    if (out.ir.blocked && !p.mrbr) {
      add("pay", "block", "Payment block (MRBR)", "fail",
        "Invoice " + out.ir.doc + " carries payment block R (" + blocks.join(", ") + "). F110 lists it as an exception and does not pay it until it is released in MRBR.");
      return stop("blocked", "block");
    }
    add("pay", "block", "Payment block (MRBR)", "pass",
      out.ir.blocked ? "Block R (" + blocks.join(", ") + ") released in MRBR by the AP manager after checking with purchasing." : "No payment block.");

    if (!(due < R.nextRunDate)) {
      add("pay", "due", "Due date (terms " + cfg.terms.key + ")", "fail",
        "Due " + dmy(due) + ", which is not before the next run on " + dmy(R.nextRunDate) + ". F110 on " + dmy(R.runDate) + " leaves it for a later run.");
      return stop("notdue", "due");
    }
    add("pay", "due", "Due date (terms " + cfg.terms.key + ")", "pass",
      "Due " + dmy(due) + ", before the next run on " + dmy(R.nextRunDate) + ", so run " + R.id + " on " + dmy(R.runDate) + " pays it.");

    out.pay = {
      doc: pad(cfg.numbers.KZ + 1, 10), date: R.runDate, amount: net,
      lines: [line("25", A.vendor, cfg, net, 0, "Clears " + out.ir.doc), line("50", A.bankOut, cfg, 0, net, "Method " + R.method + " · " + R.houseBank + "/" + R.accountId)]
    };
    return stop("paid", "paid");
  }

  var api = { validate: validate, fiscal: fiscal, inr: inr, addDays: addDays };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.IN10P2P = api;
})(this);

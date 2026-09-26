// IN10 asset accounting simulator: runs one asset through the master data
// check (AS01 / AO90), acquisition into an asset under construction (F-90),
// settlement (AIBU), retirement (F-92 sale or ABAVN scrapping) and the
// month-end depreciation run (AFAB), in that order. Hard errors stop the flow;
// an AUC left unsettled at month-end is held, not depreciated.
// Pure function, shared by simulator.html and the build-time test (node).
(function (root) {
  "use strict";

  function fiscal(dateStr) {
    // FYV V3: April = period 01; the fiscal year is named after the April it starts in
    var y = +dateStr.slice(0, 4), m = +dateStr.slice(5, 7);
    return { year: m >= 4 ? y : y - 1, period: ((m - 4 + 12) % 12) + 1 };
  }
  var key = function (year, period) { return year * 100 + period; };
  var pad = function (n, w) { return String(n).padStart(w, "0"); };
  var month = function (dateStr) { return +dateStr.slice(0, 4) * 12 + (+dateStr.slice(5, 7)) - 1; };
  function inr(n) {
    var neg = n < 0, s = String(Math.abs(Math.round(n))), last3 = s.slice(-3), rest = s.slice(0, -3);
    return (neg ? "-" : "") + (rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," : "") + last3;
  }
  function daysBetween(a, b) { return Math.round((new Date(b + "T00:00:00Z") - new Date(a + "T00:00:00Z")) / 864e5); }
  var dmy = function (s) { return s.slice(8, 10) + "." + s.slice(5, 7) + "." + s.slice(0, 4); };
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var monthName = function (m) { return MONTHS[m % 12] + " " + Math.floor(m / 12); };

  function periodOpen(cfg, types, year, period) {
    var k = key(year, period);
    for (var i = 0; i < types.length; i++) {
      var iv = cfg.ob52[types[i]];
      if (!iv || k < key(iv.fromYear, iv.fromPer) || k > key(iv.toYear, iv.toPer)) return { ok: false, type: types[i] };
    }
    return { ok: true };
  }

  // Area 01 book depreciation, straight line, period control 01 (pro rata at period start date):
  // the capitalisation month counts in full. Life 0 = low-value asset, 100% in year one.
  function bookDepTo(asset, lastMonth) {
    var start = month(asset.capDate);
    if (lastMonth < start) return 0;
    if (!asset.life) return asset.cost;
    var n = Math.min(lastMonth - start + 1, asset.life);
    return asset.cost / asset.life * n;
  }

  // Area 15, Income Tax Act: 15% WDV; half rate in the year of acquisition if used for fewer than 180 days
  function taxDaysFirstYear(capDate) {
    var fy = fiscal(capDate).year;
    return daysBetween(capDate, (fy + 1) + "-03-31") + 1;
  }
  function taxDepForYear(cfg, asset, fy) {
    var fy0 = fiscal(asset.capDate).year, wdv = asset.cost, rate = cfg.taxRate / 100;
    if (fy0 > fy) return 0;
    var half = taxDaysFirstYear(asset.capDate) < 180;
    for (var y = fy0; y < fy; y++) wdv -= Math.round(wdv * rate * (y === fy0 && half ? 0.5 : 1));
    return Math.round(wdv * rate * (fy0 === fy && half ? 0.5 : 1));
  }

  function line(pk, acct, text, dr, cr, note) {
    return { pk: pk, account: acct, text: text, dr: dr || 0, cr: cr || 0, note: note || "" };
  }

  function validate(cfg, p) {
    var checks = [];
    var out = { checks: checks, asset: null, acq: null, cap: null, ret: null, afab: null, outcome: null, stopId: null, taxDepFY: null, nbvEnd: null };
    function add(stage, id, label, status, detail) { checks.push({ stage: stage, id: id, label: label, status: status, detail: detail }); }
    function stop(outcome, id) { out.outcome = outcome; out.stopId = id; return out; }
    var T = cfg.accountText, N = cfg.newAsset, nums = {};
    Object.keys(cfg.numbers).forEach(function (k) { nums[k] = cfg.numbers[k]; });
    function next(k) { nums[k] += 1; return pad(nums[k], 10); }
    var postedTo = month(cfg.postedThrough + "-01");
    var isNew = p.asset === N.id;

    // ---------- 1. Asset master (AS01) and account determination (AO90) ----------
    var asset, cls;
    if (isNew) {
      cls = cfg.classes[p.cls];
      var det = cfg.acctDet[cls.acctDet];
      if (!det) {
        add("master", "acctdet", "Account determination (AO90)", "fail",
          "Asset class " + p.cls + " (" + cls.text + ") points to account determination " + cls.acctDet + ", which has no G/L accounts in AO90 for chart of accounts INCA. AS01 can create the master record, but the first posting has no balance sheet account to go to. Maintain AO90 first, or use class 1100.");
        return stop("error", "acctdet");
      }
      asset = { id: N.id, cls: p.cls, text: N.text, capDate: p.capDate, cost: p.machine + p.install, life: N.life, det: det };
      add("master", "acctdet", "Account determination (AO90)", "pass",
        "AUC " + N.auc + " in class 4000 → APC " + cfg.acctDet["40000"].apc + ". Final asset " + N.id + " in class " + p.cls + " → APC " + det.apc + ", acc. depreciation " + det.accDep + ", expense " + det.depExp + ". Area 01 key " + cls.key01 + ", " + N.life / 12 + " years.");
    } else {
      var a = cfg.assets[p.asset];
      cls = cfg.classes[a.cls];
      asset = { id: a.id, cls: a.cls, text: a.text, capDate: a.capDate, cost: a.cost, life: a.life, det: cfg.acctDet[cls.acctDet] };
      var acc0 = bookDepTo(asset, postedTo);
      add("master", "acctdet", "Account determination (AO90)", "pass",
        "Asset " + a.id + " (" + cls.text + "), capitalised " + dmy(a.capDate) + ". APC ₹" + inr(a.cost) + ", depreciation posted to 30.09.2026 ₹" + inr(acc0) + ", NBV ₹" + inr(a.cost - acc0) + ". Accounts " + asset.det.apc + " / " + asset.det.accDep + ".");
    }
    out.asset = asset;

    // ---------- 2. Acquisition into the AUC (F-90, integrated with AP) ----------
    if (isNew) {
      var auc = cfg.acctDet["40000"].apc;
      var vm = cfg.vendors[N.vendorMachine], vi = cfg.vendors[N.vendorInstall];
      var igst = Math.round(p.machine * cfg.gst / 100), half = Math.round(p.install * cfg.gst / 200);
      var mGross = p.machine + igst, iGross = p.install + 2 * half, tds = Math.round(p.install * cfg.tds194C / 100);
      var dates = [p.invDate, p.instDate];
      for (var i = 0; i < dates.length; i++) {
        var f = fiscal(dates[i]), po = periodOpen(cfg, ["+", "A", "K", "S"], f.year, f.period);
        if (!po.ok) {
          add("acq", "ob52acq", "FI posting period (OB52)", "fail",
            "The " + (i ? "installation" : "machine") + " invoice is dated " + dmy(dates[i]) + ", period " + pad(f.period, 3) + " " + f.year + ", which is not open for account type " + po.type + ". Only 006–007/2026 are open.");
          return stop("error", "ob52acq");
        }
      }
      add("acq", "ob52acq", "FI posting period (OB52)", "pass", "Both invoices fall in an open period for account types +, A, K, S.");
      var u = cfg.users[p.poster];
      var over = mGross > u.perDocument ? ["machine invoice", mGross, "per-document", u.perDocument] :
                 mGross > u.perOpenItem ? ["machine invoice", mGross, "per-open-item", u.perOpenItem] :
                 iGross > u.perDocument ? ["installation invoice", iGross, "per-document", u.perDocument] :
                 iGross - tds > u.perOpenItem ? ["installation invoice", iGross - tds, "per-open-item", u.perOpenItem] : null;
      if (over) {
        add("acq", "oba4", "User tolerance (OBA4)", "fail",
          p.poster + " is in group " + u.group + ". The " + over[0] + " of ₹" + inr(over[1]) + " exceeds its " + over[2] + " limit of ₹" + inr(over[3]) + ". Capital purchases this size are posted by the finance manager (MGR01).");
        return stop("error", "oba4");
      }
      add("acq", "oba4", "User tolerance (OBA4)", "pass", p.poster + " (" + u.group + ") may post up to ₹" + inr(u.perDocument) + " per document and ₹" + inr(u.perOpenItem) + " per open item.");
      var kr1 = next("KR"), kr2 = next("KR");
      out.acq = {
        docs: [
          { doc: kr1, type: "KR", tcode: "F-90", date: p.invDate, lines: [
            line("31", N.vendorMachine, vm.name + " (recon 211000)", 0, mGross, vm.regionName + " → IGST, no TDS (IN10 is below the 194Q turnover test)"),
            line("70", N.auc, "AUC " + N.text + " (APC " + auc + ")", p.machine, 0, "Transaction type 100 · external acquisition"),
            line("40", "161000", T["161000"] + " - IGST " + cfg.gst + "%", igst, 0, "Capital goods: full credit in the month of receipt")] },
          { doc: kr2, type: "KR", tcode: "F-90", date: p.instDate, lines: [
            line("31", N.vendorInstall, vi.name + " (recon 211000)", 0, iGross - tds, "Net of TDS"),
            line("70", N.auc, "AUC " + N.text + " (APC " + auc + ")", p.install, 0, "Installation & commissioning, directly attributable cost"),
            line("40", "161000", T["161000"] + " - CGST " + cfg.gst / 2 + "%", half, 0),
            line("40", "161000", T["161000"] + " - SGST " + cfg.gst / 2 + "%", half, 0),
            line("50", "222000", T["222000"] + " - 194C " + cfg.tds194C + "%", 0, tds, "On the value before GST")] }
        ], aucValue: p.machine + p.install };
      add("acq", "aucpost", "Posted to asset under construction", "pass",
        "Machine ₹" + inr(p.machine) + " (" + kr1 + ") and installation ₹" + inr(p.install) + " (" + kr2 + ") collect on AUC " + N.auc + ": ₹" + inr(p.machine + p.install) + " in " + auc + ". GST goes to input credit, not to the asset.");

      // ---------- 3. Settlement AUC → final asset (AIBU) ----------
      if (!p.settle) {
        add("cap", "settle", "AUC settlement (AIBU)", "warn",
          "Installation isn't finished, so AUC " + N.auc + " stays open with ₹" + inr(p.machine + p.install) + " in capital work-in-progress. Depreciation key 0000: nothing is depreciated until the machine is ready for use and settled.");
      } else {
        var c = fiscal(p.capDate), pc = periodOpen(cfg, ["+", "A", "S"], c.year, c.period);
        if (!pc.ok) {
          add("cap", "ob52cap", "FI posting period (OB52)", "fail", "Settlement date " + dmy(p.capDate) + " is in period " + pad(c.period, 3) + " " + c.year + ", not open for account type " + pc.type + ".");
          return stop("error", "ob52cap");
        }
        add("cap", "ob52cap", "FI posting period (OB52)", "pass", "Period " + pad(c.period, 3) + " " + c.year + " is open for account types +, A, S.");
        var lastInv = p.invDate > p.instDate ? p.invDate : p.instDate;
        if (p.capDate < lastInv) {
          add("cap", "capdate", "AUC settlement (AIBU)", "fail",
            "Settlement is dated " + dmy(p.capDate) + ", but the AUC's last acquisition is dated " + dmy(lastInv) + ". On the settlement date the AUC didn't hold the full ₹" + inr(p.machine + p.install) + " yet, so the transfer can't be posted. Settle on or after " + dmy(lastInv) + ".");
          return stop("error", "capdate");
        }
        var aibu = next("AA");
        out.cap = { doc: aibu, date: p.capDate, value: p.machine + p.install, lines: [
          line("70", N.id, N.text + " (APC " + asset.det.apc + ")", p.machine + p.install, 0, "Capitalisation date " + dmy(p.capDate) + " · depreciation starts " + monthName(month(p.capDate))),
          line("75", N.auc, "AUC " + N.text + " (APC " + auc + ")", 0, p.machine + p.install, "Settled in full")] };
        add("cap", "capdate", "AUC settlement (AIBU)", "pass",
          "Machine ready for use on " + dmy(p.capDate) + ". AUC " + N.auc + " settled to " + N.id + ": ₹" + inr(p.machine + p.install) + " moves from " + auc + " to " + asset.det.apc + ".");
      }
    } else {
      add("acq", "existing", "Acquisition", "skip", "Existing asset, capitalised " + dmy(asset.capDate) + ".");
    }

    // ---------- 4. Retirement: sale to a customer (F-92) or scrapping (ABAVN) ----------
    var retired = false, retMonth = null;
    if (p.ret !== "none") {
      if (isNew && !p.settle) {
        add("ret", "novalue", "Asset values on the value date", "fail", "Asset " + N.id + " has no capitalised value; the cost still sits on AUC " + N.auc + ". Settle the AUC before retiring.");
        return stop("error", "novalue");
      }
      var rv = fiscal(p.retValue);
      if (rv.year !== cfg.aaYear.open) {
        add("ret", "ajab", "Asset fiscal year (AJRW / AJAB)", "fail",
          "Asset value date " + dmy(p.retValue) + " falls in fiscal year " + rv.year + ". " +
          (rv.year <= cfg.aaYear.closed ? "Asset Accounting closed that year with AJAB after the audit, so no asset values can change in it. Post with a value date in " + cfg.aaYear.open + "." : "That year hasn't been opened with AJRW yet."));
        return stop("error", "ajab");
      }
      add("ret", "ajab", "Asset fiscal year (AJRW / AJAB)", "pass", "Value date in fiscal year " + cfg.aaYear.open + ", which is open; " + cfg.aaYear.closed + " is closed.");
      var rp = fiscal(p.retPost), pr = periodOpen(cfg, ["+", "A", "S"], rp.year, rp.period);
      if (!pr.ok) {
        add("ret", "ob52ret", "FI posting period (OB52)", "fail", "Posting date " + dmy(p.retPost) + " is in period " + pad(rp.period, 3) + " " + rp.year + ", not open for account type " + pr.type + ".");
        return stop("error", "ob52ret");
      }
      add("ret", "ob52ret", "FI posting period (OB52)", "pass", "Period " + pad(rp.period, 3) + " " + rp.year + " is open.");
      if (p.retValue < asset.capDate) {
        add("ret", "retdate", "Value date vs capitalisation date", "fail",
          "Value date " + dmy(p.retValue) + " is before the capitalisation date " + dmy(asset.capDate) + ". On that date the asset had no value to retire.");
        return stop("error", "retdate");
      }
      add("ret", "retdate", "Value date vs capitalisation date", "pass", "Retired on " + dmy(p.retValue) + ", after capitalisation on " + dmy(asset.capDate) + ".");
      retMonth = month(p.retValue);
      var accR = bookDepTo(asset, retMonth - 1), nbv = asset.cost - accR, det2 = asset.det;
      var dep0 = det2.accDep;
      if (p.ret === "sale") {
        var b = cfg.buyer, gh = Math.round(p.saleValue * cfg.gst / 200), gross = p.saleValue + 2 * gh;
        var u2 = cfg.users[p.poster];
        if (gross > u2.perDocument || gross > u2.perOpenItem) {
          var lim = gross > u2.perDocument ? ["per-document", u2.perDocument] : ["per-open-item", u2.perOpenItem];
          add("ret", "oba4ret", "User tolerance (OBA4)", "fail", p.poster + " (" + u2.group + "): the customer item of ₹" + inr(gross) + " exceeds the " + lim[0] + " limit of ₹" + inr(lim[1]) + ".");
          return stop("error", "oba4ret");
        }
        add("ret", "oba4ret", "User tolerance (OBA4)", "pass", p.poster + " may post the ₹" + inr(gross) + " customer item.");
        var gl = p.saleValue - nbv;
        var lines = [
          line("01", b.id, b.name + " (recon 141000)", gross, 0, "Buyer in " + b.regionName + ": CGST + SGST"),
          line("50", "221000", T["221000"] + " - CGST " + cfg.gst / 2 + "%", 0, gh, "Sec. 18(6): tax on the sale value"),
          line("50", "221000", T["221000"] + " - SGST " + cfg.gst / 2 + "%", 0, gh),
          line("50", det2.clearing, T[det2.clearing], 0, p.saleValue, "Sale value · asset " + asset.id + " · trans. type 210"),
          line("40", det2.clearing, T[det2.clearing], p.saleValue, 0, "Cleared by the system"),
          line("75", asset.id, asset.text + ": APC retired (" + det2.apc + ")", 0, asset.cost),
          line("70", asset.id, asset.text + ": acc. depreciation retired (" + dep0 + ")", accR, 0, "Depreciation to " + monthName(retMonth - 1) + "; none in the retirement month")];
        if (gl > 0) lines.push(line("50", det2.gain, T[det2.gain], 0, gl, "Sale ₹" + inr(p.saleValue) + " − NBV ₹" + inr(nbv)));
        if (gl < 0) lines.push(line("40", det2.loss, T[det2.loss], -gl, 0, "NBV ₹" + inr(nbv) + " − sale ₹" + inr(p.saleValue)));
        out.ret = { type: "sale", doc: next("DR"), docType: "DR", tcode: "F-92", date: p.retPost, nbv: nbv, accDep: accR, gainLoss: gl, lines: lines };
        add("ret", "result", "Retirement posted (F-92)", "pass",
          "NBV on " + dmy(p.retValue) + ": ₹" + inr(asset.cost) + " − ₹" + inr(accR) + " = ₹" + inr(nbv) + ". Sold for ₹" + inr(p.saleValue) + ": " + (gl >= 0 ? "profit ₹" + inr(gl) + " to " + det2.gain : "loss ₹" + inr(-gl) + " to " + det2.loss) + ". Output GST ₹" + inr(2 * gh) + ".");
      } else {
        out.ret = { type: "scrap", doc: next("AA"), docType: "AA", tcode: "ABAVN", date: p.retPost, nbv: nbv, accDep: accR, gainLoss: -nbv, lines: [
          line("75", asset.id, asset.text + ": APC retired (" + det2.apc + ")", 0, asset.cost, "Trans. type 200 · retirement without revenue"),
          line("70", asset.id, asset.text + ": acc. depreciation retired (" + dep0 + ")", accR, 0, "Depreciation to " + monthName(retMonth - 1)),
          line("40", det2.scrap, T[det2.scrap], nbv, 0, "Remaining NBV written off")] };
        add("ret", "result", "Scrapping posted (ABAVN)", "pass",
          "NBV on " + dmy(p.retValue) + ": ₹" + inr(asset.cost) + " − ₹" + inr(accR) + " = ₹" + inr(nbv) + ", written off to " + det2.scrap + " as a loss.");
      }
      retired = true;
    } else {
      add("ret", "noret", "Retirement", "skip", "No retirement this month.");
    }

    // ---------- 5. Depreciation run (AFAB) ----------
    var afMonth = month("2026-" + pad(p.afabPer + 3, 2) + "-01");
    var pa = periodOpen(cfg, ["+", "A", "S"], 2026, p.afabPer);
    if (!pa.ok) {
      add("afab", "ob52afab", "FI posting period (OB52)", "fail",
        "AFAB for period " + pad(p.afabPer, 3) + "/2026 needs that period open for account type " + pa.type + ". OB52 is open only to 007, so the run can't post. Open the period at the next month-end, then run AFAB.");
      return stop("error", "ob52afab");
    }
    add("afab", "ob52afab", "FI posting period (OB52)", "pass", "Period " + pad(p.afabPer, 3) + "/2026 is open for account types +, A, S.");
    var last = retired ? Math.min(afMonth, retMonth - 1) : afMonth;
    var held = isNew && !p.settle;
    var dep = held ? 0 : Math.max(0, Math.round(bookDepTo(asset, last) - bookDepTo(asset, postedTo)));
    var afLines = dep ? [line("40", asset.det.depExp, T[asset.det.depExp], dep, 0, "Asset " + asset.id),
                         line("50", asset.det.accDep, T[asset.det.accDep], 0, dep, "Asset " + asset.id)] : [];
    out.afab = { doc: next("AF"), period: p.afabPer, dep: dep, lines: afLines };
    add("afab", "run", "Planned depreciation, area 01", held ? "warn" : "pass",
      held ? "AUC " + N.auc + " has key 0000, so AFAB posts nothing for it. The ₹" + inr(p.machine + p.install) + " stays in capital work-in-progress until it is settled." :
      retired ? "Retired in " + monthName(retMonth) + ", so there is no depreciation for that period (period control 01). This asset's share of run " + out.afab.doc + ": ₹" + inr(dep) + "." :
      !asset.life ? "Low-value asset: written off in full in its first year, nothing left to depreciate." :
      "₹" + inr(asset.cost) + " ÷ " + asset.life + " months = ₹" + inr(asset.cost / asset.life) + " a month from " + monthName(Math.max(month(asset.capDate), postedTo + 1)) + ". This asset's share of run " + out.afab.doc + ": ₹" + inr(dep) + ".");

    out.nbvEnd = retired || held ? 0 : asset.cost - Math.round(bookDepTo(asset, last));
    out.taxDepFY = retired || held ? 0 : taxDepForYear(cfg, asset, 2026);
    out.taxDays = held ? null : taxDaysFirstYear(asset.capDate);
    if (held) return stop("held", "auc");
    return stop("posted", "posted");
  }

  var api = { validate: validate, fiscal: fiscal, inr: inr, bookDepTo: bookDepTo, taxDepForYear: taxDepForYear, taxDaysFirstYear: taxDaysFirstYear };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.IN10AA = api;
})(this);

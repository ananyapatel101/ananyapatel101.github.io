// IN10 posting simulator: runs a two-line document through the company code's
// configuration in a fixed order and stops at the first failing check.
// Pure function, shared by validator.html and the build-time test (node).
(function (root) {
  "use strict";

  function fiscal(dateStr) {
    // FYV V3: April = period 01; the fiscal year is named after the April it starts in
    var y = +dateStr.slice(0, 4), m = +dateStr.slice(5, 7);
    return { year: m >= 4 ? y : y - 1, period: ((m - 4 + 12) % 12) + 1 };
  }
  var key = function (year, period) { return year * 100 + period; };
  var pad = function (n, w) { return String(n).padStart(w, "0"); };
  function inr(n) {
    var s = String(Math.round(n)), last3 = s.slice(-3), rest = s.slice(0, -3);
    return (rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," : "") + last3;
  }

  function inInterval(iv, year, period) {
    if (!iv) return false;
    var k = key(year, period);
    return k >= key(iv.fromYear, iv.fromPer) && k <= key(iv.toYear, iv.toPer);
  }

  function periodOpen(cfg, acctType, year, period, user) {
    var row = cfg.ob52[acctType];
    if (!row) return { ok: false, why: "no OB52 entry" };
    if (inInterval(row.int1, year, period)) {
      if (row.int1.authGroup && user.authGroup !== row.int1.authGroup) {
        return { ok: false, why: "auth", group: row.int1.authGroup };
      }
      return { ok: true };
    }
    if (inInterval(row.int2, year, period)) return { ok: true };
    return { ok: false, why: "closed" };
  }

  function validate(cfg, p) {
    var checks = [];
    function add(id, label, ok, detail) { checks.push({ id: id, label: label, ok: ok, detail: detail }); return ok; }
    function result(posted, extra) { return Object.assign({ posted: posted, checks: checks }, extra || {}); }

    var user = cfg.users[p.user];
    var dt = cfg.docTypes[p.docType];
    var dr = cfg.accounts[p.drAccount], cr = cfg.accounts[p.crAccount];
    var f = fiscal(p.postingDate);
    var per = f.period;

    // 1. Fiscal year variant
    if (p.specialPeriod) {
      if (f.period !== 12) {
        add("fyv", "Fiscal year & period (V3)", false,
          "Special period " + p.specialPeriod + " can only be used with a posting date in period 12 (March).");
        return result(false);
      }
      per = +p.specialPeriod;
    }
    add("fyv", "Fiscal year & period (V3)", true,
      "Posting date " + p.postingDate + " → fiscal year " + f.year + ", period " + pad(per, 3) + ".");

    // 2. Posting periods (OB52): "+" plus every account type on the document
    var types = ["+"].concat([dr.type, cr.type].filter(function (t, i, a) { return a.indexOf(t) === i; }));
    for (var i = 0; i < types.length; i++) {
      var po = periodOpen(cfg, types[i], f.year, per, user);
      if (!po.ok) {
        var msg = po.why === "auth"
          ? "Period " + pad(per, 3) + " " + f.year + " is restricted to authorization group " + po.group + ". User " + p.user + " is not in it."
          : "Posting period " + pad(per, 3) + " " + f.year + " is not open (account type " + types[i] + ").";
        add("ob52", "Posting period open (OB52)", false, msg);
        return result(false);
      }
    }
    add("ob52", "Posting period open (OB52)", true, "Period " + pad(per, 3) + " " + f.year + " is open for account types " + types.join(", ") + ".");

    // 3. Document type (OBA7)
    var bad = [dr, cr].filter(function (a) { return dt.allowed.indexOf(a.type) < 0; });
    if (bad.length) {
      add("oba7", "Document type allows account types (OBA7)", false,
        "Account type " + bad[0].type + " is not allowed for document type " + p.docType + " (allowed: " + dt.allowed.join(", ") + ").");
      return result(false);
    }
    add("oba7", "Document type allows account types (OBA7)", true, p.docType + " (" + dt.text + ") allows " + dt.allowed.join(", ") + ".");

    // 4. Number range (FBN1)
    var nr = cfg.numberRanges[dt.range + "/" + f.year];
    if (!nr) {
      add("fbn1", "Number range (FBN1)", false, "Number range " + dt.range + " is not defined for fiscal year " + f.year + " in company code IN10.");
      return result(false);
    }
    var next = nr.current + 1;
    add("fbn1", "Number range (FBN1)", true, "Range " + dt.range + " / " + f.year + " → next number " + pad(next, 10) + ".");

    // 5. Field status (OBC4): cost center
    var lines = [dr, cr];
    for (var j = 0; j < lines.length; j++) {
      var fsg = cfg.fieldStatus[lines[j].fsg];
      var cc = j === 0 ? p.drCostCenter : p.crCostCenter;
      if (fsg.costCenter === "required" && !cc) {
        add("obc4", "Field status (OBC4)", false,
          "Enter a cost center for account " + lines[j].id + ". Field status group " + lines[j].fsg + " makes it required.");
        return result(false);
      }
      if (fsg.costCenter === "suppressed" && cc) {
        add("obc4", "Field status (OBC4)", false,
          "Cost center is suppressed for account " + lines[j].id + " (field status group " + lines[j].fsg + "). Remove it.");
        return result(false);
      }
    }
    add("obc4", "Field status (OBC4)", true, "Cost center rules met for " + dr.fsg + " and " + cr.fsg + ".");

    // 6. Currency (OB08)
    var rate = 1;
    if (p.currency !== "INR") {
      var rates = (cfg.rates[p.currency] || []).filter(function (r) { return r.validFrom <= p.postingDate; });
      if (!rates.length) {
        add("ob08", "Exchange rate (OB08)", false, "No exchange rate type M for " + p.currency + " → INR on " + p.postingDate + ".");
        return result(false);
      }
      rate = rates[rates.length - 1].rate;
    }
    var local = Math.round(p.amount * rate);
    add("ob08", "Exchange rate (OB08)", true, p.currency === "INR" ? "Document currency is INR, no translation." :
      "1 " + p.currency + " = " + rate + " INR → ₹" + inr(local) + ".");

    // 7. Tolerance group (OBA4 / OB57)
    var tg = cfg.tolerance[user.group];
    if (local > tg.perDocument) {
      add("oba4", "Tolerance group (OBA4)", false,
        "₹" + inr(local) + " exceeds the per-document limit of ₹" + inr(tg.perDocument) + " for tolerance group " + (user.group || "(blank)") + ".");
      return result(false);
    }
    var hasOpenItem = lines.some(function (a) { return a.type === "D" || a.type === "K"; });
    if (hasOpenItem && local > tg.perOpenItem) {
      add("oba4", "Tolerance group (OBA4)", false,
        "₹" + inr(local) + " exceeds the per-open-item limit of ₹" + inr(tg.perOpenItem) + " for customer/vendor lines in group " + (user.group || "(blank)") + ".");
      return result(false);
    }
    add("oba4", "Tolerance group (OBA4)", true, "Within " + (user.group || "(blank)") + " limits.");

    return result(true, { document: pad(next, 10), year: f.year, period: per, local: local });
  }

  var api = { validate: validate, fiscal: fiscal };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.IN10Validator = api;
})(this);

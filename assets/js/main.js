// Theme toggle (remembers the choice per browser) and copy-to-clipboard buttons.
(function () {
  var root = document.documentElement;
  var KEY = "ap-theme";

  function saved() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function store(v) {
    try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch (e) {}
  }
  function isDark() {
    var t = root.getAttribute("data-theme");
    if (t) return t === "dark";
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  function label(btn) { btn.textContent = isDark() ? "Light mode" : "Dark mode"; }

  root.setAttribute("data-theme", "light");
  root.classList.add("js");

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
      label(btn);
      btn.addEventListener("click", function () {
        var next = isDark() ? "light" : "dark";
        root.setAttribute("data-theme", next);
        store(next);
        document.querySelectorAll("[data-theme-toggle]").forEach(label);
        document.dispatchEvent(new CustomEvent("themechange"));
      });
    });

    document.querySelectorAll("[data-copy]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var text = btn.getAttribute("data-copy");
        var done = function () { btn.textContent = "Copied"; setTimeout(function () { btn.textContent = "Copy"; }, 1600); };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done, function () { selectText(btn); });
        } else { selectText(btn); }
      });
    });

    // Fade sections in as they scroll into view.
    var reveal = document.querySelectorAll("main > section:not(.hero):not(.cs-hero) > .wrap, .cs-section");
    if ("IntersectionObserver" in window && !(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
      }, { rootMargin: "0px 0px -8% 0px" });
      reveal.forEach(function (n) { n.classList.add("reveal"); io.observe(n); });
    }

    var y = document.querySelector("[data-year]");
    if (y) y.textContent = new Date().getFullYear();
  });

  function selectText(btn) {
    var target = btn.parentElement.querySelector(".value");
    if (!target) return;
    var r = document.createRange();
    r.selectNodeContents(target);
    var s = window.getSelection();
    s.removeAllRanges();
    s.addRange(r);
    btn.textContent = "Press Ctrl+C";
  }
})();

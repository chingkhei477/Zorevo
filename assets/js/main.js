/* Zorevo — site script (no dependencies) */
(function () {
  "use strict";

  var CONSENT_KEY = "zorevo_cookie_consent";

  function store(action, key, value) {
    try {
      if (action === "get") return window.localStorage.getItem(key);
      window.localStorage.setItem(key, value);
    } catch (e) { /* storage unavailable: fall back to session-only behaviour */ }
    return null;
  }

  /* Mobile navigation */
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("site-nav");
  if (toggle && nav) {
    var setOpen = function (open) {
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      nav.classList.toggle("is-open", open);
    };
    toggle.addEventListener("click", function () {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("is-open")) { setOpen(false); toggle.focus(); }
    });
    document.addEventListener("click", function (e) {
      if (nav.classList.contains("is-open") && !nav.contains(e.target) && !toggle.contains(e.target)) setOpen(false);
    });
    window.addEventListener("resize", function () { if (window.innerWidth > 880) setOpen(false); });
  }

  /* Current year */
  var years = document.querySelectorAll("[data-year]");
  for (var y = 0; y < years.length; y++) years[y].textContent = String(new Date().getFullYear());

  /* Offer category filter */
  var chips = document.querySelectorAll("[data-filter]");
  var cards = document.querySelectorAll("[data-category]");
  var countEl = document.getElementById("category-count");
  if (chips.length && cards.length) {
    var applyFilter = function (value) {
      var shown = 0;
      for (var i = 0; i < cards.length; i++) {
        var match = value === "all" || cards[i].getAttribute("data-category") === value;
        cards[i].hidden = !match;
        if (match) shown++;
      }
      for (var j = 0; j < chips.length; j++) {
        chips[j].setAttribute("aria-pressed", String(chips[j].getAttribute("data-filter") === value));
      }
      if (countEl) countEl.textContent = shown === 1 ? "Showing 1 category" : "Showing " + shown + " categories";
    };
    for (var c = 0; c < chips.length; c++) {
      chips[c].addEventListener("click", function () { applyFilter(this.getAttribute("data-filter")); });
    }
  }

  /* Contact form */
  var form = document.getElementById("contact-form");
  if (form) {
    var status = document.getElementById("form-status");
    var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    var setError = function (field, message) {
      var err = document.getElementById(field.id + "-error");
      if (message) {
        field.setAttribute("aria-invalid", "true");
        if (err) err.textContent = message;
      } else {
        field.removeAttribute("aria-invalid");
        if (err) err.textContent = "";
      }
    };

    var validate = function () {
      var ok = true;
      var first = null;
      var checks = [
        ["cf-name", function (v) { return v.trim().length >= 2 ? "" : "Please enter your name."; }],
        ["cf-email", function (v) { return emailRe.test(v.trim()) ? "" : "Please enter a valid email address."; }],
        ["cf-topic", function (v) { return v ? "" : "Please choose a topic."; }],
        ["cf-message", function (v) { return v.trim().length >= 10 ? "" : "Please write at least 10 characters."; }]
      ];
      for (var i = 0; i < checks.length; i++) {
        var el = document.getElementById(checks[i][0]);
        var msg = checks[i][1](el.value);
        setError(el, msg);
        if (msg) { ok = false; if (!first) first = el; }
      }
      var consent = document.getElementById("cf-consent");
      var cmsg = consent.checked ? "" : "Please confirm you have read the Privacy Policy.";
      setError(consent, cmsg);
      if (cmsg) { ok = false; if (!first) first = consent; }
      if (first) first.focus();
      return ok;
    };

    form.addEventListener("input", function (e) {
      if (e.target.getAttribute("aria-invalid") === "true") setError(e.target, "");
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      status.className = "form-status";
      status.textContent = "";
      if (form.website && form.website.value) return; /* spam trap */
      if (!validate()) {
        status.className = "form-status err";
        status.textContent = "Please fix the highlighted fields and try again.";
        return;
      }

      var data = {
        name: form.name.value.trim(),
        email: form.email.value.trim(),
        topic: form.topic.value,
        reference: form.reference.value.trim(),
        message: form.message.value.trim()
      };
      var endpoint = form.getAttribute("data-endpoint");
      var btn = form.querySelector("button[type=submit]");

      if (endpoint) {
        btn.disabled = true;
        fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify(data)
        }).then(function (res) {
          if (!res.ok) throw new Error("Request failed");
          form.reset();
          status.className = "form-status ok";
          status.textContent = "Thanks, " + data.name + ". Your message has been sent. We reply within 2 business days.";
        }).catch(function () {
          status.className = "form-status err";
          status.textContent = "We couldn't send your message right now. Please email us directly at " + form.getAttribute("data-email") + ".";
        }).then(function () { btn.disabled = false; });
        return;
      }

      /* No server endpoint configured: hand the message to the visitor's email app */
      var to = form.getAttribute("data-email");
      var subject = "[Zorevo] " + data.topic + " — " + data.name;
      var body = "Name: " + data.name + "\nEmail: " + data.email + "\nTopic: " + data.topic +
        (data.reference ? "\nReference: " + data.reference : "") + "\n\n" + data.message;
      window.location.href = "mailto:" + to + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
      status.className = "form-status ok";
      status.textContent = "Your email app should now open with your message ready to send. If it doesn't, email us at " + to + ".";
    });
  }

  /* Cookie consent (only essential storage is used unless the visitor accepts optional cookies) */
  var banner = document.getElementById("cookie-banner");
  var applyConsent = function (value) {
    document.documentElement.setAttribute("data-consent", value);
    window.zorevoConsent = value;
    try { document.dispatchEvent(new CustomEvent("zorevo:consent", { detail: value })); } catch (e) { /* old browsers */ }
  };
  var saved = store("get", CONSENT_KEY);
  if (saved) applyConsent(saved);
  if (banner) {
    if (!saved) banner.hidden = false;
    var choose = function (value) {
      store("set", CONSENT_KEY, value);
      applyConsent(value);
      banner.hidden = true;
    };
    var acc = banner.querySelector("[data-consent-accept]");
    var rej = banner.querySelector("[data-consent-reject]");
    if (acc) acc.addEventListener("click", function () { choose("accepted"); });
    if (rej) rej.addEventListener("click", function () { choose("essential"); });
  }
  var resetBtns = document.querySelectorAll("[data-consent-reset]");
  for (var r = 0; r < resetBtns.length; r++) {
    resetBtns[r].addEventListener("click", function (e) {
      e.preventDefault();
      try { window.localStorage.removeItem(CONSENT_KEY); } catch (e) { /* ignore */ }
      if (banner) { banner.hidden = false; var b = banner.querySelector("button"); if (b) b.focus(); }
    });
  }
})();

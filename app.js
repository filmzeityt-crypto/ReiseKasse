/* Reisekasse — standalone PWA, no build step, no framework.
   Persists to localStorage (this is a real hosted site, so that's the
   correct, normal choice here — unlike inside the Claude.ai sandbox). */

(function () {
  "use strict";

  /* ---------------- data ---------------- */

  var STORAGE_KEY = "reisekasse:v1";

  var CATEGORIES = [
    { id: "essen", label: "Essen", color: "#C24B3B", icon: "utensils" },
    { id: "transport", label: "Transport", color: "#2B4C7E", icon: "car" },
    { id: "unterkunft", label: "Unterkunft", color: "#6B5B95", icon: "bed" },
    { id: "einkauf", label: "Einkauf", color: "#D6A24A", icon: "bag" },
    { id: "freizeit", label: "Freizeit", color: "#3F7A6E", icon: "ticket" },
    { id: "sonstiges", label: "Sonstiges", color: "#8A8578", icon: "dots" },
  ];

  var DEFAULT_RATES = {
    EUR: 1, USD: 0.92, GBP: 1.17, CHF: 1.04, JPY: 0.0061, THB: 0.026,
    VND: 0.000038, IDR: 0.000058, MXN: 0.048, TRY: 0.027, AUD: 0.6,
    CZK: 0.04, HUF: 0.0025, PLN: 0.23, DKK: 0.134, SEK: 0.087, NOK: 0.086,
    INR: 0.011, CNY: 0.13, KRW: 0.00063, ZAR: 0.049, EGP: 0.019, MAD: 0.092,
    CAD: 0.66, NZD: 0.55, BRL: 0.16, AED: 0.25, ILS: 0.25
  };

  function uid() { return Math.random().toString(36).slice(2, 10); }
  function todayISO() { return new Date().toISOString().slice(0, 10); }

  function fmtMoney(n, currency) {
    try {
      return new Intl.NumberFormat("de-DE", { style: "currency", currency: currency, maximumFractionDigits: 2 }).format(n);
    } catch (e) {
      return n.toFixed(2) + " " + currency;
    }
  }

  function catFor(id) {
    for (var i = 0; i < CATEGORIES.length; i++) if (CATEGORIES[i].id === id) return CATEGORIES[i];
    return CATEGORIES[CATEGORIES.length - 1];
  }

  function defaultState() {
    return {
      trip: { name: "Meine Reise", baseCurrency: "EUR", startDate: todayISO(), endDate: "" },
      rates: Object.assign({}, DEFAULT_RATES),
      ratesMeta: { lastUpdated: null, lastAttempt: null, lastStatus: null },
      expenses: []
    };
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.trip || !parsed.rates) return defaultState();
      if (!parsed.ratesMeta) parsed.ratesMeta = { lastUpdated: null, lastAttempt: null, lastStatus: null };
      if (!parsed.expenses) parsed.expenses = [];
      return parsed;
    } catch (e) {
      return defaultState();
    }
  }

  var state = loadState();
  var saveError = false;

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      saveError = false;
    } catch (e) {
      saveError = true;
    }
  }

  /* ---------------- live exchange rates ---------------- */

  function fetchLiveRates(baseCurrency) {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return Promise.resolve({ rates: null, status: "offline" });
    }
    return fetch("https://api.frankfurter.app/latest?from=" + encodeURIComponent(baseCurrency))
      .then(function (res) {
        if (!res.ok) return { rates: null, status: "error" };
        return res.json().then(function (data) {
          if (!data || !data.rates) return { rates: null, status: "error" };
          var inverted = {};
          Object.keys(data.rates).forEach(function (code) {
            var rateFromBase = data.rates[code];
            if (rateFromBase > 0) inverted[code] = 1 / rateFromBase;
          });
          return { rates: inverted, status: "ok" };
        });
      })
      .catch(function () { return { rates: null, status: "error" }; });
  }

  function refreshRatesIfNeeded(force) {
    if (!force && state.ratesMeta.lastUpdated === todayISO()) return Promise.resolve();
    var base = state.trip.baseCurrency;
    return fetchLiveRates(base).then(function (result) {
      if (result.rates) {
        state.rates = Object.assign({}, state.rates, result.rates);
        state.rates[base] = 1;
      }
      state.ratesMeta = {
        lastAttempt: new Date().toISOString(),
        lastUpdated: result.rates ? todayISO() : state.ratesMeta.lastUpdated,
        lastStatus: result.status
      };
      save();
    });
  }

  function rateStatusText() {
    var m = state.ratesMeta;
    if (!m) return "";
    if (m.lastUpdated === todayISO()) return "Kurse heute aktualisiert";
    if (m.lastStatus === "offline") return "Offline · alte Kurse aktiv";
    if (m.lastStatus === "error") return "Kurse konnten nicht geladen werden";
    if (m.lastUpdated) return "Kurse zuletzt am " + m.lastUpdated;
    return "Kurse noch nie aktualisiert";
  }

  /* ---------------- expense logic ---------------- */

  function addExpense(exp) {
    var currentRate = state.rates[exp.currency] || 1;
    var entry = Object.assign({ id: uid() }, exp, {
      rateUsed: currentRate,
      baseAtEntry: state.trip.baseCurrency
    });
    state.expenses.unshift(entry);
    save();
  }

  function deleteExpense(id) {
    state.expenses = state.expenses.filter(function (e) { return e.id !== id; });
    save();
  }

  function convertExpense(e) {
    var base = state.trip.baseCurrency;
    if (e.rateUsed != null && e.baseAtEntry === base) return e.amount * e.rateUsed;
    var r = state.rates[e.currency];
    return r ? e.amount * r : 0;
  }

  function computeDerived() {
    var base = state.trip.baseCurrency;
    var totalBase = 0;
    state.expenses.forEach(function (e) { totalBase += convertExpense(e); });

    var byCat = CATEGORIES.map(function (c) {
      var sum = 0;
      state.expenses.forEach(function (e) { if (e.category === c.id) sum += convertExpense(e); });
      return Object.assign({}, c, { value: sum });
    }).filter(function (c) { return c.value > 0; });

    var byDayMap = {};
    state.expenses.forEach(function (e) {
      byDayMap[e.date] = (byDayMap[e.date] || 0) + convertExpense(e);
    });
    var dates = Object.keys(byDayMap).sort();
    var byDay = dates.map(function (d) { return { date: d.slice(5), value: Math.round(byDayMap[d] * 100) / 100 }; });

    var dayCount = 1;
    if (state.trip.startDate) {
      var start = new Date(state.trip.startDate);
      var end = state.trip.endDate ? new Date(state.trip.endDate) : new Date();
      var last = dates.length ? new Date(dates[dates.length - 1]) : end;
      var cutoff = last < end ? last : end;
      dayCount = Math.max(1, Math.round((cutoff - start) / 86400000) + 1);
    } else if (dates.length) {
      dayCount = Math.max(1, Math.round((new Date(dates[dates.length - 1]) - new Date(dates[0])) / 86400000) + 1);
    }

    var avgPerDay = totalBase / dayCount;
    var topCat = byCat.slice().sort(function (a, b) { return b.value - a.value; })[0];

    return { totalBase: totalBase, byCat: byCat, byDay: byDay, dayCount: dayCount, avgPerDay: avgPerDay, topCat: topCat, base: base };
  }

  /* exposed to the render module */
  window.Reisekasse = {
    CATEGORIES: CATEGORIES, catFor: catFor, fmtMoney: fmtMoney, todayISO: todayISO,
    getState: function () { return state; },
    saveErrorFlag: function () { return saveError; },
    addExpense: addExpense, deleteExpense: deleteExpense, convertExpense: convertExpense,
    computeDerived: computeDerived, refreshRatesIfNeeded: refreshRatesIfNeeded,
    rateStatusText: rateStatusText,
    updateTrip: function (trip) { state.trip = trip; save(); },
    updateRates: function (rates) { state.rates = rates; save(); }
  };

  document.addEventListener("DOMContentLoaded", function () {
    refreshRatesIfNeeded(false).then(function () {
      if (window.ReisekasseUI) window.ReisekasseUI.rerenderRateStatus();
    });
    window.addEventListener("online", function () {
      refreshRatesIfNeeded(false).then(function () {
        if (window.ReisekasseUI) window.ReisekasseUI.rerenderRateStatus();
      });
    });
    if (window.ReisekasseUI) window.ReisekasseUI.init();
  });
})();

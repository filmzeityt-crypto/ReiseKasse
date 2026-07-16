/* Reisekasse — Logik: Daten, Speicherung, Wechselkurse, Sync.
   Sync-Prinzip: Firebase Realtime Database per REST.
   - Jede Ausgabe liegt unter trips/{code}/expenses/{id}
   - Offline-Änderungen landen in einer Warteschlange (pendingOps) und
     werden beim nächsten Sync nachgereicht.
   - syncedIds merkt sich, welche Einträge schon mal auf dem Server waren:
     fehlt so ein Eintrag später auf dem Server, wurde er vom anderen
     Gerät gelöscht und wird auch lokal entfernt (statt wieder hochgeladen). */

(function () {
  "use strict";

  var STORAGE_KEY = "reisekasse:v2";
  var LEGACY_KEY = "reisekasse:v1";

  var CATEGORIES = [
    { id: "essen", label: "Essen", color: "#C24B3B", icon: "utensils" },
    { id: "transport", label: "Transport", color: "#2B4C7E", icon: "car" },
    { id: "unterkunft", label: "Unterkunft", color: "#6B5B95", icon: "bed" },
    { id: "einkauf", label: "Einkauf", color: "#D6A24A", icon: "bag" },
    { id: "freizeit", label: "Freizeit", color: "#3F7A6E", icon: "ticket" },
    { id: "sonstiges", label: "Sonstiges", color: "#8A8578", icon: "dots" }
  ];

  var DEFAULT_RATES = {
    EUR: 1, USD: 0.92, GBP: 1.17, CHF: 1.04, JPY: 0.0061, THB: 0.026,
    VND: 0.000038, IDR: 0.000058, MXN: 0.048, TRY: 0.027, AUD: 0.6,
    CZK: 0.04, HUF: 0.0025, PLN: 0.23, DKK: 0.134, SEK: 0.087, NOK: 0.086,
    INR: 0.011, CNY: 0.13, KRW: 0.00063, ZAR: 0.049, EGP: 0.019, MAD: 0.092,
    CAD: 0.66, NZD: 0.55, BRL: 0.16, AED: 0.25, ILS: 0.25
  };

  function uid() { return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8); }
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
      trip: { name: "Meine Reise", baseCurrency: "EUR", startDate: todayISO(), endDate: "", updatedAt: 0 },
      rates: Object.assign({}, DEFAULT_RATES),
      ratesMeta: { lastUpdated: null, lastAttempt: null, lastStatus: null },
      expenses: [],
      sync: { dbUrl: "", tripCode: "", person: "" },
      pendingOps: [],
      syncedIds: {},
      syncMeta: { lastSync: null, lastStatus: null } // "ok" | "offline" | "error" | "unconfigured"
    };
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        // Migrate from the pre-sync version so existing entries survive the update.
        var legacy = localStorage.getItem(LEGACY_KEY);
        if (legacy) {
          var old = JSON.parse(legacy);
          var st = defaultState();
          if (old && old.trip) st.trip = Object.assign(st.trip, old.trip, { updatedAt: 0 });
          if (old && old.rates) st.rates = old.rates;
          if (old && old.ratesMeta) st.ratesMeta = old.ratesMeta;
          if (old && old.expenses) st.expenses = old.expenses;
          return st;
        }
        return defaultState();
      }
      var parsed = JSON.parse(raw);
      var base = defaultState();
      if (!parsed || typeof parsed !== "object") return base;
      return {
        trip: Object.assign(base.trip, parsed.trip || {}),
        rates: parsed.rates || base.rates,
        ratesMeta: parsed.ratesMeta || base.ratesMeta,
        expenses: parsed.expenses || [],
        sync: Object.assign(base.sync, parsed.sync || {}),
        pendingOps: parsed.pendingOps || [],
        syncedIds: parsed.syncedIds || {},
        syncMeta: parsed.syncMeta || base.syncMeta
      };
    } catch (e) {
      return defaultState();
    }
  }

  var state = loadState();
  var saveError = false;
  var syncing = false;

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
            if (data.rates[code] > 0) inverted[code] = 1 / data.rates[code];
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

  /* ---------------- expenses ---------------- */

  function addExpense(exp) {
    var currentRate = state.rates[exp.currency] || 1;
    var entry = Object.assign({ id: uid() }, exp, {
      person: state.sync.person || "Ich",
      rateUsed: currentRate,
      baseAtEntry: state.trip.baseCurrency,
      createdAt: Date.now()
    });
    state.expenses.unshift(entry);
    queueOp({ type: "put", id: entry.id, data: entry });
    save();
    trySyncSoon();
  }

  function deleteExpense(id) {
    state.expenses = state.expenses.filter(function (e) { return e.id !== id; });
    queueOp({ type: "delete", id: id });
    delete state.syncedIds[id];
    save();
    trySyncSoon();
  }

  function convertExpense(e) {
    var base = state.trip.baseCurrency;
    if (e.rateUsed != null && e.baseAtEntry === base) return e.amount * e.rateUsed;
    var r = state.rates[e.currency];
    return r ? e.amount * r : 0;
  }

  function personsInData() {
    var seen = {};
    var list = [];
    if (state.sync.person) { seen[state.sync.person] = true; list.push(state.sync.person); }
    state.expenses.forEach(function (e) {
      var p = e.person || "Ich";
      if (!seen[p]) { seen[p] = true; list.push(p); }
    });
    return list;
  }

  function computeDerived(personFilter) {
    var base = state.trip.baseCurrency;
    var expenses = state.expenses.filter(function (e) {
      return !personFilter || personFilter === "all" || (e.person || "Ich") === personFilter;
    });

    var totalBase = 0;
    expenses.forEach(function (e) { totalBase += convertExpense(e); });

    var byCat = CATEGORIES.map(function (c) {
      var sum = 0;
      expenses.forEach(function (e) { if (e.category === c.id) sum += convertExpense(e); });
      return Object.assign({}, c, { value: sum });
    }).filter(function (c) { return c.value > 0; });

    var byDayMap = {};
    expenses.forEach(function (e) {
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

    var byPerson = {};
    state.expenses.forEach(function (e) {
      var p = e.person || "Ich";
      byPerson[p] = (byPerson[p] || 0) + convertExpense(e);
    });

    return {
      totalBase: totalBase, byCat: byCat, byDay: byDay, dayCount: dayCount,
      avgPerDay: avgPerDay, topCat: topCat, base: base, byPerson: byPerson
    };
  }

  /* ---------------- sync ---------------- */

  function syncConfigured() {
    return !!(state.sync.dbUrl && state.sync.tripCode);
  }

  function tripPath(sub) {
    var url = state.sync.dbUrl.replace(/\/+$/, "");
    var code = encodeURIComponent(state.sync.tripCode.trim());
    return url + "/trips/" + code + "/" + sub + ".json";
  }

  function queueOp(op) {
    if (!syncConfigured()) return; // sync off → rein lokal, keine Warteschlange nötig
    // Neuere Op zum selben Eintrag ersetzt die ältere
    state.pendingOps = state.pendingOps.filter(function (o) { return o.id !== op.id; });
    state.pendingOps.push(op);
  }

  var syncSoonTimer = null;
  function trySyncSoon() {
    if (!syncConfigured()) return;
    if (syncSoonTimer) clearTimeout(syncSoonTimer);
    syncSoonTimer = setTimeout(function () { syncNow(); }, 400);
  }

  function syncNow() {
    if (!syncConfigured()) {
      state.syncMeta = { lastSync: state.syncMeta.lastSync, lastStatus: "unconfigured" };
      save();
      return Promise.resolve(false);
    }
    if (syncing) return Promise.resolve(false);
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      state.syncMeta = { lastSync: state.syncMeta.lastSync, lastStatus: "offline" };
      save();
      notifyUI();
      return Promise.resolve(false);
    }

    syncing = true;
    notifyUI();

    var chain = Promise.resolve();

    // 1) Warteschlange abarbeiten
    var ops = state.pendingOps.slice();
    ops.forEach(function (op) {
      chain = chain.then(function () {
        var url = tripPath("expenses/" + encodeURIComponent(op.id));
        var req = op.type === "delete"
          ? fetch(url, { method: "DELETE" })
          : fetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(op.data) });
        return req.then(function (res) {
          if (!res.ok) throw new Error("op failed");
          state.pendingOps = state.pendingOps.filter(function (o) { return o !== op && o.id !== op.id; });
          if (op.type === "put") state.syncedIds[op.id] = true;
          save();
        });
      });
    });

    // 2) Reise-Metadaten abgleichen (neuere Version gewinnt)
    chain = chain.then(function () {
      return fetch(tripPath("meta")).then(function (res) {
        if (!res.ok) throw new Error("meta get failed");
        return res.json();
      }).then(function (remoteMeta) {
        var localAt = state.trip.updatedAt || 0;
        var remoteAt = (remoteMeta && remoteMeta.updatedAt) || 0;
        if (remoteMeta && remoteAt > localAt) {
          state.trip = Object.assign({}, state.trip, remoteMeta);
          save();
        } else if (localAt > remoteAt) {
          return fetch(tripPath("meta"), {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(state.trip)
          });
        }
      });
    });

    // 3) Alle Ausgaben vom Server holen und zusammenführen
    chain = chain.then(function () {
      return fetch(tripPath("expenses")).then(function (res) {
        if (!res.ok) throw new Error("expenses get failed");
        return res.json();
      }).then(function (remote) {
        remote = remote || {};
        var remoteIds = {};
        Object.keys(remote).forEach(function (id) { remoteIds[id] = true; });

        // Lokale Einträge, die der Server nicht kennt:
        //  - nie synchronisiert → hochladen (z. B. Einträge von vor der Sync-Einrichtung)
        //  - früher synchronisiert → wurden remote gelöscht → lokal auch entfernen
        var uploads = [];
        var keptLocal = [];
        state.expenses.forEach(function (e) {
          if (remoteIds[e.id]) return; // kommt gleich aus remote
          if (state.syncedIds[e.id]) return; // remote gelöscht → verwerfen
          keptLocal.push(e);
          uploads.push(e);
        });

        var upChain = Promise.resolve();
        uploads.forEach(function (e) {
          upChain = upChain.then(function () {
            return fetch(tripPath("expenses/" + encodeURIComponent(e.id)), {
              method: "PUT", headers: { "Content-Type": "application/json" },
              body: JSON.stringify(e)
            }).then(function (res) {
              if (res.ok) { state.syncedIds[e.id] = true; remote[e.id] = e; }
            });
          });
        });

        return upChain.then(function () {
          var merged = Object.keys(remote).map(function (id) { return remote[id]; });
          merged.sort(function (a, b) {
            if (a.date !== b.date) return a.date < b.date ? 1 : -1;
            return (b.createdAt || 0) - (a.createdAt || 0);
          });
          state.expenses = merged;
          var ids = {};
          merged.forEach(function (e) { ids[e.id] = true; });
          state.syncedIds = ids;
        });
      });
    });

    return chain.then(function () {
      state.syncMeta = { lastSync: new Date().toISOString(), lastStatus: "ok" };
      syncing = false;
      save();
      notifyUI(true);
      return true;
    }).catch(function () {
      state.syncMeta = { lastSync: state.syncMeta.lastSync, lastStatus: "error" };
      syncing = false;
      save();
      notifyUI();
      return false;
    });
  }

  function syncStatusText() {
    if (!syncConfigured()) return "Sync aus (nur dieses Gerät)";
    if (syncing) return "Synchronisiere …";
    var pending = state.pendingOps.length;
    var m = state.syncMeta;
    if (m.lastStatus === "ok" && pending === 0) return "Sync ✓";
    if (m.lastStatus === "offline" || pending > 0) return "Sync ausstehend (" + Math.max(pending, 1) + ")";
    if (m.lastStatus === "error") return "Sync-Fehler";
    return "Noch nie synchronisiert";
  }

  function notifyUI(fullRerender) {
    if (window.ReisekasseUI) {
      if (fullRerender) window.ReisekasseUI.rerender();
      else window.ReisekasseUI.rerenderStatus();
    }
  }

  /* ---------------- exposed API ---------------- */

  window.Reisekasse = {
    CATEGORIES: CATEGORIES, catFor: catFor, fmtMoney: fmtMoney, todayISO: todayISO,
    getState: function () { return state; },
    saveErrorFlag: function () { return saveError; },
    isSyncing: function () { return syncing; },
    addExpense: addExpense, deleteExpense: deleteExpense, convertExpense: convertExpense,
    computeDerived: computeDerived, personsInData: personsInData,
    refreshRatesIfNeeded: refreshRatesIfNeeded, rateStatusText: rateStatusText,
    syncNow: syncNow, syncConfigured: syncConfigured, syncStatusText: syncStatusText,
    updateTrip: function (trip) {
      state.trip = Object.assign({}, trip, { updatedAt: Date.now() });
      save();
      trySyncSoon();
    },
    updateRates: function (rates) { state.rates = rates; save(); },
    updateSync: function (syncCfg) {
      var wasConfigured = syncConfigured();
      state.sync = {
        dbUrl: (syncCfg.dbUrl || "").trim(),
        tripCode: (syncCfg.tripCode || "").trim(),
        person: (syncCfg.person || "").trim()
      };
      save();
      if (!wasConfigured && syncConfigured()) {
        // Erstes Einschalten: alle bisherigen Einträge gelten als "nie
        // synchronisiert" und werden beim ersten Sync hochgeladen.
        state.syncedIds = {};
        save();
      }
      if (syncConfigured()) syncNow();
    }
  };

  document.addEventListener("DOMContentLoaded", function () {
    refreshRatesIfNeeded(false).then(function () { notifyUI(); });
    if (syncConfigured()) syncNow();
    window.addEventListener("online", function () {
      refreshRatesIfNeeded(false).then(function () { notifyUI(); });
      if (syncConfigured()) syncNow();
    });
    if (window.ReisekasseUI) window.ReisekasseUI.init();
  });
})();

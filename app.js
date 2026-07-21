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
  var PHOTO_STORE_KEY = "reisekasse:photos"; // lokale Foto-Blobs (unsynchronisiert / offline)
  // Eure gemeinsame Datenbank — fest eingebaut, damit kein Gerät sie je eintippen muss.
  // Im Profil weiterhin änderbar, falls ihr irgendwann umzieht.
  var DEFAULT_DB_URL = "https://reisekasse-c4c7f-default-rtdb.europe-west1.firebasedatabase.app";

  var CATEGORIES = [
    { id: "essen", label: "Essen", color: "#C24B3B", icon: "utensils", emoji: "🍜" },
    { id: "transport", label: "Transport", color: "#2B4C7E", icon: "car", emoji: "🚕" },
    { id: "unterkunft", label: "Unterkunft", color: "#6B5B95", icon: "bed", emoji: "🛏️" },
    { id: "einkauf", label: "Einkauf", color: "#D6A24A", icon: "bag", emoji: "🛍️" },
    { id: "freizeit", label: "Freizeit", color: "#3F7A6E", icon: "ticket", emoji: "🎡" },
    { id: "sonstiges", label: "Sonstiges", color: "#8A8578", icon: "dots", emoji: "📦" }
  ];

  var DEFAULT_RATES = {
    EUR: 1, USD: 0.92, GBP: 1.17, CHF: 1.04, JPY: 0.0061, THB: 0.026,
    SGD: 0.678, TRY: 0.0186, IDR: 0.0000486,
    VND: 0.000038, MXN: 0.048, AUD: 0.6,
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
      sync: { dbUrl: DEFAULT_DB_URL, tripCode: "", person: "" },
      pendingOps: [],
      syncedIds: {},
      syncMeta: { lastSync: null, lastStatus: null }, // "ok" | "offline" | "error" | "unconfigured"
      tripsDir: null,
      avatar: "",
      lastSettleReminder: 0
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
      // Neue Standard-Währungen (z. B. SGD) auch in bestehende, bereits
      // gespeicherte Kurslisten nachziehen — ohne vorhandene Werte anzufassen.
      var mergedRates = parsed.rates || base.rates;
      Object.keys(DEFAULT_RATES).forEach(function (code) {
        if (!(code in mergedRates)) mergedRates[code] = DEFAULT_RATES[code];
      });
      return {
        trip: Object.assign(base.trip, parsed.trip || {}),
        rates: mergedRates,
        ratesMeta: parsed.ratesMeta || base.ratesMeta,
        expenses: parsed.expenses || [],
        sync: Object.assign(base.sync, parsed.sync || {}),
        pendingOps: parsed.pendingOps || [],
        syncedIds: parsed.syncedIds || {},
        syncMeta: parsed.syncMeta || base.syncMeta,
        theme: parsed.theme || "papier",
        avatar: parsed.avatar || "",
        lastSettleReminder: parsed.lastSettleReminder || 0,
        onboarded: !!parsed.onboarded,
        tripsDir: Array.isArray(parsed.tripsDir) ? parsed.tripsDir : null
      };
    } catch (e) {
      return defaultState();
    }
  }

  var state = loadState();
  if (!state.sync.dbUrl) state.sync.dbUrl = DEFAULT_DB_URL;
  // Migration auf Mehrfach-Reisen: Verzeichnis anlegen; bestehende Daten registrieren.
  // Frische Installationen starten leer — die erste Reise entsteht im Onboarding.
  if (!state.tripsDir) {
    var hasPriorData = state.onboarded || (state.expenses && state.expenses.length > 0) || (state.sync && state.sync.tripCode);
    if (hasPriorData) {
      var migCode = (state.sync && state.sync.tripCode) || null;
      if (!migCode) {
        migCode = ((state.trip.name || "reise").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 10) || "reise") + "-" + Math.random().toString(36).slice(2, 8);
        state.sync.tripCode = migCode;
      }
      state.tripsDir = [{ code: migCode, name: state.trip.name || "Meine Reise", dbUrl: state.sync.dbUrl || "" }];
    } else {
      state.tripsDir = [];
    }
  }
  var saveError = false;
  var syncing = false;

  /* ---------------- Mehrere Reisen ----------------
     tripsDir = Verzeichnis aller bekannten Reisen [{code, name, dbUrl}].
     Die AKTIVE Reise liegt wie bisher direkt im state (trip, expenses, …);
     beim Wechseln wird sie als "Slice" unter eigenem Schlüssel geparkt. */

  function tripSliceKey(code) { return "reisekasse:tripslice:" + code; }

  function genTripCode(name) {
    var slug = (name || "reise").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 10) || "reise";
    return slug + "-" + Math.random().toString(36).slice(2, 8);
  }

  function activeSlice() {
    return {
      trip: state.trip, rates: state.rates, ratesMeta: state.ratesMeta,
      expenses: state.expenses, syncedIds: state.syncedIds,
      pendingOps: state.pendingOps, syncMeta: state.syncMeta,
      dbUrl: state.sync.dbUrl, tripCode: state.sync.tripCode
    };
  }

  function snapshotActive() {
    if (!state.sync.tripCode) return;
    try {
      localStorage.setItem(tripSliceKey(state.sync.tripCode), JSON.stringify(activeSlice()));
    } catch (e) { saveError = true; }
  }

  function freshSlice(name, dbUrl, code) {
    var d = defaultState();
    d.trip.name = name || "Meine Reise";
    return {
      trip: d.trip, rates: d.rates, ratesMeta: d.ratesMeta,
      expenses: [], syncedIds: {}, pendingOps: [], syncMeta: d.syncMeta,
      dbUrl: dbUrl || state.sync.dbUrl || "", tripCode: code
    };
  }

  function applySlice(slice) {
    state.trip = slice.trip;
    state.rates = slice.rates;
    state.ratesMeta = slice.ratesMeta;
    state.expenses = slice.expenses || [];
    state.syncedIds = slice.syncedIds || {};
    state.pendingOps = slice.pendingOps || [];
    state.syncMeta = slice.syncMeta || { lastSync: null, lastStatus: null };
    state.sync.dbUrl = slice.dbUrl || state.sync.dbUrl || "";
    state.sync.tripCode = slice.tripCode;
  }

  function dirEntry(code) {
    for (var i = 0; i < state.tripsDir.length; i++) if (state.tripsDir[i].code === code) return state.tripsDir[i];
    return null;
  }

  function switchTrip(code) {
    if (code === state.sync.tripCode) return;
    var entry = dirEntry(code);
    if (!entry) return;
    snapshotActive();
    var slice = null;
    try { slice = JSON.parse(localStorage.getItem(tripSliceKey(code)) || "null"); } catch (e) { slice = null; }
    applySlice(slice || freshSlice(entry.name, entry.dbUrl, code));
    save();
    if (syncConfigured()) syncNow();
    notifyUI(true);
  }

  function createTrip(name, dbUrl, budget) {
    var code = genTripCode(name);
    var useDb = (dbUrl !== undefined ? dbUrl : state.sync.dbUrl) || "";
    snapshotActive();
    state.tripsDir.push({ code: code, name: name || "Meine Reise", dbUrl: useDb });
    applySlice(freshSlice(name, useDb, code));
    if (budget > 0) state.trip.budget = budget;
    state.trip.updatedAt = Date.now(); // Meta beim ersten Sync hochladen
    save();
    if (syncConfigured()) syncNow();
    notifyUI(true);
    return code;
  }

  // Einladungs-Link der aktiven Reise (oder einer aus dem Verzeichnis)
  function shareLink(code) {
    var entry = code ? dirEntry(code) : null;
    var db = entry ? entry.dbUrl : state.sync.dbUrl;
    var c = entry ? entry.code : state.sync.tripCode;
    var name = entry ? entry.name : state.trip.name;
    if (!db || !c) return null;
    return "tripcash:join?db=" + db + "&code=" + c + "&name=" + encodeURIComponent(name || "");
  }

  // Nimmt einen eingefügten Link/Text entgegen; liefert null bei Erfolg, sonst Fehlertext.
  function knownDbUrl() {
    if (state.sync.dbUrl) return state.sync.dbUrl;
    for (var i = 0; i < state.tripsDir.length; i++) {
      if (state.tripsDir[i].dbUrl) return state.tripsDir[i].dbUrl;
    }
    return DEFAULT_DB_URL;
  }

  function joinTrip(input) {
    input = (input || "").trim();
    if (!input) return "Bitte füge einen Code oder Einladungs-Link ein.";
    // Reparatur: Zeilenumbrüche/Leerzeichen aus zerbrochenen Messenger-Links entfernen,
    // Prozent-Kodierung auflösen (%2F -> / usw.), Reste wie "https://2F..." glätten
    input = input.replace(/[\s\r\n]+/g, "");
    try { input = decodeURIComponent(input); } catch (e) {}
    var dbFix = input.match(/(?:2F)*([A-Za-z0-9][A-Za-z0-9-]*-default-rtdb[A-Za-z0-9.-]*\.firebasedatabase\.app)/);
    if (dbFix) {
      // Domain sauber herausziehen (Kodierungs-Reste wie "2F" davor entfernen)
      // und den https://-Präfix frisch zusammensetzen
      input = input.replace(/https?:\/\/[^&]*?(?:2F)*[A-Za-z0-9][A-Za-z0-9-]*-default-rtdb[A-Za-z0-9.-]*\.firebasedatabase\.app/, "https://" + dbFix[1]);
    }
    var db = null, code = null, name = null;
    // Nackter Code (z. B. "asien2026-x7k9")? Dann bekannte Datenbank verwenden.
    if (/^[A-Za-z0-9_-]+$/.test(input) && input.indexOf("=") === -1) {
      code = input;
      db = knownDbUrl();
      if (!db) return "Dein Gerät kennt noch keine Datenbank. Beim ersten Mal bitte den kompletten Einladungs-Link verwenden — danach reicht der kurze Code.";
    }
    var q = input.indexOf("?") !== -1 ? input.slice(input.indexOf("?") + 1) : input;
    q.split("&").forEach(function (pair) {
      var kv = pair.split("=");
      var k = (kv[0] || "").trim().toLowerCase();
      var v = decodeURIComponent((kv[1] || "").trim());
      if (k === "db") db = v;
      if (k === "code") code = v;
      if (k === "name") name = v;
    });
    if (!db) {
      var m = input.match(/https:\/\/[^\s|&]+firebasedatabase\.app[^\s|&]*/);
      if (m) db = m[0];
    }
    if (!code) {
      var m2 = input.match(/code=([A-Za-z0-9_-]+)/);
      if (m2) code = m2[1];
    }
    if (!db || !code) return "Der Link ist unvollständig — bitte den kompletten Einladungs-Link einfügen.";
    db = db.replace(/\/+$/, "");
    if (!dirEntry(code)) state.tripsDir.push({ code: code, name: name || "Geteilte Reise", dbUrl: db });
    snapshotActive();
    var slice = null;
    try { slice = JSON.parse(localStorage.getItem(tripSliceKey(code)) || "null"); } catch (e) { slice = null; }
    applySlice(slice || freshSlice(name || "Geteilte Reise", db, code));
    save();
    syncNow();
    notifyUI(true);
    return null;
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      saveError = false;
    } catch (e) {
      saveError = true;
    }
  }

  /* ---------------- live exchange rates ----------------
     Drei Quellen, alle kostenlos & ohne Schlüssel. Wird der Reihe nach
     probiert, bis eine antwortet — falls ein Netz/DNS-Filter eine Quelle
     blockiert, springt die nächste ein. Alle liefern "1 Basis = X Ziel";
     wir speichern invertiert ("1 Ziel = X Basis"). */

  function invertRates(fromBaseRates) {
    var inverted = {};
    Object.keys(fromBaseRates).forEach(function (code) {
      var v = fromBaseRates[code];
      if (typeof v === "number" && v > 0) inverted[code.toUpperCase()] = 1 / v;
    });
    return inverted;
  }

  function fetchJson(url) {
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error("http " + res.status);
      return res.json();
    });
  }

  var RATE_SOURCES = [
    function (base) {
      return fetchJson("https://api.frankfurter.app/latest?from=" + encodeURIComponent(base))
        .then(function (data) {
          if (!data || !data.rates) throw new Error("bad data");
          return invertRates(data.rates);
        });
    },
    function (base) {
      return fetchJson("https://open.er-api.com/v6/latest/" + encodeURIComponent(base))
        .then(function (data) {
          if (!data || data.result !== "success" || !data.rates) throw new Error("bad data");
          return invertRates(data.rates);
        });
    },
    function (base) {
      return fetchJson("https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/" + base.toLowerCase() + ".json")
        .then(function (data) {
          var key = base.toLowerCase();
          if (!data || !data[key]) throw new Error("bad data");
          return invertRates(data[key]);
        });
    }
  ];

  function fetchLiveRates(baseCurrency) {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return Promise.resolve({ rates: null, status: "offline" });
    }
    var i = 0;
    function tryNext() {
      if (i >= RATE_SOURCES.length) return Promise.resolve({ rates: null, status: "error" });
      var src = RATE_SOURCES[i++];
      return src(baseCurrency).then(
        function (rates) { return { rates: rates, status: "ok" }; },
        function () { return tryNext(); }
      );
    }
    return tryNext();
  }

  function refreshRatesIfNeeded(force) {
    if (!force && state.ratesMeta.lastUpdated === todayISO()) return Promise.resolve();
    var base = state.trip.baseCurrency;
    return fetchLiveRates(base).then(function (result) {
      if (result.rates) {
        // Nur Währungen aktualisieren, die der Nutzer schon in der Liste hat —
        // sonst würden die Fallback-Quellen 150+ Währungen hineinspülen.
        var updated = Object.assign({}, state.rates);
        Object.keys(updated).forEach(function (code) {
          if (result.rates[code]) updated[code] = result.rates[code];
        });
        updated[base] = 1;
        state.rates = updated;
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

  /* ---------------- Fotos ----------------
     Blobs (Base64-JPEGs, clientseitig verkleinert) liegen:
     - lokal in PHOTO_STORE (localStorage), solange sie nicht hochgeladen sind
       bzw. dauerhaft, wenn kein Sync eingerichtet ist
     - nach dem Upload nur noch in Firebase unter trips/{code}/photos/{id};
       Anzeigen lädt sie bei Bedarf nach (In-Memory-Cache) */

  var photoStore = {};
  try { photoStore = JSON.parse(localStorage.getItem(PHOTO_STORE_KEY) || "{}"); } catch (e) { photoStore = {}; }
  var photoCache = {}; // nur In-Memory, für aus Firebase geladene Fotos

  function savePhotoStore() {
    try {
      localStorage.setItem(PHOTO_STORE_KEY, JSON.stringify(photoStore));
    } catch (e) {
      saveError = true; // Speicher voll — Nutzer sieht Hinweis im Kopfbereich
    }
  }

  // Bild-Datei laden, auf max. 1000px verkleinern, als JPEG komprimieren.
  function compressImage(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error("read failed")); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error("decode failed")); };
        img.onload = function () {
          var max = 1000;
          var scale = Math.min(1, max / Math.max(img.width, img.height));
          var canvas = document.createElement("canvas");
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          var ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          var q = 0.72;
          var out = canvas.toDataURL("image/jpeg", q);
          // Notbremse: sehr große Bilder weiter herunterkomprimieren
          while (out.length > 480000 && q > 0.4) {
            q -= 0.12;
            out = canvas.toDataURL("image/jpeg", q);
          }
          resolve(out);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function addPhoto(expenseId, dataURL) {
    var photoId = uid();
    photoStore[photoId] = dataURL;
    savePhotoStore();
    // Foto-Upload einreihen (nur mit Sync sinnvoll)
    if (syncConfigured()) {
      state.pendingOps.push({ type: "photo-put", id: photoId });
    }
    // Foto am Eintrag verankern
    for (var i = 0; i < state.expenses.length; i++) {
      if (state.expenses[i].id === expenseId) {
        var e = state.expenses[i];
        e.photoIds = (e.photoIds || []).concat([photoId]);
        queueOp({ type: "put", id: e.id, data: e });
        break;
      }
    }
    save();
    trySyncSoon();
    return photoId;
  }

  function deletePhoto(photoId, expenseId) {
    delete photoStore[photoId];
    delete photoCache[photoId];
    savePhotoStore();
    state.pendingOps = state.pendingOps.filter(function (o) { return !(o.type === "photo-put" && o.id === photoId); });
    if (syncConfigured()) state.pendingOps.push({ type: "photo-delete", id: photoId });
    for (var i = 0; i < state.expenses.length; i++) {
      if (state.expenses[i].id === expenseId) {
        var e = state.expenses[i];
        e.photoIds = (e.photoIds || []).filter(function (id) { return id !== photoId; });
        queueOp({ type: "put", id: e.id, data: e });
        break;
      }
    }
    save();
    trySyncSoon();
  }

  // Liefert das Foto als dataURL (lokal, Cache oder Firebase) — oder null.
  function fetchPhoto(photoId) {
    if (photoStore[photoId]) return Promise.resolve(photoStore[photoId]);
    if (photoCache[photoId]) return Promise.resolve(photoCache[photoId]);
    if (!syncConfigured()) return Promise.resolve(null);
    return fetch(tripPath("photos/" + encodeURIComponent(photoId)))
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        var url = data && data.data ? data.data : null;
        if (url) photoCache[photoId] = url;
        return url;
      })
      .catch(function () { return null; });
  }

  // Alle Fotos der Reise, neueste zuerst, mit zugehörigem Eintrag.
  function allPhotoRefs() {
    var refs = [];
    state.expenses.forEach(function (e) {
      (e.photoIds || []).forEach(function (pid) { refs.push({ photoId: pid, expense: e }); });
    });
    return refs;
  }

  function daysBetween(a, b) {
    if (!a || !b) return 0;
    var d = (new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 86400000;
    return d > 0 ? Math.round(d) : 0;
  }

  function addDaysISO(iso, n) {
    var d = new Date(iso + "T12:00:00");
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }

  // Übernachtung über mehrere Nächte: Betrag durch Nächte teilen und
  // je Nacht einen Eintrag nach dem Muster des Originals anlegen.
  function addStay(exp) {
    var nights = daysBetween(exp.checkIn, exp.checkOut);
    if (nights < 2) {
      return [addExpense(Object.assign({}, exp, { date: exp.checkIn || exp.date }))];
    }
    var stayId = uid();
    var per = Math.round((exp.amount / nights) * 100) / 100;
    var rest = Math.round((exp.amount - per * nights) * 100) / 100; // Rundungsrest auf die 1. Nacht
    var created = [];
    for (var i = 0; i < nights; i++) {
      created.push(addExpense(Object.assign({}, exp, {
        amount: per + (i === 0 ? rest : 0),
        date: addDaysISO(exp.checkIn, i),
        stayId: stayId, stayIndex: i, stayNights: nights,
        stayTotal: exp.amount
      })));
    }
    return created;
  }

  function stayEntries(stayId) {
    return state.expenses.filter(function (e) { return e.stayId === stayId; });
  }

  function deleteStay(stayId) {
    stayEntries(stayId).forEach(function (e) { deleteExpense(e.id); });
  }

  // Aufenthalt bearbeiten: alte Nächte entfernen, neu verteilen, Fotos übernehmen
  function replaceStay(stayId, exp) {
    var old = stayEntries(stayId);
    var photos = [];
    old.forEach(function (e) { (e.photoIds || []).forEach(function (p) { photos.push(p); }); });
    deleteStay(stayId);
    var created = (daysBetween(exp.checkIn, exp.checkOut) >= 2)
      ? addStay(exp)
      : [addExpense(Object.assign({}, exp, { date: exp.checkIn || exp.date }))];
    if (photos.length && created[0]) {
      created[0].photoIds = photos;
      queueOp({ type: "put", id: created[0].id, data: created[0] });
      save();
      trySyncSoon();
    }
    return created;
  }

  function addExpense(exp) {
    var currentRate = state.rates[exp.currency] || 1;
    var entry = Object.assign({ id: uid() }, exp, {
      // "person" = wer BEZAHLT hat (im Formular wählbar), nicht wer eintippt.
      person: exp.person || state.sync.person || "Ich",
      shared: exp.shared !== false, // false = Einzelausgabe (nur dokumentiert)
      rateUsed: currentRate,
      baseAtEntry: state.trip.baseCurrency,
      createdAt: Date.now()
    });
    state.expenses.unshift(entry);
    queueOp({ type: "put", id: entry.id, data: entry });
    save();
    trySyncSoon();
    return entry;
  }

  // "Als bezahlt markieren": Ausgleichs-Zahlung von -> an, in Basiswährung.
  function addSettlement(from, to, amount) {
    var entry = {
      id: uid(), kind: "settlement",
      from: from, to: to, person: from,
      amount: amount, currency: state.trip.baseCurrency,
      category: "sonstiges", date: todayISO(), note: "",
      rateUsed: 1, baseAtEntry: state.trip.baseCurrency,
      shared: true, createdAt: Date.now()
    };
    state.expenses.unshift(entry);
    queueOp({ type: "put", id: entry.id, data: entry });
    state.lastSettleReminder = Date.now();
    save();
    trySyncSoon();
    return entry;
  }

  function updateExpense(id, changes) {
    var idx = -1;
    for (var i = 0; i < state.expenses.length; i++) {
      if (state.expenses[i].id === id) { idx = i; break; }
    }
    if (idx === -1) return;
    var old = state.expenses[idx];
    var updated = Object.assign({}, old, changes);
    // Kurs-Schnappschuss: bleibt beim Original, AUSSER die Währung wurde
    // geändert — dann gilt der aktuelle Kurs der neuen Währung.
    if (changes.currency && changes.currency !== old.currency) {
      updated.rateUsed = state.rates[changes.currency] || 1;
      updated.baseAtEntry = state.trip.baseCurrency;
    }
    updated.editedAt = Date.now();
    state.expenses[idx] = updated;
    queueOp({ type: "put", id: id, data: updated });
    save();
    trySyncSoon();
  }

  function deleteExpense(id) {
    state.expenses.forEach(function (e) {
      if (e.id === id) {
        (e.photoIds || []).forEach(function (pid) {
          delete photoStore[pid]; delete photoCache[pid];
          if (syncConfigured()) state.pendingOps.push({ type: "photo-delete", id: pid });
        });
        savePhotoStore();
      }
    });
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

  /* Ausgleich: Annahme "alle teilen alles gleichmäßig".
     balance = selbst bezahlt − fairer Anteil (Gesamt / Personenzahl).
     Die Überweisungsliste gleicht Schuldner und Empfänger direkt aus. */
  function computeSettlement() {
    var base = state.trip.baseCurrency;
    var paidBy = {};
    var total = 0;
    state.expenses.forEach(function (e) {
      if (e.kind === "settlement") {
        var amt = convertExpense(e);
        paidBy[e.from] = (paidBy[e.from] || 0) + amt;
        paidBy[e.to] = (paidBy[e.to] || 0) - amt;
        return;
      }
      if (e.reimbursed) return;      // wird von außen bezahlt -> zählt nicht zwischen euch
      if (e.shared === false) return; // Einzelausgaben bleiben außen vor
      var p = e.person || "Ich";
      var v = convertExpense(e);
      paidBy[p] = (paidBy[p] || 0) + v;
      total += v;
    });
    var names = Object.keys(paidBy);
    if (names.length < 2) return null;

    var share = total / names.length;
    var persons = names.map(function (n) {
      return { name: n, paid: paidBy[n], share: share, balance: paidBy[n] - share };
    });

    // Schuldner (negativ) an Empfänger (positiv) verteilen
    var debtors = persons.filter(function (p) { return p.balance < -0.005; })
      .map(function (p) { return { name: p.name, amt: -p.balance }; })
      .sort(function (a, b) { return b.amt - a.amt; });
    var creditors = persons.filter(function (p) { return p.balance > 0.005; })
      .map(function (p) { return { name: p.name, amt: p.balance }; })
      .sort(function (a, b) { return b.amt - a.amt; });

    var transfers = [];
    var di = 0, ci = 0;
    while (di < debtors.length && ci < creditors.length) {
      var pay = Math.min(debtors[di].amt, creditors[ci].amt);
      transfers.push({ from: debtors[di].name, to: creditors[ci].name, amount: pay });
      debtors[di].amt -= pay;
      creditors[ci].amt -= pay;
      if (debtors[di].amt < 0.005) di++;
      if (creditors[ci].amt < 0.005) ci++;
    }

    return { persons: persons, transfers: transfers, total: total, share: share, base: base };
  }

  function computeDerived(personFilter, includeReimbursed) {
    var base = state.trip.baseCurrency;
    var allEntries = state.expenses.filter(function (e) {
      if (e.kind === "settlement") return false; // reine Geldflüsse, keine Ausgaben
      return !personFilter || personFilter === "all" || (e.person || "Ich") === personFilter;
    });
    // Erstattete Kosten sind Reisekosten, aber nicht unser Geld -> je nach Blickwinkel
    var expenses = includeReimbursed ? allEntries : allEntries.filter(function (e) { return !e.reimbursed; });
    var reimbursedTotal = 0;
    allEntries.forEach(function (e) { if (e.reimbursed) reimbursedTotal += convertExpense(e); });

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
    var firstEntry = dates.length ? dates[0] : null;
    var lastEntry = dates.length ? dates[dates.length - 1] : null;
    if (state.trip.startDate || firstEntry) {
      // Beginn: der frühere von Reisebeginn und erstem Eintrag
      // (vorab gebuchte Flüge o. Ä. sollen den Schnitt nicht verfälschen)
      var startISO = state.trip.startDate || firstEntry;
      if (firstEntry && firstEntry < startISO) startISO = firstEntry;
      // Ende: bis heute (bzw. Reiseende) — mindestens aber bis zum letzten Eintrag,
      // damit im Voraus verteilte Hotelnächte die Tage auch wirklich mitzählen.
      var todayI = todayISO();
      var capISO = (state.trip.endDate && todayI > state.trip.endDate) ? state.trip.endDate : todayI;
      var endISO = capISO;
      if (lastEntry && lastEntry > endISO) endISO = lastEntry;
      if (endISO < startISO) endISO = startISO;
      dayCount = Math.max(1, Math.round(
        (new Date(endISO + "T12:00:00") - new Date(startISO + "T12:00:00")) / 86400000) + 1);
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
      avgPerDay: avgPerDay, topCat: topCat, base: base, byPerson: byPerson,
      reimbursedTotal: reimbursedTotal
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
        var req;
        if (op.type === "photo-put") {
          var blob = photoStore[op.id];
          if (!blob) { // Foto existiert lokal nicht mehr — Op verwerfen
            state.pendingOps = state.pendingOps.filter(function (o) { return o !== op; });
            save();
            return;
          }
          req = fetch(tripPath("photos/" + encodeURIComponent(op.id)), {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: blob, createdAt: Date.now() })
          }).then(function (res) {
            if (!res.ok) throw new Error("photo op failed");
            state.pendingOps = state.pendingOps.filter(function (o) { return o !== op; });
            photoCache[op.id] = photoStore[op.id];
            delete photoStore[op.id]; // hochgeladen → lokalen Speicher freigeben
            savePhotoStore();
            save();
          });
          return req;
        }
        if (op.type === "photo-delete") {
          req = fetch(tripPath("photos/" + encodeURIComponent(op.id)), { method: "DELETE" })
            .then(function (res) {
              if (!res.ok) throw new Error("photo op failed");
              state.pendingOps = state.pendingOps.filter(function (o) { return o !== op; });
              save();
            });
          return req;
        }
        var url = tripPath("expenses/" + encodeURIComponent(op.id));
        req = op.type === "delete"
          ? fetch(url, { method: "DELETE" })
          : fetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(op.data) });
        return req.then(function (res) {
          if (!res.ok) throw new Error("op failed");
          state.pendingOps = state.pendingOps.filter(function (o) { return o !== op && !(o.id === op.id && (o.type === "put" || o.type === "delete")); });
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

  // Setzt die Themen-Klasse am <body>; "papier" ist der Standard ohne Klasse.
  function applyTheme() {
    var t = state.theme || "papier";
    document.body.className = t === "papier" ? "" : "theme-" + t;
  }

  /* ---------------- exposed API ---------------- */

  window.Reisekasse = {
    CATEGORIES: CATEGORIES, catFor: catFor, fmtMoney: fmtMoney, todayISO: todayISO,
    THEMES: [
      { id: "papier", label: "Papier", sw: ["#EEEADC", "#26241D", "#D6A24A"] },
      { id: "bordkarte", label: "Bordkarte", sw: ["#F7F6F2", "#191A1C", "#C2410C"] },
      { id: "nachtflug", label: "Nachtflug", sw: ["#101418", "#1A2027", "#F5B84B"] },
      { id: "sticker", label: "Sticker", sw: ["#FFF6E9", "#1D8A8A", "#F4A340"] },
      { id: "kassenbon", label: "Kassenbon", sw: ["#DCD9D2", "#FCFBF7", "#23211C"] }
    ],
    isOnboarded: function () { return !!state.onboarded; },
    getAvatar: function () { return state.avatar || ""; },
    setAvatar: function (a) { state.avatar = a || ""; save(); },
    appStats: function () {
      var trips = state.tripsDir.length;
      var entries = 0;
      var currencySet = {};
      state.tripsDir.forEach(function (t) {
        var exps;
        if (t.code === state.sync.tripCode) {
          exps = state.expenses;
        } else {
          try {
            var slice = JSON.parse(localStorage.getItem(tripSliceKey(t.code)) || "null");
            exps = (slice && slice.expenses) || [];
          } catch (e) { exps = []; }
        }
        exps.forEach(function (e) { entries++; currencySet[e.currency] = true; });
      });
      var photoCount = 0;
      state.tripsDir.forEach(function (t) {
        var exps;
        if (t.code === state.sync.tripCode) exps = state.expenses;
        else {
          try { exps = (JSON.parse(localStorage.getItem(tripSliceKey(t.code)) || "null") || {}).expenses || []; } catch (e) { exps = []; }
        }
        exps.forEach(function (e) { photoCount += (e.photoIds || []).length; });
      });
      return { trips: trips, entries: entries, currencies: Object.keys(currencySet), photos: photoCount };
    },
    listTrips: function () { return state.tripsDir.slice(); },
    tripSummaries: function () {
      return state.tripsDir.map(function (t) {
        var isActive = t.code === state.sync.tripCode;
        var slice = null;
        if (isActive) {
          slice = { trip: state.trip, expenses: state.expenses };
        } else {
          try { slice = JSON.parse(localStorage.getItem(tripSliceKey(t.code)) || "null"); } catch (e) { slice = null; }
        }
        var count = 0, total = 0, base = "EUR", start = "", end = "";
        if (slice) {
          base = (slice.trip && slice.trip.baseCurrency) || "EUR";
          start = (slice.trip && slice.trip.startDate) || "";
          end = (slice.trip && slice.trip.endDate) || "";
          (slice.expenses || []).forEach(function (e) {
            count++;
            total += (e.rateUsed != null ? e.amount * e.rateUsed : 0);
          });
        }
        return { code: t.code, name: t.name, dbUrl: t.dbUrl, active: isActive, count: count, total: total, base: base, startDate: start, endDate: end };
      });
    },
    activeTripCode: function () { return state.sync.tripCode; },
    switchTrip: switchTrip, createTrip: createTrip, joinTrip: joinTrip, shareLink: shareLink,
    addSettlement: addSettlement,
    renamePerson: function (oldName, newName) {
      oldName = (oldName || "").trim();
      newName = (newName || "").trim();
      if (!oldName || !newName || oldName === newName) return false;
      var changed = 0;
      state.expenses.forEach(function (e) {
        var touched = false;
        if ((e.person || "") === oldName) { e.person = newName; touched = true; }
        if (e.kind === "settlement") {
          if (e.from === oldName) { e.from = newName; touched = true; }
          if (e.to === oldName) { e.to = newName; touched = true; }
        }
        if (touched) { queueOp({ type: "put", id: e.id, data: e }); changed++; }
      });
      if ((state.sync.person || "") === oldName) state.sync.person = newName;
      save();
      if (changed) trySyncSoon();
      return changed > 0;
    },
    shouldRemindSettle: function () {
      var WEEK = 7 * 24 * 60 * 60 * 1000;
      if (!state.lastSettleReminder) {
        // Erster Kontakt: Uhr starten, noch nicht erinnern
        state.lastSettleReminder = Date.now();
        save();
        return false;
      }
      if (Date.now() - state.lastSettleReminder < WEEK) return false;
      var st = computeSettlement();
      if (!st) return false;
      return st.transfers.some(function (t) { return t.amount >= 1; });
    },
    snoozeSettleReminder: function () {
      state.lastSettleReminder = Date.now();
      save();
    },
    exportCsv: function () {
      function cell(v) {
        v = String(v == null ? "" : v);
        if (/[";\n]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
        return v;
      }
      var base = state.trip.baseCurrency;
      var rows = [["Datum", "Art", "Kategorie", "Bezahlt von", "An", "Geteilt", "Erstattet", "Betrag", "Währung", "Umgerechnet (" + base + ")", "Ort", "Notiz"].join(";")];
      state.expenses.slice().reverse().forEach(function (e) {
        var conv = convertExpense(e).toFixed(2).replace(".", ",");
        var amt = Number(e.amount).toFixed(2).replace(".", ",");
        if (e.kind === "settlement") {
          rows.push([e.date, "Ausgleich", "", cell(e.from), cell(e.to), "", "", amt, e.currency, conv, "", ""].join(";"));
        } else {
          rows.push([e.date, "Ausgabe", cell(catFor(e.category).label), cell(e.person || ""), "",
            e.shared === false ? "nein" : "ja", e.reimbursed ? "ja" : "nein",
            amt, e.currency, conv, cell(e.place || ""), cell(e.note || "")].join(";"));
        }
      });
      return "\uFEFF" + rows.join("\n");
    },
    deleteTrip: function (code) {
      var entry = dirEntry(code);
      if (!entry) return;
      // Lokale Foto-Blobs der Reise aufräumen
      var slice = null;
      if (code === state.sync.tripCode) {
        slice = { expenses: state.expenses };
      } else {
        try { slice = JSON.parse(localStorage.getItem(tripSliceKey(code)) || "null"); } catch (e) { slice = null; }
      }
      if (slice && slice.expenses) {
        slice.expenses.forEach(function (e) {
          (e.photoIds || []).forEach(function (pid) { delete photoStore[pid]; delete photoCache[pid]; });
        });
        savePhotoStore();
      }
      try { localStorage.removeItem(tripSliceKey(code)); } catch (e) {}
      state.tripsDir = state.tripsDir.filter(function (t) { return t.code !== code; });
      if (code === state.sync.tripCode) {
        // Aktive Reise gelöscht: nächste laden oder leeren Zustand herstellen
        if (state.tripsDir.length) {
          var next = state.tripsDir[0];
          var nslice = null;
          try { nslice = JSON.parse(localStorage.getItem(tripSliceKey(next.code)) || "null"); } catch (e) { nslice = null; }
          applySlice(nslice || freshSlice(next.name, next.dbUrl, next.code));
        } else {
          applySlice(freshSlice("Meine Reise", state.sync.dbUrl, ""));
          state.sync.tripCode = "";
        }
      }
      save();
      notifyUI(true);
    },
    shareText: function (code) {
      var entry = code ? dirEntry(code) : null;
      var c = entry ? entry.code : state.sync.tripCode;
      var name = entry ? entry.name : state.trip.name;
      var link = shareLink(code);
      if (!link || !c) return null;
      return "Komm in meine TripCash-Reise \u201E" + (name || "Reise") + "\u201C!\n\n" +
        "Code: " + c + "\n" +
        "(In der App: Reisename oben antippen \u2192 \u201EMit Code oder Link beitreten\u201C)\n\n" +
        "Falls deine App noch nie verbunden war, nimm stattdessen diesen Komplett-Link:\n" + link;
    },
    completeOnboarding: function (name) {
      name = (name || "").trim();
      if (name) state.sync.person = name;
      state.onboarded = true;
      save();
    },
    getTheme: function () { return state.theme || "papier"; },
    setTheme: function (t) {
      state.theme = t;
      save();
      applyTheme();
    },
    getState: function () { return state; },
    saveErrorFlag: function () { return saveError; },
    isSyncing: function () { return syncing; },
    addExpense: addExpense, deleteExpense: deleteExpense, updateExpense: updateExpense, convertExpense: convertExpense,
    addStay: addStay, deleteStay: deleteStay, replaceStay: replaceStay, stayEntries: stayEntries,
    stayTotal: function (stayId) {
      return stayEntries(stayId).reduce(function (sum, e) { return sum + e.amount; }, 0);
    },
    addPhoto: addPhoto, deletePhoto: deletePhoto, fetchPhoto: fetchPhoto, allPhotoRefs: allPhotoRefs, compressImage: compressImage,
    computeDerived: computeDerived, computeSettlement: computeSettlement, personsInData: personsInData,
    refreshRatesIfNeeded: refreshRatesIfNeeded, rateStatusText: rateStatusText,
    syncNow: syncNow, syncConfigured: syncConfigured, syncStatusText: syncStatusText,
    updateTrip: function (trip) {
      state.trip = Object.assign({}, trip, { updatedAt: Date.now() });
      var entry = null;
      for (var i = 0; i < state.tripsDir.length; i++) if (state.tripsDir[i].code === state.sync.tripCode) entry = state.tripsDir[i];
      if (entry) entry.name = state.trip.name;
      save();
      trySyncSoon();
    },
    updateRates: function (rates) { state.rates = rates; save(); },
    updateSync: function (syncCfg) {
      var wasConfigured = syncConfigured();
      state.sync = {
        dbUrl: (syncCfg.dbUrl || "").trim(),
        tripCode: (syncCfg.tripCode !== undefined ? (syncCfg.tripCode || "").trim() : state.sync.tripCode),
        person: (syncCfg.person || "").trim()
      };
      var entry = null;
      for (var i = 0; i < state.tripsDir.length; i++) if (state.tripsDir[i].code === state.sync.tripCode) entry = state.tripsDir[i];
      if (entry) entry.dbUrl = state.sync.dbUrl;
      else if (state.sync.tripCode) state.tripsDir.push({ code: state.sync.tripCode, name: state.trip.name || "Meine Reise", dbUrl: state.sync.dbUrl });
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
    applyTheme();
    // Bei jedem Start prüfen (force), sofern eine Verbindung besteht —
    // fetchLiveRates bricht bei Offline selbst sauber ab.
    refreshRatesIfNeeded(true).then(function () { notifyUI(); });
    if (syncConfigured()) syncNow();

    // Verbindung kommt zurück (z. B. Flugmodus aus): erneut versuchen.
    window.addEventListener("online", function () {
      refreshRatesIfNeeded(true).then(function () { notifyUI(); });
      if (syncConfigured()) syncNow();
    });

    // App wird aus dem Hintergrund wieder geöffnet: zählt auch als "Start".
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") {
        refreshRatesIfNeeded(true).then(function () { notifyUI(); });
        if (syncConfigured()) syncNow();
      }
    });

    // Quasi-Echtzeit: regelmäßig abgleichen, solange die App sichtbar ist.
    setInterval(function () {
      if (document.visibilityState === "visible" && syncConfigured() && navigator.onLine !== false && !syncing) {
        syncNow();
      }
    }, 20000);

    if (window.ReisekasseUI) window.ReisekasseUI.init();
  });
})();

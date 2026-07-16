/* Reisekasse — Darstellung. String-Templates + delegierte Events.
   Formularfelder in Modals sind bewusst "uncontrolled": beim Speichern
   wird aus dem DOM gelesen, damit Neu-Rendern nie das Tippen stört. */

(function () {
  "use strict";

  var R = window.Reisekasse;
  var appEl = document.getElementById("app");

  var ui = {
    tab: "overview",
    filterCat: "all",
    personFilter: "all",
    modal: null // "add" | "settings" | null
  };

  /* ---------------- icons ---------------- */

  function icon(name, size, color) {
    size = size || 18;
    color = color || "currentColor";
    var body = {
      utensils: '<path d="M6 2v7a2 2 0 0 0 4 0V2M8 9v13M17 2c-1.5 2-2 4-2 6s.5 4 2 5v7" />',
      car: '<path d="M4 16V11l2-5h10l2 5v5" /><rect x="3" y="16" width="18" height="4" rx="1.5" /><circle cx="7.5" cy="18.5" r="1.2" /><circle cx="16.5" cy="18.5" r="1.2" />',
      bed: '<path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6" /><path d="M3 18v2M21 18v2" /><path d="M3 12V7a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" /><path d="M13 10h6" />',
      bag: '<path d="M6 8h12l1 12H5L6 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" />',
      ticket: '<path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a1.5 1.5 0 0 0 0 3v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a1.5 1.5 0 0 0 0-3V8Z" /><path d="M10 6v12" stroke-dasharray="2 2" />',
      dots: '<circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" />',
      plus: '<path d="M12 5v14M5 12h14" />',
      x: '<path d="M6 6l12 12M18 6L6 18" />',
      trash: '<path d="M4 7h16" /><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /><path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />',
      settings: '<circle cx="12" cy="12" r="3" /><path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />',
      grid: '<rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="8" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /><rect x="13" y="13" width="8" height="8" rx="1.5" />',
      list: '<circle cx="4" cy="6" r="1.3" /><circle cx="4" cy="12" r="1.3" /><circle cx="4" cy="18" r="1.3" /><path d="M9 6h11M9 12h11M9 18h11" />',
      plane: '<path d="M3 12l18-8-7 18-2.5-7L3 12Z" />',
      calendar: '<rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" />',
      wallet: '<rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18" /><circle cx="17" cy="14" r="1.3" />',
      check: '<path d="M5 12l5 5L20 7" />',
      person: '<circle cx="12" cy="8" r="3.5" /><path d="M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5" />',
      refresh: '<path d="M20 11a8 8 0 1 0-2.3 6.3" /><path d="M20 5v6h-6" />'
    }[name] || "";
    return '<svg class="icon" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + body + "</svg>";
  }

  /* ---------------- charts ---------------- */

  function polar(cx, cy, r, angleDeg) {
    var a = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  }

  function donutChart(byCat, size) {
    size = size || 140;
    var cx = size / 2, cy = size / 2, outerR = size * 0.44, innerR = size * 0.27;
    var total = byCat.reduce(function (s, c) { return s + c.value; }, 0);
    if (total <= 0) return "";
    var angle = 0;
    var paths = byCat.map(function (c) {
      var sweep = (c.value / total) * 360;
      var start = angle, end = angle + Math.max(sweep, 0.75);
      angle += sweep;
      var large = end - start > 180 ? 1 : 0;
      var p1 = polar(cx, cy, outerR, start), p2 = polar(cx, cy, outerR, end);
      var p3 = polar(cx, cy, innerR, end), p4 = polar(cx, cy, innerR, start);
      var d = "M " + p1.x.toFixed(2) + " " + p1.y.toFixed(2) +
        " A " + outerR + " " + outerR + " 0 " + large + " 1 " + p2.x.toFixed(2) + " " + p2.y.toFixed(2) +
        " L " + p3.x.toFixed(2) + " " + p3.y.toFixed(2) +
        " A " + innerR + " " + innerR + " 0 " + large + " 0 " + p4.x.toFixed(2) + " " + p4.y.toFixed(2) + " Z";
      return '<path d="' + d + '" fill="' + c.color + '" stroke="#EEEADC" stroke-width="2" />';
    }).join("");
    return '<svg viewBox="0 0 ' + size + " " + size + '" width="100%" height="100%">' + paths + "</svg>";
  }

  function barChart(byDay, base) {
    var barW = 26, gap = 14, height = 130, padTop = 10, padBottom = 22;
    var max = Math.max.apply(null, byDay.map(function (d) { return d.value; }).concat([0.01]));
    var width = byDay.length * (barW + gap) + gap;
    var bars = byDay.map(function (d, i) {
      var h = Math.max(2, (d.value / max) * (height - padTop - padBottom));
      var x = gap + i * (barW + gap);
      var y = height - padBottom - h;
      return '<rect x="' + x + '" y="' + y + '" width="' + barW + '" height="' + h + '" rx="4" fill="#2B4C7E">' +
        '<title>' + d.date + ": " + R.fmtMoney(d.value, base) + '</title></rect>' +
        '<text x="' + (x + barW / 2) + '" y="' + (height - 6) + '" font-size="9" fill="#26241D" text-anchor="middle" font-family="Inter, sans-serif">' + d.date + '</text>';
    }).join("");
    return '<div style="overflow-x:auto"><svg viewBox="0 0 ' + width + " " + height + '" width="' + Math.max(width, 260) + '" height="' + height + '">' + bars + "</svg></div>";
  }

  /* ---------------- screens ---------------- */

  function render() {
    var s = R.getState();
    appEl.innerHTML =
      renderHeader(s) +
      '<div class="app-main">' + (ui.tab === "overview" ? renderOverview(s) : renderList(s)) + "</div>" +
      renderBottomNav() +
      (ui.modal === "add" ? renderAddModal(s) : "") +
      (ui.modal === "settings" ? renderSettingsModal(s) : "");
    bindEvents(s);
  }

  function headerSubText(s) {
    return s.trip.baseCurrency + " · " + R.rateStatusText() + " · " + R.syncStatusText() +
      (R.saveErrorFlag() ? " · Speichern fehlgeschlagen" : "");
  }

  function rerenderStatus() {
    var s = R.getState();
    var sub = document.getElementById("header-sub");
    if (sub) sub.textContent = headerSubText(s);
    var st = document.getElementById("sync-status-text");
    if (st) st.textContent = R.syncStatusText();
    var rt = document.getElementById("rate-status-text");
    if (rt) rt.textContent = R.rateStatusText();
  }

  function renderHeader(s) {
    return '<div class="app-header">' +
      '<div style="display:flex;align-items:center;gap:10px;min-width:0">' +
      icon("plane", 20, "#D6A24A") +
      '<div style="min-width:0">' +
      '<div class="title display">' + escapeHtml(s.trip.name || "Meine Reise") + "</div>" +
      '<div class="sub" id="header-sub">' + escapeHtml(headerSubText(s)) + "</div>" +
      "</div></div>" +
      '<button class="icon-btn" data-action="open-settings" aria-label="Einstellungen">' + icon("settings", 20) + "</button>" +
      "</div>";
  }

  function renderBottomNav() {
    function item(id, label, name) {
      return '<button class="nav-item' + (ui.tab === id ? " active" : "") + '" data-action="set-tab" data-tab="' + id + '">' +
        icon(name, 20) + "<span>" + label + "</span></button>";
    }
    return '<div class="bottom-nav">' +
      item("overview", "Übersicht", "grid") +
      '<button class="fab" data-action="open-add" aria-label="Ausgabe hinzufügen">' + icon("plus", 26, "#FBF9F2") + "</button>" +
      item("list", "Ausgaben", "list") +
      "</div>";
  }

  function personPills(persons, active, action) {
    if (persons.length < 2) return "";
    var pills = '<button class="pill' + (active === "all" ? " active" : "") + '" style="--pill-color:#26241D" data-action="' + action + '" data-person="all">Alle</button>';
    persons.forEach(function (p) {
      pills += '<button class="pill' + (active === p ? " active" : "") + '" style="--pill-color:#2B4C7E" data-action="' + action + '" data-person="' + escapeAttr(p) + '">' + escapeHtml(p) + "</button>";
    });
    return '<div class="pill-row">' + pills + "</div>";
  }

  function renderOverview(s) {
    var persons = R.personsInData();
    var d = R.computeDerived(ui.personFilter);
    var html = personPills(persons, ui.personFilter, "person-filter");

    html += '<div class="stat-row">' +
      statStub("Gesamt" + (ui.personFilter !== "all" ? " (" + escapeHtml(ui.personFilter) + ")" : ""), R.fmtMoney(d.totalBase, d.base), "wallet") +
      statStub("⌀ pro Tag (" + d.dayCount + "T)", R.fmtMoney(d.avgPerDay, d.base), "calendar") +
      "</div>";

    // Pro-Kopf-Aufteilung (nur wenn mehrere Personen und "Alle" aktiv)
    var personKeys = Object.keys(d.byPerson);
    if (ui.personFilter === "all" && personKeys.length > 1) {
      var rows = personKeys.map(function (p) {
        return '<div class="legend-row">' + icon("person", 13) +
          '<span class="legend-label">' + escapeHtml(p) + "</span>" +
          '<span class="mono">' + R.fmtMoney(d.byPerson[p], d.base) + "</span></div>";
      }).join("");
      html += '<div class="stub card-gap"><div class="section-title display">Pro Person</div>' + rows + "</div>";
    }

    if (d.topCat) {
      html += '<div class="stub card-gap" style="font-size:13px">Größter Posten: <strong>' + escapeHtml(d.topCat.label) +
        "</strong> mit " + R.fmtMoney(d.topCat.value, d.base) + " (" + Math.round((d.topCat.value / d.totalBase) * 100) + "%)</div>";
    }

    if (d.byCat.length > 0) {
      var legend = d.byCat.slice().sort(function (a, b) { return b.value - a.value; }).map(function (c) {
        return '<div class="legend-row"><span class="legend-dot" style="background:' + c.color + '"></span>' +
          '<span class="legend-label">' + escapeHtml(c.label) + '</span>' +
          '<span class="mono">' + R.fmtMoney(c.value, d.base) + "</span></div>";
      }).join("");
      html += '<div class="stub card-gap"><div class="section-title display">Nach Kategorie</div>' +
        '<div style="display:flex;align-items:center;gap:12px">' +
        '<div style="width:130px;height:130px;flex-shrink:0">' + donutChart(d.byCat, 130) + "</div>" +
        '<div style="flex:1;display:flex;flex-direction:column">' + legend + "</div>" +
        "</div></div>";
    } else {
      html += '<div class="stub empty-hint">Noch keine Ausgaben — tippe unten auf das + und leg los.</div>';
    }

    if (d.byDay.length > 0) {
      html += '<div class="stub"><div class="section-title display">Verlauf pro Tag</div>' + barChart(d.byDay, d.base) + "</div>";
    }

    return html;
  }

  function statStub(label, value, name) {
    return '<div class="stub stat-stub"><div class="label">' + icon(name, 13) + " " + label + '</div><div class="value mono">' + value + "</div></div>";
  }

  function renderList(s) {
    var persons = R.personsInData();
    var expenses = s.expenses.filter(function (e) {
      var catOk = ui.filterCat === "all" || e.category === ui.filterCat;
      var personOk = ui.personFilter === "all" || (e.person || "Ich") === ui.personFilter;
      return catOk && personOk;
    });

    var html = personPills(persons, ui.personFilter, "person-filter");

    html += '<div class="pill-row">' +
      '<button class="pill' + (ui.filterCat === "all" ? " active" : "") + '" style="--pill-color:#26241D" data-action="filter" data-cat="all">Alle</button>' +
      R.CATEGORIES.map(function (c) {
        return '<button class="pill' + (ui.filterCat === c.id ? " active" : "") + '" style="--pill-color:' + c.color + '" data-action="filter" data-cat="' + c.id + '">' + escapeHtml(c.label) + "</button>";
      }).join("") + "</div>";

    if (expenses.length === 0) {
      return html + '<div class="stub empty-hint">Keine Ausgaben mit diesen Filtern.</div>';
    }

    var multiPerson = persons.length > 1;
    html += expenses.map(function (e) {
      var cat = R.catFor(e.category);
      var converted = R.convertExpense(e);
      var sub = e.currency !== s.trip.baseCurrency
        ? '<div class="sub mono">≈ ' + R.fmtMoney(converted, s.trip.baseCurrency) + "</div>" : "";
      var meta = escapeHtml(e.date) +
        (multiPerson ? " · " + escapeHtml(e.person || "Ich") : "") +
        (e.note ? " · " + escapeHtml(e.note) : "");
      return '<div class="stub expense-row">' +
        '<div class="expense-icon" style="background:' + cat.color + '22">' + icon(cat.icon, 17, cat.color) + "</div>" +
        '<div class="expense-info"><div class="expense-cat">' + escapeHtml(cat.label) + '</div>' +
        '<div class="expense-meta">' + meta + "</div></div>" +
        '<div class="expense-amount"><div class="main mono">' + R.fmtMoney(e.amount, e.currency) + "</div>" + sub + "</div>" +
        '<button class="del-btn" data-action="delete" data-id="' + escapeAttr(e.id) + '" aria-label="Löschen">' + icon("trash", 16) + "</button>" +
        "</div>";
    }).join("");

    return html;
  }

  /* ---------------- modals ---------------- */

  var addFormCat = R.CATEGORIES[0].id;

  function renderAddModal(s) {
    var currencies = Object.keys(s.rates);
    var catChips = R.CATEGORIES.map(function (c) {
      return '<button type="button" class="cat-chip' + (addFormCat === c.id ? " active" : "") + '" style="--chip-color:' + c.color + '" data-action="pick-cat" data-cat="' + c.id + '">' + icon(c.icon, 14) + " " + escapeHtml(c.label) + "</button>";
    }).join("");

    var personHint = s.sync.person
      ? '<div class="hint">Wird eingetragen für: <strong>' + escapeHtml(s.sync.person) + "</strong></div>"
      : "";

    return modalShell("Neue Ausgabe",
      '<div class="field-row">' +
      '<div class="field" style="flex:1.2"><label>Betrag</label><input id="f-amount" type="number" inputmode="decimal" placeholder="0.00" autofocus /></div>' +
      '<div class="field" style="flex:1"><label>Währung</label><select id="f-currency">' +
      currencies.map(function (c) { return '<option value="' + c + '"' + (c === s.trip.baseCurrency ? " selected" : "") + ">" + c + "</option>"; }).join("") +
      "</select></div></div>" +
      '<div class="field"><label>Kategorie</label><div class="cat-grid" id="cat-grid">' + catChips + "</div></div>" +
      '<div class="field"><label>Datum</label><input id="f-date" type="date" value="' + R.todayISO() + '" /></div>' +
      '<div class="field"><label>Notiz (optional)</label><input id="f-note" type="text" placeholder="z. B. Streetfood in Hanoi" /></div>' +
      personHint +
      '<button class="btn-primary" data-action="save-expense">' + icon("check", 16, "#FBF9F2") + " Speichern</button>"
    );
  }

  function renderSettingsModal(s) {
    var currencies = Object.keys(s.rates);
    return modalShell("Einstellungen",
      '<div class="field"><label>Reisename</label><input id="s-name" type="text" value="' + escapeAttr(s.trip.name) + '" /></div>' +
      '<div class="field-row">' +
      '<div class="field"><label>Start</label><input id="s-start" type="date" value="' + escapeAttr(s.trip.startDate) + '" /></div>' +
      '<div class="field"><label>Ende (optional)</label><input id="s-end" type="date" value="' + escapeAttr(s.trip.endDate) + '" /></div>' +
      "</div>" +
      '<div class="field"><label>Basiswährung</label><select id="s-base">' +
      currencies.map(function (c) { return '<option value="' + c + '"' + (c === s.trip.baseCurrency ? " selected" : "") + ">" + c + "</option>"; }).join("") +
      "</select></div>" +

      // --- Sync ---
      '<div class="stub" style="padding:14px 14px 14px 20px">' +
      '<div class="section-title display" style="margin-bottom:4px">Gemeinsame Reisekasse</div>' +
      '<div class="hint" style="margin:0 0 10px">Damit zwei Handys dieselben Daten sehen: unten die Datenbank-Adresse aus der Anleitung, einen gemeinsamen Reise-Code (auf beiden Geräten exakt gleich) und deinen Namen eintragen.</div>' +
      '<div class="field" style="margin-bottom:8px"><label>Datenbank-Adresse (Firebase-URL)</label><input id="s-dburl" type="url" placeholder="https://…firebasedatabase.app" value="' + escapeAttr(s.sync.dbUrl) + '" /></div>' +
      '<div class="field-row" style="margin-bottom:8px">' +
      '<div class="field"><label>Reise-Code</label><input id="s-tripcode" type="text" placeholder="z. B. bali2026-x7k9" value="' + escapeAttr(s.sync.tripCode) + '" /></div>' +
      '<div class="field"><label>Mein Name</label><input id="s-person" type="text" placeholder="z. B. Anna" value="' + escapeAttr(s.sync.person) + '" /></div>' +
      "</div>" +
      '<div style="display:flex;align-items:center;gap:10px">' +
      '<div style="flex:1;font-size:12px;font-weight:600" id="sync-status-text">' + R.syncStatusText() + "</div>" +
      '<button class="btn-secondary" data-action="sync-now" id="sync-btn">' + icon("refresh", 14) + "&nbsp;Jetzt syncen</button>" +
      "</div></div>" +

      // --- Kurse ---
      '<div class="stub rate-status">' +
      '<div class="info"><div class="title" id="rate-status-text">' + R.rateStatusText() + '</div>' +
      '<div class="desc">Wird jeden Morgen automatisch geprüft, sobald Internet da ist.</div></div>' +
      '<button class="btn-secondary" data-action="refresh-rates" id="refresh-btn">Jetzt prüfen</button>' +
      "</div>" +
      '<div class="field"><label>Wechselkurse → 1 Einheit = X ' + escapeHtml(s.trip.baseCurrency) + '</label>' +
      '<div class="rate-list" id="rate-list">' + rateRows(s) + "</div>" +
      '<div class="add-currency-row"><input id="new-code" type="text" placeholder="Neuer Code, z. B. LKR" />' +
      '<button class="btn-secondary" data-action="add-currency">' + icon("plus", 16) + "</button></div>" +
      '<div class="hint">Automatisch aktualisierte Kurse gelten <strong>nur für neue Einträge</strong> ab jetzt. ' +
      "Bereits erfasste Ausgaben behalten den Kurs, der beim Speichern galt — sie ändern sich nachträglich nie.</div>" +
      "</div>" +
      '<button class="btn-primary" data-action="save-settings">' + icon("check", 16, "#FBF9F2") + " Übernehmen</button>"
    );
  }

  function rateRows(s) {
    return Object.keys(s.rates).map(function (c) {
      return '<div class="rate-row"><span class="code mono">' + c + '</span>' +
        '<input type="number" step="0.0001" data-code="' + c + '" value="' + s.rates[c] + '"' + (c === s.trip.baseCurrency ? " disabled" : "") + " /></div>";
    }).join("");
  }

  function modalShell(title, body) {
    return '<div class="modal-backdrop" data-action="backdrop">' +
      '<div class="modal-sheet">' +
      '<div class="modal-head"><div class="display">' + escapeHtml(title) + '</div>' +
      '<button class="icon-btn" style="color:#26241D" data-action="close-modal">' + icon("x", 20) + "</button></div>" +
      body + "</div></div>";
  }

  /* ---------------- helpers ---------------- */

  function escapeHtml(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function escapeAttr(str) { return escapeHtml(str); }

  /* ---------------- events ---------------- */

  function bindEvents(s) {
    appEl.querySelectorAll("[data-action]").forEach(function (el) {
      el.addEventListener("click", function (evt) {
        var action = el.getAttribute("data-action");

        if (action === "backdrop") {
          if (evt.target === el) { ui.modal = null; render(); }
          return;
        }
        if (action === "close-modal") { ui.modal = null; render(); return; }
        if (action === "set-tab") { ui.tab = el.getAttribute("data-tab"); render(); return; }
        if (action === "open-add") { addFormCat = R.CATEGORIES[0].id; ui.modal = "add"; render(); return; }
        if (action === "open-settings") { ui.modal = "settings"; render(); return; }
        if (action === "filter") { ui.filterCat = el.getAttribute("data-cat"); render(); return; }
        if (action === "person-filter") { ui.personFilter = el.getAttribute("data-person"); render(); return; }
        if (action === "delete") { R.deleteExpense(el.getAttribute("data-id")); render(); return; }

        if (action === "pick-cat") {
          addFormCat = el.getAttribute("data-cat");
          document.querySelectorAll("#cat-grid .cat-chip").forEach(function (chip) {
            chip.classList.toggle("active", chip.getAttribute("data-cat") === addFormCat);
          });
          return;
        }

        if (action === "save-expense") {
          var amount = parseFloat(document.getElementById("f-amount").value);
          if (!(amount > 0)) return;
          R.addExpense({
            amount: amount,
            currency: document.getElementById("f-currency").value,
            category: addFormCat,
            date: document.getElementById("f-date").value || R.todayISO(),
            note: document.getElementById("f-note").value.trim()
          });
          ui.modal = null;
          render();
          return;
        }

        if (action === "add-currency") {
          var codeInput = document.getElementById("new-code");
          var code = codeInput.value.trim().toUpperCase();
          if (!code) return;
          var st = R.getState();
          if (!st.rates[code]) {
            st.rates[code] = 1;
            document.getElementById("rate-list").innerHTML = rateRows(st);
          }
          codeInput.value = "";
          return;
        }

        if (action === "refresh-rates") {
          var btn = document.getElementById("refresh-btn");
          btn.disabled = true; btn.textContent = "…";
          R.refreshRatesIfNeeded(true).then(function () {
            var st2 = R.getState();
            var rl = document.getElementById("rate-list");
            if (rl) rl.innerHTML = rateRows(st2);
            btn.disabled = false; btn.textContent = "Jetzt prüfen";
            rerenderStatus();
          });
          return;
        }

        if (action === "sync-now") {
          // Erst die aktuell eingetippten Sync-Felder übernehmen, dann syncen
          applySyncFieldsFromForm();
          var sbtn = document.getElementById("sync-btn");
          if (sbtn) { sbtn.disabled = true; }
          R.syncNow().then(function () {
            var sb = document.getElementById("sync-btn");
            if (sb) sb.disabled = false;
            rerenderStatus();
          });
          return;
        }

        if (action === "save-settings") {
          var st3 = R.getState();
          var name = document.getElementById("s-name").value.trim() || "Meine Reise";
          var baseCurrency = document.getElementById("s-base").value;
          var startDate = document.getElementById("s-start").value;
          var endDate = document.getElementById("s-end").value;
          var newRates = {};
          document.querySelectorAll("#rate-list input[data-code]").forEach(function (inp) {
            var v = parseFloat(inp.value);
            newRates[inp.getAttribute("data-code")] = isNaN(v) || v <= 0 ? 1 : v;
          });
          newRates[baseCurrency] = 1;
          R.updateTrip({ name: name, baseCurrency: baseCurrency, startDate: startDate, endDate: endDate });
          R.updateRates(newRates);
          applySyncFieldsFromForm();
          ui.modal = null;
          render();
          return;
        }
      });
    });
  }

  function applySyncFieldsFromForm() {
    var dbEl = document.getElementById("s-dburl");
    var codeEl = document.getElementById("s-tripcode");
    var personEl = document.getElementById("s-person");
    if (!dbEl || !codeEl || !personEl) return;
    R.updateSync({ dbUrl: dbEl.value, tripCode: codeEl.value, person: personEl.value });
  }

  window.ReisekasseUI = { init: render, rerender: render, rerenderStatus: rerenderStatus };
})();

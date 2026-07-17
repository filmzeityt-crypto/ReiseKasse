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
    modal: null, // "add" | "settings" | "gallery" | null
    photoView: null, // photoId für Vollbild-Ansicht
    onboardStep: 0,
    obJoinMode: false
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
      refresh: '<path d="M20 11a8 8 0 1 0-2.3 6.3" /><path d="M20 5v6h-6" />',
      camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" /><circle cx="12" cy="13.5" r="3.5" />',
      image: '<rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.6" /><path d="M21 16l-5.5-5.5L7 19" />',
      pin: '<path d="M12 21s-6.5-5.4-6.5-10A6.5 6.5 0 0 1 12 4.5 6.5 6.5 0 0 1 18.5 11c0 4.6-6.5 10-6.5 10Z" /><circle cx="12" cy="11" r="2.3" />'
    }[name] || "";
    return '<svg class="icon" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" style="stroke:' + color + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + body + "</svg>";
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

    // Sonderfall: nur eine Kategorie → voller Ring. Ein 360°-Bogen
    // degeneriert in SVG zu nichts, deshalb hier als Kreis mit dicker
    // Kontur zeichnen.
    if (byCat.length === 1) {
      var ringR = (outerR + innerR) / 2;
      var ringW = outerR - innerR;
      return '<svg viewBox="0 0 ' + size + " " + size + '" width="100%" height="100%">' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + ringR + '" fill="none" stroke="' +
        byCat[0].color + '" stroke-width="' + ringW + '" /></svg>';
    }

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
      return '<path d="' + d + '" fill="' + c.color + '" style="stroke:var(--paper)" stroke-width="2" />';
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
      return '<rect x="' + x + '" y="' + y + '" width="' + barW + '" height="' + h + '" rx="4" style="fill:var(--blue)">' +
        '<title>' + d.date + ": " + R.fmtMoney(d.value, base) + '</title></rect>' +
        '<text x="' + (x + barW / 2) + '" y="' + (height - 6) + '" font-size="9" style="fill:var(--ink)" text-anchor="middle" font-family="inherit">' + d.date + '</text>';
    }).join("");
    return '<div style="overflow-x:auto"><svg viewBox="0 0 ' + width + " " + height + '" width="' + Math.max(width, 260) + '" height="' + height + '">' + bars + "</svg></div>";
  }

  /* ---------------- screens ---------------- */

  function render() {
    var s = R.getState();
    if (!R.isOnboarded()) {
      appEl.innerHTML = renderOnboarding(s);
      bindEvents(s);
      return;
    }
    appEl.innerHTML =
      renderHeader(s) +
      '<div class="app-main">' + (ui.tab === "overview" ? renderOverview(s) : renderList(s)) + "</div>" +
      renderBottomNav() +
      (ui.modal === "add" ? renderAddModal(s) : "") +
      (ui.modal === "settings" ? renderSettingsModal(s) : "") +
      (ui.modal === "gallery" ? renderGalleryModal(s) : "") +
      (ui.modal === "trips" ? renderTripsModal(s) : "") +
      (ui.photoView ? renderPhotoViewer(s) : "");
    bindEvents(s);
    if (ui.modal === "add") loadFormThumbs();
    if (ui.modal === "gallery") loadGalleryThumbs();
    if (ui.photoView) loadViewerPhoto();
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
      icon("wallet", 20, "var(--gold)") +
      '<div style="min-width:0">' +
      '<button class="title display trip-switch" data-action="open-trips">' + escapeHtml(s.trip.name || "Meine Reise") + " " + icon("chevdown", 14) + "</button>" +
      '<div class="sub" id="header-sub">' + escapeHtml(headerSubText(s)) + "</div>" +
      "</div></div>" +
      '<div style="display:flex;gap:2px">' +
      '<button class="icon-btn" data-action="open-gallery" aria-label="Galerie">' + icon("image", 20) + "</button>" +
      '<button class="icon-btn" data-action="open-settings" aria-label="Einstellungen">' + icon("settings", 20) + "</button>" +
      "</div></div>";
  }

  function renderBottomNav() {
    function item(id, label, name) {
      return '<button class="nav-item' + (ui.tab === id ? " active" : "") + '" data-action="set-tab" data-tab="' + id + '">' +
        icon(name, 20) + "<span>" + label + "</span></button>";
    }
    return '<div class="bottom-nav">' +
      item("overview", "Übersicht", "grid") +
      '<button class="fab" data-action="open-add" aria-label="Ausgabe hinzufügen">' + icon("plus", 26, "var(--btn-fg)") + "</button>" +
      item("list", "Ausgaben", "list") +
      "</div>";
  }

  function personPills(persons, active, action) {
    if (persons.length < 2) return "";
    var pills = '<button class="pill' + (active === "all" ? " active" : "") + '" style="--pill-color:var(--ink)" data-action="' + action + '" data-person="all">Alle</button>';
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

    // Ausgleich (nur wenn mehrere Personen und "Alle" aktiv)
    var settlement = R.computeSettlement();
    if (ui.personFilter === "all" && settlement) {
      var rows = settlement.persons.map(function (p) {
        var diff = p.balance;
        var diffTxt = Math.abs(diff) < 0.005 ? "ausgeglichen"
          : (diff > 0 ? "bekommt " : "schuldet ") + R.fmtMoney(Math.abs(diff), settlement.base);
        var diffColor = Math.abs(diff) < 0.005 ? "#8A8578" : (diff > 0 ? "#3F7A6E" : "#C24B3B");
        return '<div class="legend-row">' + icon("person", 13) +
          '<span class="legend-label">' + escapeHtml(p.name) +
          ' <span style="opacity:.55">· gezahlt ' + R.fmtMoney(p.paid, settlement.base) + "</span></span>" +
          '<span class="mono" style="color:' + diffColor + ';font-weight:600">' + diffTxt + "</span></div>";
      }).join("");

      var transfers = settlement.transfers.length
        ? settlement.transfers.map(function (t) {
            return '<div style="margin-top:8px;padding:10px 12px;border-radius:10px;background:#3F7A6E14;border:1px solid #3F7A6E33;font-size:13px;text-align:center">' +
              "<strong>" + escapeHtml(t.from) + "</strong> gibt <strong>" + escapeHtml(t.to) + "</strong> " +
              '<span class="mono" style="font-weight:600">' + R.fmtMoney(t.amount, settlement.base) + "</span></div>";
          }).join("")
        : '<div class="hint" style="margin-top:8px;text-align:center">Ihr seid quitt 🎉</div>';

      html += '<div class="stub card-gap"><div class="section-title display">Ausgleich</div>' +
        rows + transfers +
        '<div class="hint" style="margin-top:8px">Annahme: Alle Ausgaben werden gleichmäßig geteilt (fairer Anteil: ' +
        R.fmtMoney(settlement.share, settlement.base) + " pro Person).</div></div>";
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
      '<button class="pill' + (ui.filterCat === "all" ? " active" : "") + '" style="--pill-color:var(--ink)" data-action="filter" data-cat="all">Alle</button>' +
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
        (e.place ? " · " + escapeHtml(e.place) : "") +
        (e.note ? " · " + escapeHtml(e.note) : "");
      var photoBadge = (e.photoIds && e.photoIds.length)
        ? '<span class="photo-badge">' + icon("image", 10) + e.photoIds.length + "</span>" : "";
      return '<div class="stub expense-row" style="--cat:' + cat.color + '" data-action="edit-expense" data-id="' + escapeAttr(e.id) + '">' +
        '<div class="expense-icon" style="background:' + cat.color + '22">' + icon(cat.icon, 17, cat.color) + "</div>" +
        '<div class="expense-info"><div class="expense-cat">' + escapeHtml(cat.label) + photoBadge + '</div>' +
        '<div class="expense-meta">' + meta + "</div></div>" +
        '<div class="expense-amount"><div class="main mono">' + R.fmtMoney(e.amount, e.currency) + "</div>" + sub + "</div>" +
        '<button class="del-btn" data-action="delete" data-id="' + escapeAttr(e.id) + '" aria-label="Löschen">' + icon("trash", 16) + "</button>" +
        "</div>";
    }).join("");

    return html;
  }

  /* ---------------- modals ---------------- */

  var addFormCat = R.CATEGORIES[0].id;
  var addFormPerson = null;
  var editingId = null;
  var pendingNewPhotos = []; // Fotos, die vor dem Speichern eines NEUEN Eintrags gewählt wurden
  var obNameDraft = null; // Name aus dem Onboarding, bis zum Abschluss gemerkt

  function findExpense(s, id) {
    for (var i = 0; i < s.expenses.length; i++) if (s.expenses[i].id === id) return s.expenses[i];
    return null;
  }

  function renderAddModal(s) {
    var editing = editingId ? findExpense(s, editingId) : null;
    var currencies = Object.keys(s.rates);
    var selCurrency = editing ? editing.currency : s.trip.baseCurrency;

    var catChips = R.CATEGORIES.map(function (c) {
      return '<button type="button" class="cat-chip' + (addFormCat === c.id ? " active" : "") + '" style="--chip-color:' + c.color + '" data-action="pick-cat" data-cat="' + c.id + '">' + icon(c.icon, 14) + " " + escapeHtml(c.label) + "</button>";
    }).join("");

    // "Bezahlt von": bekannte Personen als Auswahl + Feld für einen anderen Namen
    var persons = R.personsInData();
    var personChips = persons.map(function (p) {
      return '<button type="button" class="cat-chip' + (addFormPerson === p ? " active" : "") + '" style="--chip-color:#2B4C7E" data-action="pick-person" data-person="' + escapeAttr(p) + '">' + icon("person", 14) + " " + escapeHtml(p) + "</button>";
    }).join("");
    personChips += '<button type="button" class="cat-chip' + (addFormPerson === "__other__" ? " active" : "") + '" style="--chip-color:#8A8578" data-action="pick-person" data-person="__other__">' + icon("plus", 14) + " Anderer…</button>";

    return modalShell(editing ? "Ausgabe bearbeiten" : "Neue Ausgabe",
      '<div class="field-row">' +
      '<div class="field" style="flex:1.2"><label>Betrag</label><input id="f-amount" type="number" inputmode="decimal" placeholder="0.00" value="' + (editing ? editing.amount : "") + '"' + (editing ? "" : " autofocus") + ' /></div>' +
      '<div class="field" style="flex:1"><label>Währung</label><select id="f-currency">' +
      currencies.map(function (c) { return '<option value="' + c + '"' + (c === selCurrency ? " selected" : "") + ">" + c + "</option>"; }).join("") +
      "</select></div></div>" +
      '<div class="field"><label>Kategorie</label><div class="cat-grid" id="cat-grid">' + catChips + "</div></div>" +
      '<div class="field"><label>Bezahlt von</label><div class="cat-grid" id="person-grid">' + personChips + "</div>" +
      '<input id="f-person-custom" type="text" placeholder="Name eintippen" style="margin-top:6px;display:' + (addFormPerson === "__other__" ? "block" : "none") + '" /></div>' +
      '<div class="field"><label>Datum</label><input id="f-date" type="date" value="' + (editing ? escapeAttr(editing.date) : R.todayISO()) + '" /></div>' +
      '<div class="field"><label>Ort (optional)</label><input id="f-place" type="text" placeholder="z. B. Chinatown, Singapur" value="' + (editing ? escapeAttr(editing.place || "") : "") + '" /></div>' +
      '<div class="field"><label>Notiz (optional)</label><input id="f-note" type="text" placeholder="z. B. Streetfood-Abend" value="' + (editing ? escapeAttr(editing.note || "") : "") + '" /></div>' +
      '<div class="field"><label>Fotos (optional)</label>' +
      '<div class="photo-thumbs" id="photo-thumbs"></div>' +
      '<label class="btn-secondary photo-add-btn">' + icon("camera", 15) + '&nbsp;Foto hinzufügen<input id="f-photo-input" type="file" accept="image/*" multiple style="display:none" /></label>' +
      '</div>' +
      '<button class="btn-primary" data-action="save-expense">' + icon("check", 16, "var(--btn-fg)") + (editing ? " Änderungen speichern" : " Speichern") + "</button>"
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

      // --- Stil ---
      '<div class="field"><label>Stil der App</label><div class="theme-grid">' +
      R.THEMES.map(function (t) {
        var active = R.getTheme() === t.id;
        return '<button type="button" class="theme-opt' + (active ? " active" : "") + '" data-action="pick-theme" data-theme="' + t.id + '">' +
          '<span class="theme-swatch"><i style="background:' + t.sw[0] + '"></i><i style="background:' + t.sw[1] + '"></i><i style="background:' + t.sw[2] + '"></i></span>' +
          escapeHtml(t.label) + "</button>";
      }).join("") +
      '</div><div class="hint">Gilt nur für dieses Gerät — jeder wählt seinen eigenen Stil.</div></div>' +

      // --- Sync ---
      '<div class="stub" style="padding:14px 16px">' +
      '<div class="section-title display" style="margin-bottom:4px">Gemeinsame Reisekasse</div>' +
      '<div class="hint" style="margin:0 0 10px">Damit zwei Handys dieselben Daten sehen: unten die Datenbank-Adresse aus der Anleitung, einen gemeinsamen Reise-Code (auf beiden Geräten exakt gleich) und deinen Namen eintragen.</div>' +
      '<div class="field" style="margin-bottom:8px"><label>Datenbank-Adresse (Firebase-URL)</label><input id="s-dburl" type="url" placeholder="https://…firebasedatabase.app" value="' + escapeAttr(s.sync.dbUrl) + '" /></div>' +
      '<div class="field" style="margin-bottom:8px"><label>Mein Name</label><input id="s-person" type="text" placeholder="z. B. Anna" value="' + escapeAttr(s.sync.person) + '" /></div>' +
      '<div class="field" style="margin-bottom:8px"><label>Diese Reise teilen</label>' +
      '<div style="display:flex;align-items:center;gap:8px">' +
      '<span class="mono" style="flex:1;font-size:12px;opacity:.7">' + escapeHtml(s.sync.tripCode || "—") + "</span>" +
      '<button class="btn-secondary" data-action="copy-share-link" id="copy-link-btn"' + (s.sync.dbUrl && s.sync.tripCode ? "" : " disabled") + ">Einladung kopieren</button>" +
      "</div>" +
      (s.sync.dbUrl ? "" : '<div class="hint">Zum Teilen erst oben die Datenbank-Adresse eintragen.</div>') +
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
      '<button class="btn-primary" data-action="save-settings">' + icon("check", 16, "var(--btn-fg)") + " Übernehmen</button>" +
      '<div class="hint" style="text-align:center;margin-top:2px">TripCash · Version 13</div>'
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
      '<button class="icon-btn" style="color:var(--ink)" data-action="close-modal">' + icon("x", 20) + "</button></div>" +
      body + "</div></div>";
  }

  function renderOnboarding(s) {
    var step = ui.onboardStep;
    var inner = "";
    if (step === 0) {
      inner =
        '<div class="ob-tag ob-a" style="--d:0ms">' + icon("wallet", 44, "var(--gold)") + "</div>" +
        '<h1 class="ob-title display ob-a" style="--d:120ms">Willkommen bei<br/>TripCash</h1>' +
        '<p class="ob-text ob-a" style="--d:260ms">Eure gemeinsame Reisekasse — Ausgaben festhalten, Währungen umrechnen, am Ende fair ausgleichen.</p>' +
        '<button class="btn-primary ob-a" style="--d:420ms" data-action="onboard-next">Weiter</button>';
    } else if (step === 1) {
      inner =
        '<h1 class="ob-title display ob-a" style="--d:0ms">So funktioniert\u2019s</h1>' +
        '<div class="ob-feat ob-a" style="--d:140ms">' + icon("plus", 18, "var(--gold)") + '<span>Ausgaben in jeder Währung eintragen — Kurse holt sich die App selbst</span></div>' +
        '<div class="ob-feat ob-a" style="--d:260ms">' + icon("person", 18, "var(--gold)") + '<span>Festhalten, wer bezahlt hat — die App rechnet aus, wer wem was schuldet</span></div>' +
        '<div class="ob-feat ob-a" style="--d:380ms">' + icon("image", 18, "var(--gold)") + '<span>Fotos anhängen: Kassenzettel, Essensbilder, Schnappschüsse</span></div>' +
        '<button class="btn-primary ob-a" style="--d:520ms" data-action="onboard-next">Weiter</button>';
    } else if (step === 2) {
      inner =
        '<h1 class="ob-title display ob-a" style="--d:0ms">Wie heißt du?</h1>' +
        '<p class="ob-text ob-a" style="--d:120ms">Dein Name steht später an deinen Einträgen.</p>' +
        '<input class="ob-input ob-a" style="--d:220ms" id="ob-name" type="text" placeholder="z. B. Anna" value="' + escapeAttr(obNameDraft !== null ? obNameDraft : (s.sync.person || "")) + '" maxlength="20" />' +
        '<div class="hint ob-a" style="--d:320ms;text-align:center;max-width:270px">Dieser Name ist nur für dich und die Teilnehmer deiner Reisekasse sichtbar.</div>' +
        '<button class="btn-primary ob-a" style="--d:440ms" data-action="onboard-next">Weiter</button>';
    } else if (step === 3) {
      var themeOpts = R.THEMES.map(function (th, i) {
        var active = R.getTheme() === th.id;
        return '<button type="button" class="theme-opt ob-a' + (active ? " active" : "") + '" style="--d:' + (160 + i * 90) + 'ms" data-action="pick-theme" data-theme="' + th.id + '">' +
          '<span class="theme-swatch"><i style="background:' + th.sw[0] + '"></i><i style="background:' + th.sw[1] + '"></i><i style="background:' + th.sw[2] + '"></i></span>' +
          escapeHtml(th.label) + "</button>";
      }).join("");
      inner =
        '<h1 class="ob-title display ob-a" style="--d:0ms">Such dir deinen Stil aus</h1>' +
        '<p class="ob-text ob-a" style="--d:100ms">Tipp einen an — die App zieht sich sofort um. Du kannst jederzeit in den Einstellungen wechseln.</p>' +
        '<div class="theme-grid ob-theme-grid">' + themeOpts + "</div>" +
        '<button class="btn-primary ob-a" style="--d:640ms" data-action="onboard-next">Weiter</button>';
    } else if (step === 4) {
      inner =
        '<h1 class="ob-title display ob-a" style="--d:0ms">Deine erste Reise</h1>' +
        (ui.obJoinMode
          ? '<p class="ob-text ob-a" style="--d:100ms">Füge den Code oder Einladungs-Link ein, den du bekommen hast.</p>' +
            '<input class="ob-input ob-a" style="--d:200ms" id="ob-join-link" type="text" placeholder="Code oder Link einfügen" />' +
            '<div class="hint ob-a" style="--d:280ms;text-align:center" id="ob-join-hint"></div>' +
            '<button class="btn-primary ob-a" style="--d:340ms" data-action="onboard-join">Beitreten &amp; los</button>' +
            '<button class="ob-link ob-a" style="--d:440ms" data-action="onboard-toggle-join">Lieber eine eigene Reise anlegen</button>'
          : '<p class="ob-text ob-a" style="--d:100ms">Gib deiner Reise einen Namen — teilen kannst du sie später jederzeit.</p>' +
            '<input class="ob-input ob-a" style="--d:200ms" id="ob-trip-name" type="text" placeholder="z. B. Türkei · Singapur · Bali" maxlength="40" />' +
            '<button class="btn-primary ob-a" style="--d:320ms" data-action="onboard-create">Reise anlegen &amp; los</button>' +
            '<button class="ob-link ob-a" style="--d:440ms" data-action="onboard-toggle-join">Ich habe einen Einladungs-Link</button>');
    }
    var dots = [0, 1, 2, 3, 4].map(function (i) {
      return '<span class="ob-dot' + (i === step ? " active" : "") + '"></span>';
    }).join("");
    return '<div class="onboard">' +
      '<div class="ob-stage" key="' + step + '">' + inner + "</div>" +
      '<div class="ob-dots">' + dots + "</div></div>";
  }

  function renderTripsModal(s) {
    var active = R.activeTripCode();
    var rows = R.listTrips().map(function (t) {
      var isActive = t.code === active;
      return '<div class="trip-row' + (isActive ? " active" : "") + '">' +
        '<button class="trip-main" data-action="switch-trip" data-code="' + escapeAttr(t.code) + '">' +
        '<span class="trip-name">' + escapeHtml(t.name) + (isActive ? " " + icon("check", 13, "var(--gold)") : "") + "</span>" +
        '<span class="trip-code mono">' + escapeHtml(t.code) + "</span></button>" +
        (t.dbUrl ? '<button class="icon-btn trip-share" style="color:var(--ink)" data-action="share-trip" data-code="' + escapeAttr(t.code) + '" aria-label="Teilen">' + icon("share", 17) + "</button>" : "") +
        "</div>";
    }).join("");

    return modalShell("Meine Reisen",
      rows +
      '<div class="field" style="margin-top:6px"><label>Neue Reise anlegen</label>' +
      '<div class="add-currency-row"><input id="t-new-name" type="text" placeholder="z. B. Bali 2027" />' +
      '<button class="btn-secondary" data-action="create-trip">' + icon("plus", 16) + "</button></div></div>" +
      '<div class="field"><label>Mit Code oder Link beitreten</label>' +
      '<div class="add-currency-row"><input id="t-join-link" type="text" placeholder="Code oder Link einfügen" />' +
      '<button class="btn-secondary" data-action="join-trip">' + icon("check", 16) + "</button></div>" +
      '<div class="hint" id="t-join-hint">Den Code oder Link bekommst du vom Ersteller (Teilen-Symbol neben der Reise). Beim allerersten Mal den kompletten Link nutzen, danach reicht der kurze Code.</div></div>'
    );
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return false; });
    }
    return Promise.resolve(false);
  }

  function renderGalleryModal(s) {
    var refs = R.allPhotoRefs();
    var body;
    if (!refs.length) {
      body = '<div class="stub empty-hint">Noch keine Fotos — häng beim Eintragen einfach welche an (Kassenzettel, Essensfotos, Schnappschüsse …).</div>';
    } else {
      body = '<div class="gal-grid">' + refs.map(function (r) {
        var cat = R.catFor(r.expense.category);
        return '<button class="gal-cell" data-action="view-photo" data-photo-id="' + escapeAttr(r.photoId) + '">' +
          '<img data-photo-id="' + escapeAttr(r.photoId) + '" alt="" />' +
          '<span class="gal-cap">' + escapeHtml(cat.label) + " · " + escapeHtml(r.expense.date.slice(5)) + "</span></button>";
      }).join("") + "</div>";
    }
    return modalShell("Galerie (" + refs.length + ")", body);
  }

  function renderPhotoViewer(s) {
    var ref = null;
    R.allPhotoRefs().forEach(function (r) { if (r.photoId === ui.photoView) ref = r; });
    var cap = "";
    if (ref) {
      var cat = R.catFor(ref.expense.category);
      cap = cat.label + " · " + ref.expense.date +
        (ref.expense.place ? " · " + ref.expense.place : "") +
        (ref.expense.note ? " · " + ref.expense.note : "") +
        " · " + R.fmtMoney(ref.expense.amount, ref.expense.currency);
    }
    return '<div class="photo-viewer" data-action="close-photo">' +
      '<img id="viewer-img" alt="" />' +
      '<div class="viewer-cap">' + escapeHtml(cap) + "</div>" +
      '<button class="viewer-close" data-action="close-photo">' + icon("x", 22, "#fff") + "</button></div>";
  }

  // Thumbnails im Formular (bestehende + noch nicht gespeicherte)
  function loadFormThumbs() {
    var wrap = document.getElementById("photo-thumbs");
    if (!wrap) return;
    var html = "";
    if (editingId) {
      var entry = findExpense(R.getState(), editingId);
      ((entry && entry.photoIds) || []).forEach(function (pid) {
        html += '<span class="thumb"><img data-photo-id="' + escapeAttr(pid) + '" alt="" />' +
          '<button class="thumb-x" data-action="delete-photo" data-photo-id="' + escapeAttr(pid) + '">×</button></span>';
      });
    }
    pendingNewPhotos.forEach(function (dataURL, i) {
      html += '<span class="thumb"><img src="' + dataURL + '" alt="" />' +
        '<button class="thumb-x" data-action="remove-temp-photo" data-idx="' + i + '">×</button></span>';
    });
    wrap.innerHTML = html;
    wrap.querySelectorAll("img[data-photo-id]").forEach(function (img) {
      R.fetchPhoto(img.getAttribute("data-photo-id")).then(function (url) { if (url) img.src = url; });
    });
  }

  function loadGalleryThumbs() {
    document.querySelectorAll(".gal-grid img[data-photo-id]").forEach(function (img) {
      R.fetchPhoto(img.getAttribute("data-photo-id")).then(function (url) { if (url) img.src = url; });
    });
  }

  function loadViewerPhoto() {
    var img = document.getElementById("viewer-img");
    if (!img) return;
    R.fetchPhoto(ui.photoView).then(function (url) { if (url) img.src = url; });
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
    var photoInput = document.getElementById("f-photo-input");
    if (photoInput) {
      photoInput.addEventListener("change", function () {
        var files = Array.prototype.slice.call(photoInput.files || []);
        photoInput.value = "";
        files.forEach(function (file) {
          R.compressImage(file).then(function (dataURL) {
            if (editingId) {
              R.addPhoto(editingId, dataURL);
            } else {
              pendingNewPhotos.push(dataURL);
            }
            loadFormThumbs();
          }).catch(function () { /* unlesbares Bild — still überspringen */ });
        });
      });
    }
    appEl.querySelectorAll("[data-action]").forEach(function (el) {
      el.addEventListener("click", function (evt) {
        var action = el.getAttribute("data-action");

        if (action === "backdrop") {
          if (evt.target === el) { editingId = null; pendingNewPhotos = []; ui.modal = null; render(); }
          return;
        }
        if (action === "close-modal") { editingId = null; pendingNewPhotos = []; ui.modal = null; render(); return; }
        if (action === "set-tab") { ui.tab = el.getAttribute("data-tab"); render(); return; }
        if (action === "filter") { ui.filterCat = el.getAttribute("data-cat"); render(); return; }
        if (action === "person-filter") { ui.personFilter = el.getAttribute("data-person"); render(); return; }
        if (action === "delete") {
          evt.stopPropagation(); // nicht zusätzlich das Bearbeiten der Zeile öffnen
          R.deleteExpense(el.getAttribute("data-id"));
          render();
          return;
        }

        if (action === "edit-expense") {
          var entry = findExpense(R.getState(), el.getAttribute("data-id"));
          if (!entry) return;
          editingId = entry.id;
          addFormCat = entry.category;
          addFormPerson = entry.person || "Ich";
          ui.modal = "add";
          render();
          return;
        }

        if (action === "open-add") {
          editingId = null;
          pendingNewPhotos = [];
          addFormCat = R.CATEGORIES[0].id;
          addFormPerson = R.getState().sync.person || "Ich";
          ui.modal = "add";
          render();
          return;
        }
        if (action === "open-settings") { ui.modal = "settings"; render(); return; }
        if (action === "open-gallery") { ui.modal = "gallery"; render(); return; }
        if (action === "open-trips") { ui.modal = "trips"; render(); return; }
        if (action === "switch-trip") { R.switchTrip(el.getAttribute("data-code")); ui.modal = null; render(); return; }
        if (action === "create-trip") {
          var tn = document.getElementById("t-new-name");
          var newName = (tn.value || "").trim();
          if (!newName) { tn.focus(); return; }
          R.createTrip(newName);
          ui.modal = null;
          render();
          return;
        }
        if (action === "join-trip") {
          var jl = document.getElementById("t-join-link");
          var err = R.joinTrip(jl.value);
          var hint = document.getElementById("t-join-hint");
          if (err) { if (hint) hint.textContent = err; return; }
          ui.modal = null;
          render();
          return;
        }
        if (action === "copy-share-link") {
          var slink = R.shareText();
          if (!slink) return;
          var btn2 = document.getElementById("copy-link-btn");
          copyToClipboard(slink).then(function (okCopy) {
            if (okCopy) { btn2.textContent = "Kopiert ✓"; setTimeout(function () { btn2.textContent = "Einladung kopieren"; }, 1600); }
            else if (window.prompt) window.prompt("Link kopieren:", slink);
          });
          return;
        }
        if (action === "share-trip") {
          evt.stopPropagation();
          var link = R.shareText(el.getAttribute("data-code"));
          if (!link) return;
          if (navigator.share) {
            navigator.share({ title: "TripCash-Reise", text: link }).catch(function () {});
            return;
          }
          copyToClipboard(link).then(function (okCopy) {
            el.innerHTML = okCopy ? "✓" : "";
            if (!okCopy && window.prompt) window.prompt("Link kopieren:", link);
            setTimeout(function () { el.innerHTML = icon("share", 17); }, 1600);
          });
          return;
        }
        if (action === "onboard-next") {
          var obNameEl = document.getElementById("ob-name");
          if (obNameEl) obNameDraft = obNameEl.value;
          ui.onboardStep++;
          render();
          return;
        }
        if (action === "onboard-toggle-join") { ui.obJoinMode = !ui.obJoinMode; render(); return; }
        if (action === "onboard-create") {
          var tnEl = document.getElementById("ob-trip-name");
          var tName = (tnEl.value || "").trim() || "Meine Reise";
          R.completeOnboarding(obNameDraft || "");
          R.createTrip(tName);
          obNameDraft = null;
          ui.onboardStep = 0; ui.obJoinMode = false;
          render();
          return;
        }
        if (action === "onboard-join") {
          var jlEl = document.getElementById("ob-join-link");
          R.completeOnboarding(obNameDraft || "");
          var jerr = R.joinTrip(jlEl.value);
          if (jerr) {
            var jh = document.getElementById("ob-join-hint");
            if (jh) jh.textContent = jerr;
            // Onboarding-Flag zurücknehmen wäre verwirrend — Schritt bleibt offen
            return;
          }
          obNameDraft = null;
          ui.onboardStep = 0; ui.obJoinMode = false;
          render();
          return;
        }
        if (action === "view-photo") { ui.photoView = el.getAttribute("data-photo-id"); render(); return; }
        if (action === "close-photo") {
          if (evt.target.closest && evt.target.closest("#viewer-img")) return; // Tipp aufs Bild selbst ignorieren
          ui.photoView = null; render(); return;
        }
        if (action === "delete-photo") {
          evt.stopPropagation();
          R.deletePhoto(el.getAttribute("data-photo-id"), editingId);
          loadFormThumbs();
          return;
        }
        if (action === "remove-temp-photo") {
          evt.stopPropagation();
          pendingNewPhotos.splice(parseInt(el.getAttribute("data-idx"), 10), 1);
          loadFormThumbs();
          return;
        }

        if (action === "pick-theme") {
          R.setTheme(el.getAttribute("data-theme"));
          document.querySelectorAll(".theme-opt").forEach(function (b) {
            b.classList.toggle("active", b.getAttribute("data-theme") === R.getTheme());
          });
          return;
        }

        if (action === "pick-cat") {
          addFormCat = el.getAttribute("data-cat");
          document.querySelectorAll("#cat-grid .cat-chip").forEach(function (chip) {
            chip.classList.toggle("active", chip.getAttribute("data-cat") === addFormCat);
          });
          return;
        }

        if (action === "pick-person") {
          addFormPerson = el.getAttribute("data-person");
          document.querySelectorAll("#person-grid .cat-chip").forEach(function (chip) {
            chip.classList.toggle("active", chip.getAttribute("data-person") === addFormPerson);
          });
          var custom = document.getElementById("f-person-custom");
          if (custom) {
            custom.style.display = addFormPerson === "__other__" ? "block" : "none";
            if (addFormPerson === "__other__") custom.focus();
          }
          return;
        }

        if (action === "save-expense") {
          var amount = parseFloat(document.getElementById("f-amount").value);
          if (!(amount > 0)) return;
          var person = addFormPerson;
          if (person === "__other__") {
            var customName = document.getElementById("f-person-custom").value.trim();
            if (!customName) return; // "Anderer" gewählt, aber kein Name eingetippt
            person = customName;
          }
          var payload = {
            amount: amount,
            currency: document.getElementById("f-currency").value,
            category: addFormCat,
            person: person,
            date: document.getElementById("f-date").value || R.todayISO(),
            place: document.getElementById("f-place").value.trim(),
            note: document.getElementById("f-note").value.trim()
          };
          if (editingId) {
            R.updateExpense(editingId, payload);
          } else {
            var created = R.addExpense(payload);
            pendingNewPhotos.forEach(function (dataURL) { R.addPhoto(created.id, dataURL); });
            pendingNewPhotos = [];
          }
          editingId = null;
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
    var personEl = document.getElementById("s-person");
    if (!dbEl || !personEl) return;
    R.updateSync({ dbUrl: dbEl.value, person: personEl.value });
  }

  window.ReisekasseUI = { init: render, rerender: render, rerenderStatus: rerenderStatus };
})();

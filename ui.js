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
    obJoinMode: false,
    introReplay: false,
    searchQuery: "",
    categoryFilter: null,
    statScope: "own", // "own" = unser Geld, "all" = alle Reisekosten inkl. erstatteter
    openDays: null, // null = nur heute offen; sonst Objekt mit aufgeklappten Tagen
    searchRefocus: false,
    tripWizard: null, // { step: 0|1 } — animierter Reise-Erstellen-Flow
    reportView: false, // PDF-Bericht (Druckansicht)
    view: "home" // "home" (Reise-Übersicht) | "trip" (in einer Reise)
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
    if (!R.isOnboarded() || ui.introReplay) {
      appEl.innerHTML = renderOnboarding(s);
      bindEvents(s);
      return;
    }
    if (ui.reportView) {
      appEl.innerHTML = renderReport(s);
      bindEvents(s);
      return;
    }
    if (ui.tripWizard) {
      appEl.innerHTML = renderTripWizard(s);
      bindEvents(s);
      return;
    }
    if (ui.view === "home") {
      appEl.innerHTML = renderHome(s) +
        (ui.modal === "profile" ? renderProfileModal(s) : "") +
        (ui.photoView ? renderPhotoViewer(s) : "");
      bindEvents(s);
      return;
    }
    appEl.innerHTML =
      renderHeader(s) +
      '<div class="app-main">' + (ui.tab === "overview" ? renderOverview(s) : renderList(s)) + "</div>" +
      renderBottomNav() +
      (ui.modal === "add" ? renderAddModal(s) : "") +
      (ui.modal === "settings" ? renderSettingsModal(s) : "") +
      (ui.modal === "withdraw" ? renderWithdrawModal(s) : "") +
      (ui.modal === "gallery" ? renderGalleryModal(s) : "") +
      (ui.modal === "trips" ? renderTripsModal(s) : "") +
      (ui.modal === "profile" ? renderProfileModal(s) : "") +
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
      '<div style="display:flex;align-items:center;gap:6px;min-width:0">' +
      '<button class="icon-btn" data-action="go-home" aria-label="Zur Reise-Übersicht" style="margin-left:-6px">' + icon("back", 20) + "</button>" +
      '<div style="min-width:0">' +
      '<button class="title display trip-switch" data-action="go-home">' + escapeHtml(s.trip.name || "Meine Reise") + "</button>" +
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
    var d = R.computeDerived(ui.personFilter, ui.statScope === "all");
    var html = personPills(persons, ui.personFilter, "person-filter");

    if (R.shouldRemindSettle()) {
      html += '<div class="stub remind-card">' +
        '<div class="remind-emoji">🤝</div>' +
        '<div class="remind-text"><b>Kleiner Wochen-Check</b>' +
        'Zwischen euch stehen gerade ein paar Beträge offen. Wenn ihr zwischendurch ausgleicht, bleibt die Endabrechnung ein Klacks — und niemand erschrickt am letzten Abend. 😄</div>' +
        '<div class="remind-actions">' +
        '<button class="btn-primary" style="padding:9px 12px;font-size:13px" data-action="remind-go">Zum Ausgleich</button>' +
        '<button class="btn-secondary" style="padding:9px 12px;font-size:13px" data-action="remind-later">Nächste Woche</button>' +
        "</div></div>";
    }

    var reimbAll = R.computeDerived(ui.personFilter, true).reimbursedTotal;
    var cashBal = R.cashBalances();
    var hasCash = cashBal.some(function (b) { return b.withdrawn > 0 || b.spent > 0; });
    html += '<div class="stub card-gap cash-card">' +
      '<div class="cash-head"><span class="section-title display" style="margin:0">💵 Bargeld-Kasse</span>' +
      '<button class="btn-mini gold" data-action="open-withdraw">+ Abhebung</button></div>' +
      (hasCash
        ? cashBal.map(function (b) {
            var pct = b.withdrawn > 0 ? Math.max(0, Math.min(100, Math.round(b.rest / b.withdrawn * 100))) : 0;
            return '<div class="cash-row">' +
              '<div class="cash-line"><span>' + flagFor(b.currency) + " " + escapeHtml(b.currency) + "</span>" +
              '<b class="mono' + (b.rest < 0 ? " day-high" : "") + '">' + R.fmtMoney(b.rest, b.currency) + " übrig</b></div>" +
              '<div class="budget-bar"><i style="width:' + pct + '%;background:var(--gold)"></i></div>' +
              '<div class="cash-sub"><span>abgehoben ' + R.fmtMoney(b.withdrawn, b.currency) + "</span>" +
              "<span>bar bezahlt " + R.fmtMoney(b.spent, b.currency) + "</span></div></div>";
          }).join("")
        : '<div class="hint">Hebt jemand Geld ab, trag es hier ein. Barzahlungen davon werden dann von der Kasse abgezogen — nichts wird doppelt gezählt.</div>') +
      "</div>";

    if (reimbAll > 0) {
      html += '<div class="scope-switch">' +
        '<button class="scope-btn' + (ui.statScope === "own" ? " active" : "") + '" data-action="set-scope" data-scope="own">Unser Geld</button>' +
        '<button class="scope-btn' + (ui.statScope === "all" ? " active" : "") + '" data-action="set-scope" data-scope="all">Alle Reisekosten</button>' +
        "</div>";
    }

    html += '<div class="stat-row">' +
      statStub((ui.statScope === "all" ? "Reisekosten gesamt" : "Gesamt") + (ui.personFilter !== "all" ? " (" + escapeHtml(ui.personFilter) + ")" : ""), R.fmtMoney(d.totalBase, d.base), "wallet") +
      statStub("⌀ pro Tag (" + d.dayCount + "T)", R.fmtMoney(d.avgPerDay, d.base), "calendar") +
      "</div>";

    var cashBal = R.cashBalances();
    var hasCash = cashBal.some(function (b) { return b.withdrawn > 0 || b.spent > 0; });
    html += '<div class="stub card-gap cash-card">' +
      '<div class="cash-head"><span class="section-title display" style="margin:0">💵 Bargeld-Kasse</span>' +
      '<button class="btn-mini gold" data-action="open-withdraw">+ Abhebung</button></div>' +
      (hasCash
        ? cashBal.map(function (b) {
            var pct = b.withdrawn > 0 ? Math.max(0, Math.min(100, Math.round(b.rest / b.withdrawn * 100))) : 0;
            return '<div class="cash-row">' +
              '<div class="cash-line"><span>' + flagFor(b.currency) + " " + escapeHtml(b.currency) + "</span>" +
              '<b class="mono' + (b.rest < 0 ? " day-high" : "") + '">' + R.fmtMoney(b.rest, b.currency) + " übrig</b></div>" +
              '<div class="budget-bar"><i style="width:' + pct + '%;background:var(--gold)"></i></div>' +
              '<div class="cash-sub"><span>abgehoben ' + R.fmtMoney(b.withdrawn, b.currency) + "</span>" +
              "<span>bar bezahlt " + R.fmtMoney(b.spent, b.currency) + "</span></div></div>";
          }).join("")
        : '<div class="hint">Hebt jemand Geld ab, trag es hier ein. Barzahlungen davon werden dann von der Kasse abgezogen — nichts wird doppelt gezählt.</div>') +
      "</div>";

    if (reimbAll > 0) {
      html += '<div class="stub card-gap reimb-card">' +
        '<div class="reimb-line"><span>↩ Wird uns erstattet</span>' +
        '<b class="mono">' + R.fmtMoney(reimbAll, d.base) + "</b></div>" +
        '<div class="hint" style="margin-top:4px">' +
        (ui.statScope === "all"
          ? "Oben sind diese Kosten mitgezählt. Im Ausgleich bleiben sie immer außen vor."
          : "Nicht in den Zahlen oben und nicht im Ausgleich — tippe oben auf \u201EAlle Reisekosten\u201C, um sie einzurechnen.") +
        "</div></div>";
    }

    if (s.trip.budget > 0 && ui.personFilter === "all") {
      var spentB = R.computeDerived("all", false).totalBase; // Budget = euer Geld
      var pctB = Math.min(100, Math.round(spentB / s.trip.budget * 100));
      var overB = spentB > s.trip.budget;
      var leftB = s.trip.budget - spentB;
      html += '<div class="stub card-gap"><div class="section-title display">Budget</div>' +
        '<div class="budget-bar"><i style="width:' + pctB + '%;background:' + (overB ? "var(--red)" : "var(--gold)") + '"></i></div>' +
        '<div class="budget-line"><span class="mono">' + R.fmtMoney(spentB, s.trip.baseCurrency) + " / " + R.fmtMoney(s.trip.budget, s.trip.baseCurrency) + "</span>" +
        '<span style="' + (overB ? "color:var(--red);font-weight:700" : "opacity:.65") + '">' +
        (overB ? R.fmtMoney(-leftB, s.trip.baseCurrency) + " drüber" : R.fmtMoney(leftB, s.trip.baseCurrency) + " übrig") + "</span></div></div>";
    }

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
            return '<div style="margin-top:8px;padding:10px 12px;border-radius:10px;background:#3F7A6E14;border:1px solid #3F7A6E33;font-size:13px;display:flex;align-items:center;justify-content:center;gap:6px;flex-wrap:wrap">' +
              "<span><strong>" + escapeHtml(t.from) + "</strong> gibt <strong>" + escapeHtml(t.to) + "</strong> " +
              '<span class="mono" style="font-weight:600">' + R.fmtMoney(t.amount, settlement.base) + "</span></span>" +
              '<button class="btn-mini" data-action="mark-settled" data-from="' + escapeAttr(t.from) + '" data-to="' + escapeAttr(t.to) + '" data-amount="' + t.amount + '">✓ Bezahlt</button>' +
              "</div>";
          }).join("")
        : '<div class="hint" style="margin-top:8px;text-align:center">Ihr seid quitt 🎉</div>';

      html += '<div class="stub card-gap" id="settle-card"><div class="section-title display">Ausgleich</div>' +
        rows + transfers +
        '<div class="hint" style="margin-top:8px">Geteilt werden nur gemeinsame Ausgaben, gleichmäßig auf alle (fairer Anteil: ' +
        R.fmtMoney(settlement.share, settlement.base) + " pro Person).</div></div>";
    }

    if (d.topCat) {
      html += '<div class="stub card-gap" style="font-size:13px">Größter Posten: <strong>' + escapeHtml(d.topCat.label) +
        "</strong> mit " + R.fmtMoney(d.topCat.value, d.base) + " (" + Math.round((d.topCat.value / d.totalBase) * 100) + "%)</div>";
    }

    if (d.byCat.length > 0) {
      var legend = d.byCat.slice().sort(function (a, b) { return b.value - a.value; }).map(function (c) {
        return '<button class="legend-row legend-tap" data-action="filter-cat" data-cat="' + escapeAttr(c.id) + '">' +
          '<span class="legend-dot" style="background:' + c.color + '"></span>' +
          '<span class="legend-label">' + escapeHtml(c.label) + '</span>' +
          '<span class="mono">' + R.fmtMoney(c.value, d.base) + "</span>" +
          icon("chevright", 13) + "</button>";
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
    var q = (ui.searchQuery || "").toLowerCase();

    var entries = s.expenses.filter(function (e) {
      if (ui.personFilter && ui.personFilter !== "all" && (e.person || "Ich") !== ui.personFilter && e.kind !== "settlement") return false;
      if (ui.categoryFilter && (e.kind === "settlement" || e.kind === "withdrawal" || e.category !== ui.categoryFilter)) return false;
      if (!q) return true;
      var hay = [e.note, e.place, e.person,
        e.kind === "settlement" ? "ausgleich " + e.from + " " + e.to
          : (e.kind === "withdrawal" ? "abhebung bargeld" : R.catFor(e.category).label),
        e.currency, String(e.amount)]
        .join(" ").toLowerCase();
      return hay.indexOf(q) !== -1;
    });

    var rows = "";
    if (!entries.length) {
      rows = '<div class="stub empty-hint">' + (q ? "Nichts gefunden für \u201E" + escapeHtml(ui.searchQuery) + "\u201C." : "Noch keine Ausgaben — leg mit dem + los!") + "</div>";
    } else {
      // Nach Tagen gruppieren (Einträge sind bereits neueste zuerst)
      var groups = [];
      var byDate = {};
      entries.forEach(function (e) {
        if (!byDate[e.date]) { byDate[e.date] = []; groups.push(e.date); }
        byDate[e.date].push(e);
      });
      var weekdays = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
      var today = R.todayISO();
      var forceOpen = !!q || !!ui.categoryFilter; // beim Suchen/Filtern alles zeigen
      // Tagesdurchschnitt als Maßstab — passt sich mit jedem Eintrag automatisch an.
      // Nur färben, wenn die Tagessummen auch wirklich vollständig sind (kein Filter/Suche).
      var avgRef = R.computeDerived(ui.personFilter, false).avgPerDay;
      var colorDays = !q && !ui.categoryFilter && avgRef > 0;
      rows = groups.map(function (date) {
        var dayEntries = byDate[date];
        var dayTotal = 0;
        dayEntries.forEach(function (e) {
          if (e.kind === "settlement" || e.kind === "withdrawal" || e.reimbursed) return;
          dayTotal += R.convertExpense(e);
        });
        var wd = "";
        try { wd = weekdays[new Date(date + "T12:00:00").getDay()] + " "; } catch (err) {}
        var defaultOpen = date === today;
        var isOpen = forceOpen || (ui.openDays && ui.openDays.hasOwnProperty(date) ? ui.openDays[date] : defaultOpen);
        var totalCls = "", totalMark = "";
        if (colorDays && dayTotal > 0) {
          var band = avgRef * 0.02; // Tage im Rahmen des Schnitts bleiben neutral
          if (dayTotal > avgRef + band) { totalCls = " day-high"; totalMark = "▲ "; }
          else if (dayTotal < avgRef - band) { totalCls = " day-low"; totalMark = "▼ "; }
        }
        var header = '<button class="day-head day-toggle' + (isOpen ? " open" : "") + '" data-action="toggle-day" data-day="' + escapeAttr(date) + '">' +
          icon("chevright", 13) +
          '<span>' + wd + escapeHtml(date) + (date === today ? " · heute" : "") + "</span>" +
          '<span class="day-count">' + dayEntries.length + "</span>" +
          '<span class="mono day-total' + totalCls + '">' + totalMark + R.fmtMoney(dayTotal, s.trip.baseCurrency) + "</span></button>";
        if (!isOpen) {
          // Eingeklappt: kompakte Vorschau — welche Kategorien an dem Tag, mit Summen
          var byCatDay = {};
          var catOrder = [];
          var settleCount = 0;
          var reimbDay = 0, wdDay = 0;
          dayEntries.forEach(function (e) {
            if (e.kind === "settlement") { settleCount++; return; }
            if (e.kind === "withdrawal") { wdDay += R.convertExpense(e); return; }
            if (e.reimbursed) { reimbDay += R.convertExpense(e); return; }
            if (!byCatDay[e.category]) { byCatDay[e.category] = 0; catOrder.push(e.category); }
            byCatDay[e.category] += R.convertExpense(e);
          });
          var chips = catOrder.sort(function (a, b) { return byCatDay[b] - byCatDay[a]; }).map(function (cid) {
            var cc = R.catFor(cid);
            return '<span class="day-chip" style="--c:' + cc.color + '">' + (cc.emoji || "•") +
              '<span class="mono">' + R.fmtMoney(byCatDay[cid], s.trip.baseCurrency) + "</span></span>";
          }).join("");
          if (wdDay > 0) {
            chips += '<span class="day-chip" style="--c:var(--gold)">💵<span class="mono">' + R.fmtMoney(wdDay, s.trip.baseCurrency) + "</span></span>";
          }
          if (reimbDay > 0) {
            chips += '<span class="day-chip reimb-chip" style="--c:#3F7A6E">↩<span class="mono">' + R.fmtMoney(reimbDay, s.trip.baseCurrency) + "</span></span>";
          }
          if (settleCount) {
            chips += '<span class="day-chip" style="--c:#3F7A6E">' + icon("check", 11, "#3F7A6E") + "Ausgleich</span>";
          }
          return header + '<button class="day-preview" data-action="toggle-day" data-day="' + escapeAttr(date) + '">' + chips + "</button>";
        }
        var items = dayEntries.map(function (e) {
          if (e.kind === "withdrawal") {
            return '<div class="expense-row withdraw-row">' +
              '<div class="expense-icon" style="background:#D6A24A22;color:var(--gold)">💵</div>' +
              '<div class="expense-info"><div class="expense-cat">Bargeld abgehoben</div>' +
              '<div class="expense-meta">' + escapeHtml(e.date) + " · " + escapeHtml(e.person || "Ich") +
              (e.note ? " · " + escapeHtml(e.note) : "") + "</div></div>" +
              '<div class="expense-amount"><div class="main mono">' + flagFor(e.currency) + " " + R.fmtMoney(e.amount, e.currency) + "</div></div>" +
              '<button class="row-delete" data-action="delete-expense" data-id="' + escapeAttr(e.id) + '" aria-label="Löschen">' + icon("trash", 16) + "</button>" +
              "</div>";
          }
          if (e.kind === "settlement") {
            return '<div class="expense-row settle-row" data-action="noop">' +
              '<div class="expense-icon" style="background:#3F7A6E22;color:#3F7A6E">' + icon("check", 15, "#3F7A6E") + "</div>" +
              '<div class="expense-info"><div class="expense-cat">Ausgleich</div>' +
              '<div class="expense-meta">' + escapeHtml(e.from) + " " + icon("arrow", 11) + " " + escapeHtml(e.to) + "</div></div>" +
              '<div class="expense-amount"><div class="main mono">' + R.fmtMoney(e.amount, e.currency) + "</div></div>" +
              '<button class="row-delete" data-action="delete-expense" data-id="' + escapeAttr(e.id) + '" aria-label="Löschen">' + icon("trash", 16) + "</button>" +
              "</div>";
          }
          var cat = R.catFor(e.category);
          var multiPerson = persons.length > 1 || (persons[0] && persons[0] !== "Ich");
          var stayN = e.checkIn && e.checkOut ? nightsBetween(e.checkIn, e.checkOut) : 0;
          var dateLabel;
          if (e.stayNights > 1) {
            dateLabel = escapeHtml(e.date) + " · Nacht " + (e.stayIndex + 1) + "/" + e.stayNights;
          } else if (e.checkIn) {
            dateLabel = escapeHtml(e.checkIn) + (e.checkOut ? " → " + escapeHtml(e.checkOut) : "") + (stayN ? " · " + stayN + (stayN === 1 ? " Nacht" : " Nächte") : "");
          } else {
            dateLabel = escapeHtml(e.date);
          }
          var meta = dateLabel +
            (e.reimbursed ? " · wird erstattet" : "") +
            (multiPerson ? " · " + escapeHtml(e.person || "Ich") : "") +
            (e.shared === false ? " · nur " + escapeHtml(e.person || "Ich") + " (privat)" : "") +
            (e.place ? " · " + escapeHtml(e.place) : "") +
            (e.note ? " · " + escapeHtml(e.note) : "");
          var photoBadge = (e.photoIds && e.photoIds.length)
            ? '<span class="photo-badge">' + icon("image", 10) + e.photoIds.length + "</span>" : "";
          var sub = e.currency === e.baseAtEntry ? "" :
            '<div class="sub mono">≈ ' + R.fmtMoney(R.convertExpense(e), e.baseAtEntry) + "</div>";
          return '<div class="expense-row' + (e.reimbursed ? " reimbursed-row" : "") + '" style="--cat:' + cat.color + '" data-action="edit-expense" data-id="' + escapeAttr(e.id) + '">' +
            '<div class="expense-icon" style="background:' + cat.color + '22;color:' + cat.color + '">' + (cat.emoji || "•") + "</div>" +
            '<div class="expense-info"><div class="expense-cat">' + escapeHtml(cat.label) + photoBadge + "</div>" +
            '<div class="expense-meta">' + meta + "</div></div>" +
            '<div class="expense-amount"><div class="main mono">' + flagFor(e.currency) + " " + R.fmtMoney(e.amount, e.currency) + "</div>" + sub + "</div>" +
            '<button class="row-delete" data-action="delete-expense" data-id="' + escapeAttr(e.id) + '" aria-label="Löschen">' + icon("trash", 16) + "</button>" +
            "</div>";
        }).join("");
        return header + items;
      }).join("");
    }

    var catBanner = "";
    if (ui.categoryFilter) {
      var fc = R.catFor(ui.categoryFilter);
      catBanner = '<div class="cat-filter" style="--c:' + fc.color + '">' + (fc.emoji || "") + " " +
        '<b>' + escapeHtml(fc.label) + "</b>" +
        '<span class="mono">' + R.fmtMoney(entries.reduce(function (sum, e) { return sum + R.convertExpense(e); }, 0), s.trip.baseCurrency) + "</span>" +
        '<button data-action="clear-cat-filter" aria-label="Filter aufheben">' + icon("x", 15) + "</button></div>";
    }
    var avgHint = "";
    var avgVal = R.computeDerived(ui.personFilter, false).avgPerDay;
    if (!q && !ui.categoryFilter && avgVal > 0 && entries.length) {
      avgHint = '<div class="avg-hint">' +
        '<span class="day-low">▼ unter</span> / <span class="day-high">▲ über</span> dem Schnitt von ' +
        '<b class="mono">' + R.fmtMoney(avgVal, s.trip.baseCurrency) + "</b> pro Tag</div>";
    }
    return '<div class="list-search"><input id="list-search" type="search" placeholder="Suchen: Ort, Notiz, Person …" value="' + escapeAttr(ui.searchQuery) + '" /></div>' +
      catBanner + personPills(persons) + avgHint + rows;
  }

  /* ---------------- modals ---------------- */

  var addFormCat = R.CATEGORIES[0].id;
  var addFormPerson = null;
  var addFormShared = true;
  var addFormReimbursed = false;
  var addFormCash = false;   // aus der Bargeld-Kasse bezahlt
  var wdPerson = null;       // "Abhebung"-Formular: wer hebt ab

  // Kleiner Währungsrechner auf dem Startbildschirm — merkt sich Auswahl & Zustand
  var CALC_KEY = "reisekasse:calc";
  var calc = (function () {
    try { return JSON.parse(localStorage.getItem(CALC_KEY) || "null") || {}; } catch (e) { return {}; }
  })();
  function saveCalc() {
    try { localStorage.setItem(CALC_KEY, JSON.stringify(calc)); } catch (e) {}
  }
  var editingId = null;
  var pendingNewPhotos = []; // Fotos, die vor dem Speichern eines NEUEN Eintrags gewählt wurden
  var obNameDraft = null; // Name aus dem Onboarding, bis zum Abschluss gemerkt
  var stayEditTotal = null; // beim Bearbeiten einer Übernachtung: Gesamtbetrag des Aufenthalts

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

    return modalShell(editing ? (stayEditTotal != null ? "Übernachtung bearbeiten" : "Ausgabe bearbeiten") : "Neue Ausgabe",
      '<div class="field-row">' +
      '<div class="field" style="flex:1.2"><label>Betrag</label><input id="f-amount" type="number" inputmode="decimal" placeholder="0.00" value="' + (editing ? (stayEditTotal != null ? stayEditTotal : editing.amount) : "") + '"' + (editing ? "" : " autofocus") + ' /></div>' +
      '<div class="field" style="flex:1"><label>Währung</label><select id="f-currency">' +
      currencies.map(function (c) { return '<option value="' + c + '"' + (c === selCurrency ? " selected" : "") + ">" + flagFor(c) + " " + c + "</option>"; }).join("") +
      "</select></div></div>" +
      '<div class="field"><label>Kategorie</label><div class="cat-grid" id="cat-grid">' + catChips + "</div></div>" +
      '<div class="field"><label>Bezahlt von</label><div class="cat-grid" id="person-grid">' + personChips + "</div>" +
      '<input id="f-person-custom" type="text" placeholder="Name eintippen" style="margin-top:6px;display:' + (addFormPerson === "__other__" ? "block" : "none") + '" /></div>' +
      '<div class="field"><label>Art der Ausgabe</label><div class="cat-grid" id="shared-grid">' +
      '<button type="button" class="cat-chip' + (addFormShared ? " active" : "") + '" style="--chip-color:#3F7A6E" data-action="pick-shared" data-shared="1">' + icon("person", 14) + " Gemeinsam (wird geteilt)</button>" +
      '<button type="button" class="cat-chip' + (!addFormShared ? " active" : "") + '" style="--chip-color:#8A8578" data-action="pick-shared" data-shared="0">' + icon("wallet", 14) + " Einzelausgabe</button>" +
      "</div>" +
      '<div class="field"><label>Wer trägt die Kosten?</label><div class="chip-row">' +
      '<button type="button" class="cat-chip' + (!addFormReimbursed ? " active" : "") + '" style="--chip-color:#2B4C7E" data-action="pick-reimbursed" data-reimb="0">' + icon("wallet", 14) + " Zahlen wir selbst</button>" +
      '<button type="button" class="cat-chip' + (addFormReimbursed ? " active" : "") + '" style="--chip-color:#3F7A6E" data-action="pick-reimbursed" data-reimb="1">' + icon("check", 14) + " Wird uns erstattet</button>" +
      "</div></div>" +
      '<div class="field"><label>Womit bezahlt?</label><div class="chip-row">' +
      '<button type="button" class="cat-chip' + (!addFormCash ? " active" : "") + '" style="--chip-color:#2B4C7E" data-action="pick-cash" data-cash="0">' + icon("wallet", 14) + " Karte / Konto</button>" +
      '<button type="button" class="cat-chip' + (addFormCash ? " active" : "") + '" style="--chip-color:#D6A24A" data-action="pick-cash" data-cash="1">💵 Bargeld (aus der Kasse)</button>' +
      '</div><div class="hint">Bargeld wird von der gemeinsamen Kasse abgezogen — die Abhebung selbst wurde ja schon eingetragen. Einzelausgaben zählen zur Statistik, aber nicht in den Ausgleich.</div></div>' +
      '<div class="field" id="date-normal" style="display:' + (addFormCat === "unterkunft" ? "none" : "block") + '"><label>Datum</label><input id="f-date" type="date" value="' + (editing ? escapeAttr(editing.date) : R.todayISO()) + '" /></div>' +
      '<div id="date-stay" style="display:' + (addFormCat === "unterkunft" ? "block" : "none") + '"><div class="field-row" style="margin-bottom:8px">' +
      '<div class="field"><label>Anreise</label><input id="f-checkin" type="date" value="' + escapeAttr((editing && editing.checkIn) || (editing ? editing.date : R.todayISO())) + '" /></div>' +
      '<div class="field"><label>Abreise</label><input id="f-checkout" type="date" value="' + escapeAttr((editing && editing.checkOut) || "") + '" /></div>' +
      '</div><div class="hint" style="margin:-4px 0 10px" id="stay-nights"></div></div>' +
      '<div class="field"><label>Ort (optional)</label><input id="f-place" type="text" placeholder="z. B. Chinatown, Singapur" value="' + (editing ? escapeAttr(editing.place || "") : "") + '" /></div>' +
      '<div class="field"><label>Notiz (optional)</label><input id="f-note" type="text" placeholder="z. B. Streetfood-Abend" value="' + (editing ? escapeAttr(editing.note || "") : "") + '" /></div>' +
      '<div class="field"><label>Fotos (optional)</label>' +
      '<div class="photo-thumbs" id="photo-thumbs"></div>' +
      '<label class="btn-secondary photo-add-btn">' + icon("camera", 15) + '&nbsp;Foto hinzufügen<input id="f-photo-input" type="file" accept="image/*" multiple style="display:none" /></label>' +
      '</div>' +
      '<button class="btn-primary" data-action="save-expense">' + icon("check", 16, "var(--btn-fg)") + (editing ? " Änderungen speichern" : " Speichern") + "</button>"
    );
  }

  function renderWithdrawModal(s) {
    var currencies = Object.keys(s.rates);
    var persons = R.personsInData();
    if (!persons.length) persons = [s.sync.person || "Ich"];
    var who = wdPerson || s.sync.person || persons[0];
    var chips = persons.map(function (p) {
      return '<button type="button" class="cat-chip' + (who === p ? " active" : "") + '" style="--chip-color:#2B4C7E" data-action="pick-wd-person" data-person="' + escapeAttr(p) + '">' + icon("person", 14) + " " + escapeHtml(p) + "</button>";
    }).join("");
    var bal = R.cashBalances();
    var balHtml = bal.length
      ? '<div class="hint" style="margin-top:2px">In der Kasse: ' + bal.map(function (b) {
          return flagFor(b.currency) + " " + R.fmtMoney(b.rest, b.currency);
        }).join(" · ") + "</div>"
      : "";
    return modalShell("Bargeld abheben",
      '<div class="hint" style="margin-bottom:10px">Trag hier ein, wenn jemand Geld abhebt. Das ist noch keine Ausgabe — es wandert in eure gemeinsame Bargeld-Kasse. Was ihr davon bezahlt, tragt ihr wie gewohnt ein und wählt dort „Bargeld“.</div>' +
      '<div class="field-row">' +
      '<div class="field" style="flex:1.2"><label>Betrag</label><input id="w-amount" type="number" inputmode="decimal" placeholder="0.00" autofocus /></div>' +
      '<div class="field" style="flex:1"><label>Währung</label><select id="w-currency">' +
      currencies.map(function (c) { return '<option value="' + c + '"' + (c === s.trip.baseCurrency ? " selected" : "") + ">" + flagFor(c) + " " + c + "</option>"; }).join("") +
      "</select></div></div>" +
      '<div class="field"><label>Wer hat abgehoben?</label><div class="cat-grid">' + chips + "</div></div>" +
      '<div class="field"><label>Datum</label><input id="w-date" type="date" value="' + R.todayISO() + '" /></div>' +
      '<div class="field"><label>Notiz (optional)</label><input id="w-note" type="text" placeholder="z. B. Geldautomat Flughafen" /></div>' +
      balHtml +
      '<button class="btn-primary" data-action="save-withdrawal">' + icon("check", 16, "var(--btn-fg)") + " Abhebung speichern</button>"
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
      currencies.map(function (c) { return '<option value="' + c + '"' + (c === s.trip.baseCurrency ? " selected" : "") + ">" + flagFor(c) + " " + c + "</option>"; }).join("") +
      "</select></div>" +
      '<div class="field"><label>Budget in ' + escapeHtml(s.trip.baseCurrency) + ' (optional, leer = offen)</label>' +
      '<input id="s-budget" type="number" inputmode="decimal" min="0" step="0.01" placeholder="z. B. 3000" value="' + (s.trip.budget > 0 ? s.trip.budget : "") + '" /></div>' +

      // --- Sync ---
      '<div class="stub" style="padding:14px 16px">' +
      '<div class="section-title display" style="margin-bottom:4px">Gemeinsame Reisekasse</div>' +
      '<div class="hint" style="margin:0 0 10px">Damit zwei Handys dieselben Daten sehen: unten die Datenbank-Adresse aus der Anleitung, einen gemeinsamen Reise-Code (auf beiden Geräten exakt gleich) und deinen Namen eintragen.</div>' +
      '<div class="hint" style="margin:0 0 10px">Name und Datenbank-Adresse findest du jetzt im Profil (Startbildschirm, oben rechts).</div>' +
      '<div class="field" style="margin-bottom:8px"><label>Mitreisende in dieser Reise</label>' +
      (function () {
        var persons = R.personsInData();
        if (!persons.length || (persons.length === 1 && persons[0] === "Ich")) {
          return '<div class="hint">Noch niemand sichtbar — Mitreisende erscheinen hier automatisch mit ihrem ersten Eintrag.</div>';
        }
        return persons.map(function (p, i) {
          var count = s.expenses.filter(function (e) { return (e.person || "Ich") === p && e.kind !== "settlement"; }).length;
          return '<div class="member-row"><input id="member-' + i + '" type="text" value="' + escapeAttr(p) + '" maxlength="20" />' +
            '<span class="member-count">' + count + " Einträge</span>" +
            '<button class="btn-secondary member-save" data-action="rename-member" data-old="' + escapeAttr(p) + '" data-idx="' + i + '">' + icon("check", 14) + "</button></div>";
        }).join("") +
        '<div class="hint">Name ändern &amp; Häkchen: korrigiert ihn in allen bisherigen Einträgen — auf allen Geräten. Neue Mitreisende kommen automatisch dazu, sobald sie ihren ersten Eintrag machen (oder beim Eintragen unter \u201EBezahlt von \u2192 Anderer\u201C).</div>';
      })() +
      "</div>" +
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
      '<button class="btn-secondary" data-action="open-report" style="padding:10px">Als PDF exportieren (Bericht) 🖨</button>' +
      '<button class="btn-secondary" data-action="export-csv" style="padding:10px">Als CSV exportieren (Excel) ⬇️</button>' +
      '<button class="btn-primary" data-action="save-settings">' + icon("check", 16, "var(--btn-fg)") + " Übernehmen</button>" +
      '<div class="hint" style="text-align:center;margin-top:2px">TripCash · Version 34</div>'
    );
  }

  function rateRows(s) {
    return Object.keys(s.rates).map(function (c) {
      return '<div class="rate-row"><span class="flag">' + flagFor(c) + '</span><span class="code mono">' + c + '</span>' +
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
        (ui.introReplay
          ? '<button class="btn-primary ob-a" style="--d:640ms" data-action="onboard-replay-done">Fertig</button>'
          : '<button class="btn-primary ob-a" style="--d:640ms" data-action="onboard-next">Weiter</button>');
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
    var dotSteps = ui.introReplay ? [0, 1, 2, 3] : [0, 1, 2, 3, 4];
    var dots = dotSteps.map(function (i) {
      return '<span class="ob-dot' + (i === step ? " active" : "") + '"></span>';
    }).join("");
    return '<div class="onboard">' +
      '<div class="ob-stage" key="' + step + '">' + inner + "</div>" +
      '<div class="ob-dots">' + dots + "</div></div>";
  }

  function renderConverter(s) {
    var currencies = Object.keys(s.rates);
    if (currencies.length < 2) return "";
    var from = currencies.indexOf(calc.from) !== -1 ? calc.from : (currencies.filter(function (c) { return c !== s.trip.baseCurrency; })[0] || currencies[0]);
    var to = currencies.indexOf(calc.to) !== -1 ? calc.to : s.trip.baseCurrency;
    if (from === to) to = currencies.filter(function (c) { return c !== from; })[0] || to;

    if (!calc.open) {
      return '<button class="stub calc-collapsed" data-action="calc-toggle">' +
        '<span class="calc-icon">🔄</span>' +
        '<span class="calc-collapsed-text">Umrechner</span>' +
        '<span class="mono calc-collapsed-cur">' + flagFor(from) + " " + escapeHtml(from) + " → " + flagFor(to) + " " + escapeHtml(to) + "</span>" +
        icon("chevright", 14) + "</button>";
    }

    var amt = calc.amount != null ? calc.amount : "";
    var res = "";
    var val = parseFloat(String(amt).replace(",", "."));
    if (val > 0 && s.rates[from] && s.rates[to]) {
      res = R.fmtMoney(val * s.rates[from] / s.rates[to], to);
    }
    var one = (s.rates[from] && s.rates[to]) ? R.fmtMoney(1 * s.rates[from] / s.rates[to], to) : "";

    function opts(sel) {
      return currencies.map(function (c) {
        return '<option value="' + c + '"' + (c === sel ? " selected" : "") + ">" + flagFor(c) + " " + c + "</option>";
      }).join("");
    }

    return '<div class="stub calc-card">' +
      '<button class="calc-head" data-action="calc-toggle">' +
      '<span class="calc-icon">🔄</span><span class="calc-title">Umrechner</span>' +
      '<span class="calc-chev open">' + icon("chevright", 14) + "</span></button>" +
      '<div class="calc-row">' +
      '<input id="calc-amount" type="number" inputmode="decimal" placeholder="0" value="' + escapeAttr(String(amt)) + '" />' +
      '<select id="calc-from">' + opts(from) + "</select>" +
      '<button class="calc-swap" data-action="calc-swap" aria-label="Tauschen">⇄</button>' +
      '<select id="calc-to">' + opts(to) + "</select>" +
      "</div>" +
      '<div class="calc-result mono">' + (res || "—") + "</div>" +
      '<div class="calc-sub">1 ' + escapeHtml(from) + " = " + one + " · " + escapeHtml(R.rateStatusText()) + "</div>" +
      "</div>";
  }

  function renderHome(s) {
    var sums = R.tripSummaries();
    var cards = sums.map(function (t) {
      var range = t.startDate ? (t.startDate.slice(5) + (t.endDate ? " – " + t.endDate.slice(5) : "")) : "";
      return '<div class="stub trip-card">' +
        '<button class="trip-card-main" data-action="enter-trip" data-code="' + escapeAttr(t.code) + '">' +
        '<span class="trip-card-name display">' + escapeHtml(t.name) + "</span>" +
        '<span class="trip-card-meta">' + t.count + " Einträge · " + R.fmtMoney(t.total, t.base) + (range ? " · " + range : "") + "</span>" +
        '<span class="trip-card-code mono">' + escapeHtml(t.code) + "</span>" +
        "</button>" +
        (t.dbUrl ? '<button class="icon-btn trip-share" style="color:var(--ink)" data-action="share-trip" data-code="' + escapeAttr(t.code) + '" aria-label="Teilen">' + icon("share", 18) + "</button>" : "") +
        '<button class="icon-btn trip-del" style="color:var(--red)" data-action="delete-trip" data-code="' + escapeAttr(t.code) + '" aria-label="Reise löschen">' + icon("trash", 17) + "</button>" +
        "</div>";
    }).join("");

    var guide = "";
    if (!sums.length) {
      cards = "";
      guide = renderStarterGuide();
    }

    var avatar = R.getAvatar();
    var greet = s.sync.person ? "Hi " + escapeHtml(s.sync.person) + "!" : "TripCash";
    return '<div class="app-header">' +
      '<div style="display:flex;align-items:center;gap:10px">' + icon("wallet", 20, "var(--gold)") +
      '<div><div class="title display">Meine Reisen</div>' +
      '<div class="sub">' + greet + '</div></div></div>' +
      '<button class="icon-btn" data-action="open-profile" aria-label="Profil">' +
      (avatar ? '<span style="font-size:22px;line-height:1">' + escapeHtml(avatar) + "</span>" : icon("person", 22)) +
      "</button>" +
      "</div>" +
      '<div class="app-main" style="padding-bottom:24px">' +
      cards +
      '<button class="btn-primary" style="margin-top:6px" data-action="open-trip-wizard">' + icon("plus", 18, "var(--btn-fg)") + " Neue Reise</button>" +
      guide +
      '<div class="stub" style="margin-top:12px"><div class="section-title display">Mit Code oder Link beitreten</div>' +
      '<div class="add-currency-row"><input id="t-join-link" type="text" placeholder="Code oder Link einfügen" />' +
      '<button class="btn-secondary" data-action="join-trip">' + icon("check", 16) + "</button></div>" +
      '<div class="hint" id="t-join-hint">Einfach den Code vom Ersteller einfügen — mehr braucht es nicht.</div></div>' +
      renderConverter(s) +
      "</div>";
  }

  // Donut als SVG (Kreissegmente über stroke-dasharray)
  function reportDonut(byCat, total) {
    if (!total) return "";
    var R2 = 40, C = 2 * Math.PI * R2, off = 0;
    var segs = byCat.map(function (c) {
      var frac = c.value / total;
      var seg = '<circle r="' + R2 + '" cx="60" cy="60" fill="none" stroke="' + c.color + '" stroke-width="22" ' +
        'stroke-dasharray="' + (frac * C - (byCat.length > 1 ? 2 : 0)) + " " + C + '" stroke-dashoffset="' + (-off * C) + '" transform="rotate(-90 60 60)" />';
      off += frac;
      return seg;
    }).join("");
    return '<svg viewBox="0 0 120 120" class="rp-donut">' + segs + "</svg>";
  }

  function renderReport(s) {
    var d = R.computeDerived("all", false);
    var dAll = R.computeDerived("all", true);
    var st = R.computeSettlement();
    var weekdays = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

    // Tagesgruppen
    var groups = [], byDate = {};
    s.expenses.forEach(function (e) {
      if (!byDate[e.date]) { byDate[e.date] = []; groups.push(e.date); }
      byDate[e.date].push(e);
    });

    var catRows = d.byCat.map(function (c) {
      var cat = R.catFor(c.id);
      return '<div class="rp-legend"><i style="background:' + c.color + '"></i>' + cat.emoji + " " + escapeHtml(cat.label) +
        '<b class="mono">' + R.fmtMoney(c.value, d.base) + "</b></div>";
    }).join("");

    var settleHtml = "";
    if (st) {
      var pl = st.persons.map(function (p) {
        return '<div class="rp-line">' + escapeHtml(p.name) + " hat gezahlt<b class=\"mono\">" + R.fmtMoney(p.paid, st.base) + "</b></div>";
      }).join("");
      var tf = st.transfers.length
        ? st.transfers.map(function (t) {
            return '<div class="rp-transfer">' + escapeHtml(t.from) + " → " + escapeHtml(t.to) + ": <b class=\"mono\">" + R.fmtMoney(t.amount, st.base) + "</b></div>";
          }).join("")
        : '<div class="rp-transfer">✓ Alles ausgeglichen</div>';
      settleHtml = '<div class="rp-section"><h2>Ausgleich</h2>' + pl + tf + "</div>";
    }

    var budgetHtml = "";
    if (s.trip.budget > 0) {
      var pct = Math.min(100, Math.round(d.totalBase / s.trip.budget * 100));
      var over = d.totalBase > s.trip.budget;
      budgetHtml = '<div class="rp-section"><h2>Budget</h2>' +
        '<div class="budget-bar"><i style="width:' + pct + '%;background:' + (over ? "var(--red)" : "var(--gold)") + '"></i></div>' +
        '<div class="rp-line">' + R.fmtMoney(d.totalBase, d.base) + " von " + R.fmtMoney(s.trip.budget, d.base) +
        "<b>" + (over ? "überschritten" : pct + " %") + "</b></div></div>";
    }

    var days = groups.map(function (date) {
      var wd = "";
      try { wd = weekdays[new Date(date + "T12:00:00").getDay()] + ", "; } catch (e) {}
      var dayTotal = 0;
      var rows = byDate[date].map(function (e) {
        if (e.kind === "settlement") {
          return '<tr class="rp-settle"><td>✓</td><td>Ausgleich: ' + escapeHtml(e.from) + " → " + escapeHtml(e.to) + '</td><td></td><td class="mono">' + R.fmtMoney(e.amount, e.currency) + "</td></tr>";
        }
        if (!e.reimbursed) dayTotal += R.convertExpense(e);
        var cat = R.catFor(e.category);
        var info = [e.person, e.place, e.note].filter(Boolean).map(escapeHtml).join(" · ") +
          (e.shared === false ? " · privat" : "") + (e.reimbursed ? " · wird erstattet" : "");
        return "<tr><td>" + (cat.emoji || "•") + "</td><td>" + escapeHtml(cat.label) + (info ? '<span class="rp-info">' + info + "</span>" : "") + "</td>" +
          '<td class="mono rp-orig">' + flagFor(e.currency) + " " + R.fmtMoney(e.amount, e.currency) + "</td>" +
          '<td class="mono">' + R.fmtMoney(R.convertExpense(e), e.baseAtEntry) + "</td></tr>";
      }).join("");
      return '<div class="rp-day"><div class="rp-dayhead">' + wd + escapeHtml(date) +
        '<b class="mono">' + R.fmtMoney(dayTotal, d.base) + "</b></div><table>" + rows + "</table></div>";
    }).join("");

    var range = s.trip.startDate ? s.trip.startDate + (s.trip.endDate ? " bis " + s.trip.endDate : "") : "";

    return '<div class="report">' +
      '<div class="report-topbar no-print">' +
      '<button class="btn-secondary" data-action="close-report">' + icon("back", 16) + " Zurück</button>" +
      '<button class="btn-primary" data-action="print-report">Als PDF sichern / Drucken 🖨</button>' +
      "</div>" +
      '<div class="rp-head"><div class="rp-logo">' + icon("wallet", 26, "var(--gold)") + '</div>' +
      '<div><h1>' + escapeHtml(s.trip.name || "Meine Reise") + "</h1>" +
      '<div class="rp-meta">' + (range ? range + " · " : "") + d.dayCount + " Tage · " + s.expenses.filter(function(e){return e.kind!=="settlement";}).length + " Einträge · Basis " + flagFor(d.base) + " " + escapeHtml(d.base) + "</div></div></div>" +

      '<div class="rp-stats">' +
      '<div class="rp-stat"><span>Gesamt</span><b class="mono">' + R.fmtMoney(d.totalBase, d.base) + "</b></div>" +
      '<div class="rp-stat"><span>⌀ pro Tag</span><b class="mono">' + R.fmtMoney(d.avgPerDay, d.base) + "</b></div>" +
      (dAll.reimbursedTotal > 0 ? '<div class="rp-stat"><span>↩ Wird erstattet</span><b class="mono">' + R.fmtMoney(dAll.reimbursedTotal, d.base) + "</b></div>" +
        '<div class="rp-stat"><span>Reisekosten gesamt</span><b class="mono">' + R.fmtMoney(dAll.totalBase, d.base) + "</b></div>" : "") +
      "</div>" +
      budgetHtml +

      (d.byCat.length ? '<div class="rp-section"><h2>Nach Kategorien</h2><div class="rp-catwrap">' +
        reportDonut(d.byCat, d.totalBase) + '<div class="rp-legendwrap">' + catRows + "</div></div></div>" : "") +

      settleHtml +

      '<div class="rp-section"><h2>Alle Einträge</h2>' + (days || '<div class="rp-line">Noch keine Einträge.</div>') + "</div>" +

      '<div class="rp-foot">Erstellt mit TripCash · ' + new Date().toLocaleDateString("de-DE") + "</div>" +
      "</div>";
  }

  var twDraft = { name: "", start: "", end: "" };

  function renderTripWizard(s) {
    var step = ui.tripWizard.step;
    var inner;
    if (step === 0) {
      inner =
        '<div class="ob-tag ob-a" style="--d:0ms">' + icon("plus", 40, "var(--gold)") + "</div>" +
        '<h1 class="ob-title display ob-a" style="--d:120ms">Neue Reise</h1>' +
        '<p class="ob-text ob-a" style="--d:220ms">Wohin geht\u2019s? Gib deiner Reise einen Namen.</p>' +
        '<input class="ob-input ob-a" style="--d:320ms" id="tw-name" type="text" placeholder="z. B. Bali 2027" maxlength="40" value="' + escapeAttr(twDraft.name) + '" />' +
        '<div class="ob-a" style="--d:420ms;display:flex;gap:8px;width:100%">' +
        '<input id="tw-start" type="date" class="ob-input" style="flex:1;font-size:13px" value="' + escapeAttr(twDraft.start) + '" />' +
        '<input id="tw-end" type="date" class="ob-input" style="flex:1;font-size:13px" value="' + escapeAttr(twDraft.end) + '" />' +
        "</div>" +
        '<div class="hint ob-a" style="--d:460ms">Zeitraum optional — für den Tagesdurchschnitt.</div>' +
        '<button class="btn-primary ob-a" style="--d:540ms" data-action="tw-next">Weiter</button>';
    } else {
      inner =
        '<h1 class="ob-title display ob-a" style="--d:0ms">Budget festlegen?</h1>' +
        '<p class="ob-text ob-a" style="--d:120ms">Wenn du magst, wacht TripCash über euer Reisebudget — mit Fortschrittsbalken in der Übersicht. Du kannst es auch offen lassen.</p>' +
        '<input class="ob-input ob-a" style="--d:240ms" id="tw-budget" type="number" inputmode="decimal" min="0" placeholder="Betrag in ' + escapeAttr(s.trip.baseCurrency || "EUR") + '" />' +
        '<button class="btn-primary ob-a" style="--d:360ms" data-action="tw-create-budget">Budget festlegen &amp; los</button>' +
        '<button class="ob-link ob-a" style="--d:460ms" data-action="tw-create-open">Offen lassen &amp; los</button>';
    }
    var dots = [0, 1].map(function (i) { return '<span class="ob-dot' + (i === step ? " active" : "") + '"></span>'; }).join("");
    return '<div class="onboard">' +
      '<button class="wizard-close" data-action="tw-cancel">' + icon("x", 22) + "</button>" +
      '<div class="ob-stage" key="tw' + step + '">' + inner + "</div>" +
      '<div class="ob-dots">' + dots + "</div></div>";
  }

  var AVATARS = ["🧑‍✈️","🌍","🏝️","🎒","🛵","🍜","📸","🐢","🌋","⛺","🚆","🥥"];

  function renderProfileModal(s) {
    var stats = R.appStats();
    var flags = stats.currencies.map(function (c) { return flagFor(c); }).filter(Boolean).join(" ");
    var avatar = R.getAvatar();
    var avatarGrid = AVATARS.map(function (a) {
      return '<button type="button" class="avatar-opt' + (avatar === a ? " active" : "") + '" data-action="pick-avatar" data-avatar="' + escapeAttr(a) + '">' + a + "</button>";
    }).join("");

    return modalShell("Profil",
      '<div class="field"><label>Avatar</label><div class="avatar-grid">' + avatarGrid + "</div></div>" +
      '<div class="field"><label>Mein Name</label><input id="p-name" type="text" placeholder="z. B. Anna" value="' + escapeAttr(s.sync.person) + '" maxlength="20" />' +
      '<div class="hint">Sichtbar für dich und die Teilnehmer deiner Reisen. Gilt für neue Einträge — bestehende behalten den Namen, unter dem sie gespeichert wurden.</div></div>' +

      '<div class="field"><label>Stil der App</label><div class="theme-grid">' +
      R.THEMES.map(function (t) {
        var active = R.getTheme() === t.id;
        return '<button type="button" class="theme-opt' + (active ? " active" : "") + '" data-action="pick-theme" data-theme="' + t.id + '">' +
          '<span class="theme-swatch"><i style="background:' + t.sw[0] + '"></i><i style="background:' + t.sw[1] + '"></i><i style="background:' + t.sw[2] + '"></i></span>' +
          escapeHtml(t.label) + "</button>";
      }).join("") +
      '</div><div class="hint">Gilt nur für dieses Gerät.</div></div>' +

      '<div class="field"><label>Datenbank-Adresse (Firebase-URL)</label><input id="p-dburl" type="url" placeholder="https://…firebasedatabase.app" value="' + escapeAttr(s.sync.dbUrl) + '" />' +
      '<div class="hint">Der gemeinsame Speicher aller deiner Reisen. Einmal einrichten, dann vergessen.</div></div>' +

      '<div class="stub" style="padding:14px 16px"><div class="section-title display">Deine Reise-Bilanz</div>' +
      '<div style="font-size:13px">' + stats.trips + " Reisen · " + stats.entries + " Einträge · " + stats.photos + " Fotos</div>" +
      (stats.photos > 0 ? '<div class="hint" style="margin-top:4px">Fotos belegen grob ' + (Math.round(stats.photos * 0.18 * 10) / 10) + " MB von 1000 MB Gratis-Speicher — reicht für tausende Bilder.</div>" : "") +
      (flags ? '<div style="font-size:20px;margin-top:6px;letter-spacing:3px">' + flags + "</div>" : '<div class="hint">Noch keine Einträge — die Flaggen deiner Reisewährungen sammeln sich hier.</div>') +
      "</div>" +

      '<button class="btn-secondary" data-action="replay-intro" style="padding:10px">Intro nochmal ansehen ✨</button>' +
      '<button class="btn-primary" data-action="save-profile">' + icon("check", 16, "var(--btn-fg)") + " Übernehmen</button>" +
      '<div class="hint" style="text-align:center;margin-top:2px">TripCash · Version 34</div>'
    );
  }

  function guideArrow(label, cls) {
    return '<div class="g-note ' + (cls || "") + '"><span>' + label + "</span>" +
      '<svg viewBox="0 0 60 40" class="g-arrow"><path d="M6 6 C 24 4, 44 10, 52 30" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><path d="M45 26 L53 31 L54 21" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>';
  }

  function renderStarterGuide() {
    return '<div class="guide" aria-hidden="true">' +
      '<div class="guide-head display">So legst du los</div>' +
      '<div class="guide-sub">Eine kleine Tour mit Beispieldaten — deine echte Reise ist in unter einer Minute eingerichtet.</div>' +

      // Schritt 1
      '<div class="stub g-step"><div class="g-num">1</div><div class="g-body">' +
      '<div class="g-title">\u201ENeue Reise\u201C antippen</div>' +
      '<div class="g-mock g-mock-center">' + guideArrow("Hier tippen!", "g-right") +
      '<span class="btn-primary g-demo">' + icon("plus", 16, "var(--btn-fg)") + " Neue Reise</span>" +
      "</div></div></div>" +

      // Schritt 2
      '<div class="stub g-step"><div class="g-num">2</div><div class="g-body">' +
      '<div class="g-title">Name &amp; Zeitraum eingeben</div>' +
      '<div class="g-text">Der Zeitraum ist optional — er füttert den Tagesdurchschnitt.</div>' +
      '<div class="g-mock">' + guideArrow("Wohin geht\u2019s?", "g-left") +
      '<span class="ob-input g-demo g-input">Bali 2027</span>' +
      '<span class="g-daterow"><span class="ob-input g-demo g-date">10.07.2027</span><span class="ob-input g-demo g-date">02.08.2027</span></span>' +
      "</div></div></div>" +

      // Schritt 3
      '<div class="stub g-step"><div class="g-num">3</div><div class="g-body">' +
      '<div class="g-title">Budget festlegen — oder offen lassen</div>' +
      '<div class="g-text">Mit Budget bekommst du einen Fortschrittsbalken in der Übersicht.</div>' +
      '<div class="g-mock">' +
      '<span class="ob-input g-demo g-input">3.000 EUR</span>' +
      '<span class="btn-primary g-demo" style="margin-top:8px">Budget festlegen &amp; los</span>' +
      '<span class="g-or">oder einfach \u201EOffen lassen &amp; los\u201C</span>' +
      "</div></div></div>" +

      // Schritt 4
      '<div class="stub g-step"><div class="g-num">4</div><div class="g-body">' +
      '<div class="g-title">Mitreisende einladen</div>' +
      '<div class="g-text">Deine Reise erscheint hier als Karte. Über das Teilen-Symbol verschickst du die Einladung — mit Code drin.</div>' +
      '<div class="g-mock"><span class="g-card g-demo">' +
      '<span class="g-card-main"><b>Bali 2027</b><i>0 Einträge · 0,00 € · 07-10 – 08-02</i></span>' +
      '<span class="g-share">' + icon("share", 16) + "</span>" +
      "</span>" + guideArrow("Einladung senden", "g-share-note") +
      "</div>" +
      '<div class="g-text g-small">Die gemeinsame Datenbank ist bereits voreingestellt — Teilen funktioniert sofort, ohne Einrichtung.</div>' +
      "</div></div>" +

      // Schritt 5
      '<div class="stub g-step"><div class="g-num">5</div><div class="g-body">' +
      '<div class="g-title">Eingeladen worden?</div>' +
      '<div class="g-text">Dann brauchst du nichts anzulegen: Einladung unten einfügen, Häkchen, drin.</div>' +
      '<div class="g-mock"><span class="g-joinrow"><span class="ob-input g-demo g-input" style="text-align:left;font-size:13px">bali2027-x7k9q2</span>' +
      '<span class="btn-secondary g-demo g-check">' + icon("check", 15) + "</span></span>" +
      guideArrow("Code einfügen", "g-left") +
      "</div></div></div>" +
      "</div>";
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
      '<div class="hint" id="t-join-hint">Den Code bekommst du vom Ersteller (Teilen-Symbol neben der Reise) — einfach einfügen, fertig.</div></div>'
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

  // ISO-4217: Die ersten zwei Buchstaben des Währungscodes sind (fast immer)
  // der Ländercode — daraus lässt sich das Flaggen-Emoji direkt bauen.
  var FLAG_OVERRIDES = { EUR: "EU", XOF: "SN", XAF: "CM", XCD: "AG", ANG: "CW" };
  function flagFor(code) {
    if (!code || code.length < 2) return "";
    var cc = FLAG_OVERRIDES[code] || code.slice(0, 2).toUpperCase();
    if (!/^[A-Z]{2}$/.test(cc)) return "";
    return String.fromCodePoint(0x1F1E6 + cc.charCodeAt(0) - 65, 0x1F1E6 + cc.charCodeAt(1) - 65);
  }

  function nightsBetween(a, b) {
    if (!a || !b) return 0;
    var d = (new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 86400000;
    return d > 0 ? Math.round(d) : 0;
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function escapeAttr(str) { return escapeHtml(str); }

  /* ---------------- events ---------------- */

  function bindEvents(s) {
    var calcAmt = document.getElementById("calc-amount");
    if (calcAmt) {
      var recalcHandler = function () {
        calc.amount = calcAmt.value;
        calc.from = document.getElementById("calc-from").value;
        calc.to = document.getElementById("calc-to").value;
        saveCalc();
        var st2 = R.getState();
        var v = parseFloat((calc.amount || "").replace(",", "."));
        var out = document.querySelector(".calc-result");
        var sub = document.querySelector(".calc-sub");
        if (out) {
          out.textContent = (v > 0 && st2.rates[calc.from] && st2.rates[calc.to])
            ? R.fmtMoney(v * st2.rates[calc.from] / st2.rates[calc.to], calc.to) : "—";
        }
        if (sub && st2.rates[calc.from] && st2.rates[calc.to]) {
          sub.textContent = "1 " + calc.from + " = " + R.fmtMoney(st2.rates[calc.from] / st2.rates[calc.to], calc.to) +
            " · " + R.rateStatusText();
        }
      };
      calcAmt.addEventListener("input", recalcHandler);
      ["calc-from", "calc-to"].forEach(function (id) {
        var elc = document.getElementById(id);
        if (elc) elc.addEventListener("change", recalcHandler);
      });
    }

    var searchEl = document.getElementById("list-search");
    if (searchEl) {
      searchEl.addEventListener("input", function () {
        ui.searchQuery = searchEl.value;
        ui.searchRefocus = true;
        render();
      });
    }
    if (ui.searchRefocus) {
      ui.searchRefocus = false;
      var se = document.getElementById("list-search");
      if (se) {
        se.focus();
        try { se.setSelectionRange(se.value.length, se.value.length); } catch (e) {}
      }
    }
    function updateNightsHint() {
      var hintEl = document.getElementById("stay-nights");
      var ci = document.getElementById("f-checkin");
      var co = document.getElementById("f-checkout");
      if (!hintEl || !ci || !co) return;
      var n = nightsBetween(ci.value, co.value);
      if (n <= 0) { hintEl.textContent = ""; return; }
      var amtEl = document.getElementById("f-amount");
      var amt = parseFloat((amtEl ? amtEl.value : "").replace(",", "."));
      var txt = n + (n === 1 ? " Nacht" : " Nächte");
      if (n >= 2) {
        txt += " — der Betrag wird automatisch auf die Nächte verteilt";
        if (amt > 0) {
          var curEl = document.getElementById("f-currency");
          txt += " (je " + R.fmtMoney(amt / n, curEl ? curEl.value : "") + ")";
        }
      }
      hintEl.textContent = txt;
    }
    ["f-checkin", "f-checkout", "f-amount", "f-currency"].forEach(function (id) {
      var elD = document.getElementById(id);
      if (elD) { elD.addEventListener("change", updateNightsHint); elD.addEventListener("input", updateNightsHint); }
    });
    updateNightsHint();

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
        if (action === "close-modal") { editingId = null; stayEditTotal = null; pendingNewPhotos = []; ui.modal = null; render(); return; }
        if (action === "set-tab") { ui.tab = el.getAttribute("data-tab"); render(); return; }
        if (action === "filter") { ui.filterCat = el.getAttribute("data-cat"); render(); return; }
        if (action === "person-filter") { ui.personFilter = el.getAttribute("data-person"); render(); return; }
        if (action === "delete" || action === "delete-expense") {
          evt.stopPropagation(); // nicht zusätzlich das Bearbeiten der Zeile öffnen
          var delId = el.getAttribute("data-id");
          var delEntry = findExpense(R.getState(), delId);
          if (delEntry && delEntry.stayId) {
            R.deleteStay(delEntry.stayId); // ganzen Aufenthalt entfernen
          } else {
            R.deleteExpense(delId);
          }
          render();
          return;
        }

        if (action === "edit-expense") {
          var entry = findExpense(R.getState(), el.getAttribute("data-id"));
          if (!entry) return;
          editingId = entry.id;
          addFormCat = entry.category;
          addFormPerson = entry.person || "Ich";
          addFormShared = entry.shared !== false;
          addFormReimbursed = !!entry.reimbursed;
          addFormCash = !!entry.cash;
          stayEditTotal = entry.stayId ? R.stayTotal(entry.stayId) : null;
          ui.modal = "add";
          render();
          return;
        }

        if (action === "open-add") {
          editingId = null;
          stayEditTotal = null;
          pendingNewPhotos = [];
          addFormShared = true;
          addFormReimbursed = false;
          addFormCat = R.CATEGORIES[0].id;
          addFormPerson = R.getState().sync.person || "Ich";
          ui.modal = "add";
          render();
          return;
        }
        if (action === "open-settings") { ui.modal = "settings"; render(); return; }
        if (action === "open-gallery") { ui.modal = "gallery"; render(); return; }
        if (action === "open-trips") { ui.modal = "trips"; render(); return; }
        if (action === "go-home") { ui.view = "home"; ui.modal = null; render(); return; }
        if (action === "open-trip-wizard") { twDraft = { name: "", start: "", end: "" }; ui.tripWizard = { step: 0 }; render(); return; }
        if (action === "tw-cancel") { ui.tripWizard = null; render(); return; }
        if (action === "tw-next") {
          twDraft.name = (document.getElementById("tw-name").value || "").trim() || "Meine Reise";
          twDraft.start = document.getElementById("tw-start").value;
          twDraft.end = document.getElementById("tw-end").value;
          ui.tripWizard = { step: 1 };
          render();
          return;
        }
        if (action === "tw-create-budget" || action === "tw-create-open") {
          var twBudget = 0;
          if (action === "tw-create-budget") {
            twBudget = parseFloat((document.getElementById("tw-budget").value || "").replace(",", "."));
            if (!(twBudget > 0)) { document.getElementById("tw-budget").focus(); return; }
          }
          R.createTrip(twDraft.name, undefined, twBudget);
          if (twDraft.start || twDraft.end) {
            var st2 = R.getState();
            R.updateTrip(Object.assign({}, st2.trip, { startDate: twDraft.start, endDate: twDraft.end }));
          }
          ui.tripWizard = null;
          ui.view = "trip";
          render();
          return;
        }
        if (action === "open-profile") { ui.modal = "profile"; render(); return; }
        if (action === "pick-avatar") {
          R.setAvatar(el.getAttribute("data-avatar"));
          document.querySelectorAll(".avatar-opt").forEach(function (b) {
            b.classList.toggle("active", b.getAttribute("data-avatar") === R.getAvatar());
          });
          return;
        }
        if (action === "save-profile") {
          var pName = document.getElementById("p-name").value;
          var pDb = document.getElementById("p-dburl").value;
          R.updateSync({ dbUrl: pDb, person: pName });
          ui.modal = null;
          render();
          return;
        }
        if (action === "replay-intro") {
          ui.introReplay = true;
          ui.onboardStep = 0;
          ui.modal = null;
          render();
          return;
        }
        if (action === "delete-trip") {
          evt.stopPropagation();
          if (el.getAttribute("data-armed") !== "1") {
            el.setAttribute("data-armed", "1");
            el.innerHTML = '<span style="font-size:11px;font-weight:700">Sicher?</span>';
            setTimeout(function () {
              if (el.isConnected) { el.removeAttribute("data-armed"); el.innerHTML = icon("trash", 17); }
            }, 2500);
            return;
          }
          var delCode = el.getAttribute("data-code");
          var delEntry = R.listTrips().filter(function (x) { return x.code === delCode; })[0];
          R.deleteTrip(delCode);
          render();
          return;
        }
        if (action === "enter-trip") {
          R.switchTrip(el.getAttribute("data-code"));
          ui.view = "trip";
          render();
          return;
        }
        if (action === "switch-trip") { R.switchTrip(el.getAttribute("data-code")); ui.modal = null; render(); return; }
        if (action === "create-trip") {
          var tn = document.getElementById("t-new-name");
          var newName = (tn.value || "").trim();
          if (!newName) { tn.focus(); return; }
          R.createTrip(newName);
          ui.modal = null;
          ui.view = "trip";
          render();
          return;
        }
        if (action === "join-trip") {
          var jl = document.getElementById("t-join-link");
          var err = R.joinTrip(jl.value);
          var hint = document.getElementById("t-join-hint");
          if (err) { if (hint) hint.textContent = err; return; }
          ui.modal = null;
          ui.view = "trip";
          render();
          return;
        }
        if (action === "rename-member") {
          var oldN = el.getAttribute("data-old");
          var inputEl = document.getElementById("member-" + el.getAttribute("data-idx"));
          var newN = (inputEl.value || "").trim();
          if (!newN || newN === oldN) return;
          R.renamePerson(oldN, newN);
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
        if (action === "onboard-replay-done") {
          R.completeOnboarding(obNameDraft || "");
          obNameDraft = null;
          ui.introReplay = false;
          ui.onboardStep = 0;
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
          ui.view = "trip";
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
          ui.view = "trip";
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
          var dn = document.getElementById("date-normal");
          var ds = document.getElementById("date-stay");
          if (dn && ds) {
            dn.style.display = addFormCat === "unterkunft" ? "none" : "block";
            ds.style.display = addFormCat === "unterkunft" ? "block" : "none";
          }
          return;
        }

        if (action === "open-report") { ui.modal = null; ui.reportView = true; render(); return; }
        if (action === "close-report") { ui.reportView = false; ui.modal = "settings"; render(); return; }
        if (action === "print-report") {
          try { window.print(); } catch (e) {}
          return;
        }
        if (action === "export-csv") {
          var csv = R.exportCsv();
          try {
            var blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
            var a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = (s.trip.name || "reise").replace(/[^\w\u00C0-\u017F -]/g, "") + "-tripcash.csv";
            document.body.appendChild(a);
            a.click();
            a.remove();
          } catch (e) {}
          return;
        }
        if (action === "remind-later") {
          R.snoozeSettleReminder();
          render();
          return;
        }
        if (action === "remind-go") {
          R.snoozeSettleReminder();
          render();
          var target = document.getElementById("settle-card");
          if (target && target.scrollIntoView) target.scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }
        if (action === "set-scope") {
          ui.statScope = el.getAttribute("data-scope");
          render();
          return;
        }
        if (action === "filter-cat") {
          ui.categoryFilter = el.getAttribute("data-cat");
          ui.tab = "list";
          render();
          return;
        }
        if (action === "clear-cat-filter") {
          ui.categoryFilter = null;
          render();
          return;
        }
        if (action === "toggle-day") {
          var dayKey = el.getAttribute("data-day");
          if (!ui.openDays) ui.openDays = {};
          // Vom tatsächlichen Zustand ausgehen (heute ist standardmäßig offen)
          var wasOpen = ui.openDays.hasOwnProperty(dayKey) ? ui.openDays[dayKey] : (dayKey === R.todayISO());
          ui.openDays[dayKey] = !wasOpen;
          render();
          return;
        }
        if (action === "mark-settled") {
          R.addSettlement(el.getAttribute("data-from"), el.getAttribute("data-to"), parseFloat(el.getAttribute("data-amount")));
          render();
          return;
        }
        if (action === "calc-toggle") {
          calc.open = !calc.open;
          saveCalc();
          render();
          return;
        }
        if (action === "calc-swap") {
          var cf = document.getElementById("calc-from"), ct = document.getElementById("calc-to");
          calc.from = ct.value; calc.to = cf.value;
          saveCalc();
          render();
          return;
        }
        if (action === "open-withdraw") { wdPerson = null; ui.modal = "withdraw"; render(); return; }
        if (action === "pick-wd-person") {
          wdPerson = el.getAttribute("data-person");
          document.querySelectorAll('[data-action="pick-wd-person"]').forEach(function (chip) {
            chip.classList.toggle("active", chip.getAttribute("data-person") === wdPerson);
          });
          return;
        }
        if (action === "save-withdrawal") {
          var wAmt = parseFloat((document.getElementById("w-amount").value || "").replace(",", "."));
          if (!(wAmt > 0)) { document.getElementById("w-amount").focus(); return; }
          R.addWithdrawal({
            amount: wAmt,
            currency: document.getElementById("w-currency").value,
            person: wdPerson || s.sync.person || "Ich",
            date: document.getElementById("w-date").value || R.todayISO(),
            note: document.getElementById("w-note").value.trim()
          });
          ui.modal = null;
          render();
          return;
        }
        if (action === "pick-cash") {
          addFormCash = el.getAttribute("data-cash") === "1";
          document.querySelectorAll('[data-action="pick-cash"]').forEach(function (chip) {
            chip.classList.toggle("active", (chip.getAttribute("data-cash") === "1") === addFormCash);
          });
          return;
        }
        if (action === "pick-reimbursed") {
          addFormReimbursed = el.getAttribute("data-reimb") === "1";
          document.querySelectorAll('[data-action="pick-reimbursed"]').forEach(function (chip) {
            chip.classList.toggle("active", (chip.getAttribute("data-reimb") === "1") === addFormReimbursed);
          });
          return;
        }
        if (action === "pick-shared") {
          addFormShared = el.getAttribute("data-shared") === "1";
          document.querySelectorAll("#shared-grid .cat-chip").forEach(function (chip) {
            chip.classList.toggle("active", (chip.getAttribute("data-shared") === "1") === addFormShared);
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
          var isStay = addFormCat === "unterkunft";
          var ciEl = document.getElementById("f-checkin");
          var coEl = document.getElementById("f-checkout");
          var checkIn = isStay && ciEl ? (ciEl.value || R.todayISO()) : null;
          var checkOut = isStay && coEl && coEl.value ? coEl.value : null;
          if (checkIn && checkOut && checkOut < checkIn) { var tmpD = checkIn; checkIn = checkOut; checkOut = tmpD; }
          var payload = {
            amount: amount,
            currency: document.getElementById("f-currency").value,
            category: addFormCat,
            person: person,
            shared: addFormShared,
            reimbursed: addFormReimbursed,
            cash: addFormCash,
            checkIn: checkIn,
            checkOut: checkOut,
            date: isStay ? checkIn : (document.getElementById("f-date").value || R.todayISO()),
            place: document.getElementById("f-place").value.trim(),
            note: document.getElementById("f-note").value.trim()
          };
          var editingEntry = editingId ? findExpense(s, editingId) : null;
          if (editingEntry && editingEntry.stayId) {
            // Ganzen Aufenthalt neu verteilen
            R.replaceStay(editingEntry.stayId, payload);
          } else if (!editingId && isStay && checkIn && checkOut && checkOut > checkIn) {
            var madeStay = R.addStay(payload);
            pendingNewPhotos.forEach(function (dataURL) { R.addPhoto(madeStay[0].id, dataURL); });
            pendingNewPhotos = [];
          } else if (editingId) {
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

  function applySyncFieldsFromForm() { /* Name & DB leben jetzt im Profil */ }

  var bootShownAt = Date.now();
  function dismissBoot() {
    var boot = document.getElementById("boot");
    if (!boot) return;
    var elapsed = Date.now() - bootShownAt;
    var wait = Math.max(0, 1400 - elapsed);
    setTimeout(function () {
      boot.classList.add("out");
      setTimeout(function () { if (boot.parentNode) boot.parentNode.removeChild(boot); }, 650);
    }, wait);
  }

  window.ReisekasseUI = {
    init: function () { render(); dismissBoot(); },
    rerender: function () {
      if (ui.modal || ui.photoView || ui.tripWizard) { rerenderStatus(); return; }
      render();
    },
    rerenderStatus: rerenderStatus,
    setView: function (v) { ui.view = v; render(); }
  };
})();

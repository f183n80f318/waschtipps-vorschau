/* waschtipps.de – Feedback-Werkzeug für die Prüfversion.
   Kommentare und Textvorschläge werden an der angeklickten Stelle festgehalten.
   Echte Version: Jeder Eintrag geht sofort per POST an eine Google-Apps-Script-Adresse
   (CFG.endpoint), die ihn als Zeile in eine Google-Tabelle schreibt. Die Prüfenden brauchen
   dafür kein Konto. Demo-Version (CFG.demo): Einträge bleiben nur in diesem Browser. */
(function () {
  "use strict";
  var CFG = Object.assign({ demo: true, code: "WASCHEN26", endpoint: "" }, window.WT_FEEDBACK || {});
  var KEY = "wt-feedback-v1";
  var ZIELE = "h1, h2, h3, p, li, label, .kachel, .beispiele a, .knopf-dunkel, .knopf-haupt, .knopf-tuerkis, .knopf-neben, .symbole img, .held-bild, .video img, .hauptnav a, .logo, .ci-feld";
  var TEXTZIELE = "h1, h2, h3, p, li, .kachel span, .beispiele a, label";

  var ICO = {
    blase: '<svg class="ico" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>',
    stift: '<svg class="ico" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16zM13 7l4 4"/></svg>',
    seite: '<svg class="ico" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 3h9l4 4v14H6zM9 12h7M9 16h7"/></svg>',
    zu: '<svg class="ico" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    haken: '<svg class="ico" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>',
    wolke: '<svg class="ico" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 11a3.5 3.5 0 0 0 1 7z"/></svg>',
    tabelle: '<svg class="ico" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 4h16v16H4zM4 10h16M4 15h16M10 4v16"/></svg>'
  };

  var state = { frei: false, name: "", modus: "lesen", eintraege: [] };
  try {
    var s = JSON.parse(localStorage.getItem(KEY) || "null");
    if (s) { state.frei = !!s.frei; state.name = s.name || ""; state.eintraege = Array.isArray(s.eintraege) ? s.eintraege : []; }
  } catch (e) { /* ohne Speicher weiter */ }
  function sichern() {
    try { localStorage.setItem(KEY, JSON.stringify({ frei: state.frei, name: state.name, eintraege: state.eintraege })); } catch (e) { /* egal */ }
  }

  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function h(html) { var d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstChild; }
  function kurz(t, n) { t = String(t || "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; }
  function seite() { return CFG.seite || (document.title || "").replace(/ – waschtipps\.de.*$/, "") || location.pathname; }
  function zeit(iso) { var d = new Date(iso); return d.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
  function inWerkzeug(el) { return !!(el && el.closest && el.closest(".rv, .rv-pop, .rv-leiste, .rv-pin, .rv-tabelle-ansicht, .rv-toast")); }

  /* Eindeutiger Pfad zu einem Element, damit die Stelle später wiedergefunden wird */
  function pfad(el) {
    var teile = [];
    while (el && el.nodeType === 1 && el !== document.body) {
      if (el.id) { teile.unshift("#" + CSS.escape(el.id)); break; }
      var n = 1, b = el;
      while ((b = b.previousElementSibling)) { if (b.tagName === el.tagName) n++; }
      teile.unshift(el.tagName.toLowerCase() + ":nth-of-type(" + n + ")");
      el = el.parentElement;
    }
    return teile.join(" > ");
  }
  function finde(p) { try { return p ? document.querySelector(p) : null; } catch (e) { return null; } }
  function beschreibung(el) {
    if (!el) return "";
    if (el.tagName === "IMG") return "Bild: " + (el.alt || "ohne Beschreibung");
    var t = el.innerText || el.textContent || "";
    if (!t.trim()) { var img = el.querySelector("img"); return img ? "Bild: " + (img.alt || "Grafik") : el.tagName.toLowerCase(); }
    return kurz(t, 160);
  }

  /* Vergleich für Textvorschläge: gleicher Anfang und gleiches Ende bleiben stehen, die Mitte wird alt/neu gezeigt */
  function diff(alt, neu) {
    var a = String(alt).split(/(\s+)/), b = String(neu).split(/(\s+)/), i = 0, j = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    while (j < a.length - i && j < b.length - i && a[a.length - 1 - j] === b[b.length - 1 - j]) j++;
    var d = a.slice(i, a.length - j).join(""), n = b.slice(i, b.length - j).join("");
    return esc(a.slice(0, i).join("")) + (d ? "<del>" + esc(d) + "</del> " : "") + (n ? "<ins>" + esc(n) + "</ins>" : "") + esc(a.slice(a.length - j).join(""));
  }

  /* ---------- Senden ---------- */
  function senden(e) {
    e.status = "sendet"; sichern(); zeichneListe();
    var fertig = function (ok) { e.status = ok ? "ok" : "fehler"; sichern(); zeichneListe(); };
    if (CFG.demo) { setTimeout(function () { fertig(true); }, 450); return; }
    if (!CFG.endpoint) { e.status = "lokal"; sichern(); zeichneListe(); return; }
    /* Apps Script nimmt text/plain ohne Vorabanfrage an; die Antwort ist bei no-cors nicht lesbar. */
    fetch(CFG.endpoint, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ code: CFG.code, eintrag: e, adresse: location.href }) })
      .then(function () { fertig(true); }, function () { fertig(false); });
  }
  function neu(art, el, felder) {
    var e = Object.assign({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      zeit: new Date().toISOString(), name: state.name, seite: seite(), adresse: location.pathname, art: art,
      pfad: el ? pfad(el) : "", stelle: el ? beschreibung(el) : "ganze Seite", status: "offen"
    }, felder);
    state.eintraege.push(e); sichern(); senden(e); pins(); zeichneListe();
    melde(art === "aenderung" ? "Vorschlag gespeichert" : "Kommentar gespeichert");
    return e;
  }

  /* ---------- Oberfläche ---------- */
  var wurzel = h('<div class="rv"><button type="button" class="rv-start" aria-expanded="false" aria-controls="rv-panel">' + ICO.blase +
    '<span class="rv-wort">Feedback</span><span class="rv-zahl" hidden></span></button>' +
    '<section class="rv-panel" id="rv-panel" aria-labelledby="rv-titel" hidden></section></div>');
  var leiste = h('<div class="rv-leiste" role="status" hidden></div>');
  var toast = h('<div class="rv-toast" aria-live="polite"></div>');
  var ansicht = h('<div class="rv-tabelle-ansicht" role="dialog" aria-modal="true" aria-labelledby="rv-blatt-titel" hidden></div>');
  document.body.appendChild(leiste); document.body.appendChild(wurzel); document.body.appendChild(toast); document.body.appendChild(ansicht);
  var start = wurzel.querySelector(".rv-start"), panel = wurzel.querySelector(".rv-panel"), zahl = wurzel.querySelector(".rv-zahl");

  var toastUhr;
  function melde(t) { toast.textContent = t; toast.classList.add("an"); clearTimeout(toastUhr); toastUhr = setTimeout(function () { toast.classList.remove("an"); }, 2400); }

  function oeffnen(auf) {
    panel.hidden = !auf; start.setAttribute("aria-expanded", auf ? "true" : "false");
    if (auf) { zeichne(); var f = panel.querySelector("input, .rv-werkzeug"); if (f) f.focus(); }
  }
  start.addEventListener("click", function () { oeffnen(panel.hidden); });

  function zeichne() {
    var kopf = '<div class="rv-kopf"><h2 id="rv-titel">Feedback geben</h2><button type="button" class="rv-zu" data-a="zu" aria-label="Schließen">' + ICO.zu + "</button></div>";
    if (!state.frei && CFG.demo) {
      panel.innerHTML = kopf + '<form class="rv-inhalt" data-a="code">' +
        "<p>Diese Vorschau ist nur für das Team des FORUM WASCHEN. Bitte geben Sie den Zugangscode ein, den Sie per E-Mail bekommen haben.</p>" +
        '<label class="rv-feld">Zugangscode<input id="rv-code" name="code" autocomplete="off" autocapitalize="characters" required></label>' +
        '<p class="rv-fehler" id="rv-code-fehler" hidden>Der Code stimmt nicht. Bitte prüfen Sie Groß- und Kleinschreibung.</p>' +
        '<button class="rv-knopf" type="submit">Weiter</button>' +
        (CFG.demo ? '<p class="rv-klein">Code für diese Demo: <b>WASCHEN26</b></p>' : "") + "</form>";
      return;
    }
    panel.innerHTML = kopf + '<div class="rv-inhalt">' +
      '<label class="rv-feld">Ihr Name <span class="rv-klein">(freiwillig, damit wir nachfragen können)</span><input id="rv-name" value="' + esc(state.name) + '" autocomplete="name"></label>' +
      '<div><p class="rv-frage">Was möchten Sie tun?</p><div class="rv-werkzeuge">' +
      werkzeug("kommentar", ICO.blase, "Etwas kommentieren", "Danach auf die Stelle klicken oder Text markieren") +
      werkzeug("aendern", ICO.stift, "Text ändern", "Danach auf einen Text klicken und ihn umschreiben") +
      '<button type="button" class="rv-werkzeug" data-a="allgemein"><span class="rv-sym">' + ICO.seite + "</span><b>Zur ganzen Seite</b><small>Allgemeiner Eindruck, fehlende Inhalte</small></button>" +
      '</div></div><form id="rv-allgemein" class="rv-feld" hidden><label for="rv-allgemein-text">Ihr Kommentar zur ganzen Seite</label><textarea id="rv-allgemein-text" rows="4"></textarea>' +
      '<div class="rv-reihe"><button class="rv-knopf" type="submit">Speichern</button><button class="rv-knopf neben" type="button" data-a="allgemein-zu">Abbrechen</button></div></form>' +
      '<div><p class="rv-frage" id="rv-liste-titel">Ihre Anmerkungen auf dieser Seite</p><ul class="rv-liste" aria-labelledby="rv-liste-titel"></ul></div></div>' +
      '<div class="rv-fuss"><p class="rv-speicher">' + ICO.wolke + "<span>" +
      (CFG.demo ? "<b>Demo:</b> Ihre Anmerkungen bleiben in diesem Browser. In der echten Version werden sie sofort gespeichert, ohne dass Sie etwas abschicken müssen."
        : CFG.endpoint ? "Jede Anmerkung wird sofort gespeichert. Sie müssen nichts abschicken."
        : "Ihre Anmerkungen werden in diesem Browser gespeichert, auch über mehrere Seiten hinweg. Wenn Sie fertig sind, laden Sie bitte alle Anmerkungen als Datei herunter und schicken Sie diese per E-Mail zurück.") + "</span></p>" +
      (CFG.demo ? '<div class="rv-reihe"><button type="button" class="rv-knopf neben" data-a="tabelle">' + ICO.tabelle + "So kommt es bei der Redaktion an</button></div></div>"
        : '<p class="rv-klein" id="rv-gesamt"></p><div class="rv-reihe">' + (CFG.endpoint ? "" : '<button type="button" class="rv-knopf" data-a="datei">Alle Anmerkungen herunterladen</button>') +
          '<button type="button" class="rv-knopf neben" data-a="kopieren">Als Text kopieren</button></div></div>');
    zeichneListe();
  }
  function werkzeug(m, ico, t, s) {
    return '<button type="button" class="rv-werkzeug" data-modus="' + m + '" aria-pressed="' + (state.modus === m) + '"><span class="rv-sym">' + ico + "</span><b>" + t + "</b><small>" + s + "</small></button>";
  }
  function eintragHtml(e, nr) {
    var art = { kommentar: "Kommentar", aenderung: "Textvorschlag", allgemein: "Zur ganzen Seite" }[e.art];
    var st = e.status === "ok" ? '<span class="rv-status">' + ICO.haken + "gespeichert</span>"
      : e.status === "lokal" ? '<span class="rv-status offen">' + ICO.haken + "in diesem Browser</span>"
      : e.status === "fehler" ? '<span class="rv-status fehler">nicht gesendet</span>' : '<span class="rv-status offen">wird gespeichert …</span>';
    var inhalt = e.art === "aenderung"
      ? '<p class="rv-text rv-diff">' + diff(e.alt, e.neu) + "</p>" + (e.kommentar ? '<p class="rv-text rv-klein">' + esc(e.kommentar) + "</p>" : "")
      : '<p class="rv-text">' + esc(e.kommentar) + "</p>";
    return '<li class="rv-eintrag" id="rv-e-' + e.id + '"><div class="rv-eintrag-kopf"><span class="rv-nr">' + nr + '</span><span class="rv-art">' + art + "</span>" + st + "</div>" +
      (e.art !== "allgemein" && e.art !== "aenderung" ? '<p class="rv-zitat">' + esc(kurz(e.zitat || e.stelle, 140)) + "</p>" : "") + inhalt +
      '<div class="rv-reihe">' + (e.pfad ? '<button type="button" class="rv-knopf neben" data-a="zeigen" data-id="' + e.id + '">Stelle zeigen</button>' : "") +
      (e.status === "fehler" ? '<button type="button" class="rv-knopf neben" data-a="nochmal" data-id="' + e.id + '">Erneut senden</button>' : "") +
      '<button type="button" class="rv-knopf neben" data-a="loeschen" data-id="' + e.id + '">Löschen</button></div></li>';
  }
  function hier() { return state.eintraege.filter(function (e) { return e.seite === seite(); }); }
  function zeichneListe() {
    var n = hier().length;
    zahl.hidden = !n; zahl.textContent = n;
    var ges = panel.querySelector("#rv-gesamt");
    if (ges) ges.textContent = state.eintraege.length ? "Insgesamt " + state.eintraege.length + " Anmerkung" + (state.eintraege.length === 1 ? "" : "en") + " auf allen Seiten." : "";
    var ul = panel.querySelector(".rv-liste"); if (!ul) return;
    ul.innerHTML = n ? hier().map(function (e, i) { return eintragHtml(e, i + 1); }).join("")
      : '<li class="rv-leer">Noch keine Anmerkungen. Wählen Sie oben, was Sie tun möchten.</li>';
  }

  panel.addEventListener("submit", function (ev) {
    ev.preventDefault();
    if (ev.target.getAttribute("data-a") === "code") {
      var wert = panel.querySelector("#rv-code").value.trim();
      /* Echte Version: Die Seite ist mit dem Code verschlüsselt, und das Skript prüft ihn bei jedem Eintrag noch einmal. */
      if (wert.toUpperCase() === String(CFG.code).toUpperCase()) { state.frei = true; sichern(); zeichne(); var f = panel.querySelector("#rv-name"); if (f) f.focus(); }
      else { panel.querySelector("#rv-code-fehler").hidden = false; }
    } else if (ev.target.id === "rv-allgemein") {
      var t = panel.querySelector("#rv-allgemein-text").value.trim();
      if (!t) { panel.querySelector("#rv-allgemein-text").focus(); return; }
      neu("allgemein", null, { kommentar: t });
      ev.target.hidden = true; ev.target.reset();
    }
  });
  panel.addEventListener("input", function (ev) { if (ev.target.id === "rv-name") { state.name = ev.target.value; sichern(); } });
  panel.addEventListener("click", function (ev) {
    var b = ev.target.closest("button"); if (!b) return;
    var a = b.getAttribute("data-a"), id = b.getAttribute("data-id");
    var e = state.eintraege.filter(function (x) { return x.id === id; })[0];
    if (a === "zu") { oeffnen(false); start.focus(); }
    else if (b.hasAttribute("data-modus")) { modus(state.modus === b.getAttribute("data-modus") ? "lesen" : b.getAttribute("data-modus")); }
    else if (a === "allgemein") { var f = panel.querySelector("#rv-allgemein"); f.hidden = false; panel.querySelector("#rv-allgemein-text").focus(); }
    else if (a === "allgemein-zu") { panel.querySelector("#rv-allgemein").hidden = true; }
    else if (a === "zeigen" && e) { var el = finde(e.pfad); if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); blink(el); } }
    else if (a === "loeschen" && e) { state.eintraege = state.eintraege.filter(function (x) { return x !== e; }); sichern(); pins(); zeichneListe(); melde("Gelöscht"); }
    else if (a === "nochmal" && e) { senden(e); }
    else if (a === "tabelle") { tabelle(); }
    else if (a === "datei") { datei(); }
    else if (a === "kopieren") { kopieren(panel.querySelector(".rv-fuss")); }
  });
  function blink(el) {
    el.classList.add("rv-ziel"); document.body.classList.add("rv-modus-kommentar");
    setTimeout(function () { el.classList.remove("rv-ziel"); if (state.modus === "lesen") document.body.classList.remove("rv-modus-kommentar"); }, 1400);
  }

  /* ---------- Modus: Kommentieren / Ändern ---------- */
  function modus(m) {
    abbrechen();
    state.modus = m;
    document.body.classList.toggle("rv-modus-kommentar", m === "kommentar");
    document.body.classList.toggle("rv-modus-aendern", m === "aendern");
    panel.querySelectorAll("[data-modus]").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-modus") === m ? "true" : "false"); });
    if (m === "lesen") { leiste.hidden = true; return; }
    leiste.innerHTML = '<span class="rv-sym">' + (m === "kommentar" ? ICO.blase : ICO.stift) + "</span><span>" +
      (m === "kommentar" ? "Kommentieren: Klicken Sie auf die Stelle, die Sie meinen, oder markieren Sie Text." : "Text ändern: Klicken Sie auf einen Text und schreiben Sie ihn um.") +
      '</span><button type="button">Fertig</button>';
    leiste.hidden = false;
    leiste.querySelector("button").addEventListener("click", function () { modus("lesen"); });
    if (window.innerWidth < 700) oeffnen(false);
  }
  var markiert = null;
  document.addEventListener("mouseover", function (ev) {
    if (state.modus === "lesen" || offen) return;
    var z = ev.target.closest ? ev.target.closest(state.modus === "aendern" ? TEXTZIELE : ZIELE) : null;
    if (z && inWerkzeug(z)) z = null;
    if (markiert && markiert !== z) markiert.classList.remove("rv-ziel");
    markiert = z; if (z) z.classList.add("rv-ziel");
  });

  var offen = null; /* aktuell geöffnetes Eingabefeld */
  function abbrechen() {
    if (!offen) return;
    if (offen.el && offen.bearbeitet) { offen.el.innerHTML = offen.html; offen.el.contentEditable = "false"; offen.el.classList.remove("rv-bearbeitet"); }
    offen.pop.remove(); offen = null;
  }
  function platziere(pop, el) {
    var r = el.getBoundingClientRect(), x = r.left + window.scrollX, y = r.bottom + window.scrollY + 12;
    var w = Math.min(360, window.innerWidth - 32);
    x = Math.max(16 + window.scrollX, Math.min(x, window.scrollX + window.innerWidth - w - 16));
    pop.style.left = x + "px"; pop.style.top = y + "px";
  }

  var auswahlGerade = false;
  document.addEventListener("mouseup", function (ev) {
    if (state.modus !== "kommentar" || offen || inWerkzeug(ev.target)) return;
    var sel = window.getSelection(), t = sel ? sel.toString().trim() : "";
    if (t.length < 3) return;
    var knoten = sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement);
    var el = knoten && knoten.closest(ZIELE); if (!el || inWerkzeug(el)) return;
    auswahlGerade = true; setTimeout(function () { auswahlGerade = false; }, 50);
    kommentarFeld(el, t);
  });

  document.addEventListener("click", function (ev) {
    var t = ev.target;
    if (inWerkzeug(t)) return;
    if (state.modus === "lesen") {
      var a = t.closest && t.closest("a[href]");
      if (CFG.demo && a && !/^https?:/.test(a.getAttribute("href")) && !/^#/.test(a.getAttribute("href"))) { ev.preventDefault(); melde("Die Demo enthält nur die Startseite."); }
      return;
    }
    if (offen && offen.el && offen.el.contains(t)) return; /* im bearbeiteten Text klicken */
    ev.preventDefault(); ev.stopPropagation();
    if (auswahlGerade) return;
    if (offen) { abbrechen(); return; }
    var el = t.closest(state.modus === "aendern" ? TEXTZIELE : ZIELE);
    if (!el) { melde(state.modus === "aendern" ? "Bitte klicken Sie direkt auf einen Text." : "Bitte klicken Sie auf einen Text, ein Bild oder eine Schaltfläche."); return; }
    if (markiert) markiert.classList.remove("rv-ziel");
    if (state.modus === "kommentar") kommentarFeld(el, ""); else aendernFeld(el);
  }, true);
  document.addEventListener("submit", function (ev) { if (state.modus !== "lesen" || CFG.demo) { if (!inWerkzeug(ev.target)) ev.preventDefault(); } }, true);
  document.addEventListener("keydown", function (ev) {
    if (ev.key !== "Escape") return;
    if (!ansicht.hidden) { ansicht.hidden = true; return; }
    if (offen) { abbrechen(); return; }
    if (state.modus !== "lesen") { modus("lesen"); return; }
    if (!panel.hidden) { oeffnen(false); start.focus(); }
  });

  function kommentarFeld(el, zitat) {
    abbrechen();
    var pop = h('<form class="rv-pop" aria-label="Kommentar schreiben"><p class="rv-zitat">' + esc(kurz(zitat || beschreibung(el), 160)) + "</p>" +
      '<div><label for="rv-pop-text">Was fällt Ihnen hier auf?</label><textarea id="rv-pop-text" rows="4" placeholder="z. B. Das verstehe ich nicht, hier fehlt etwas, das stimmt so nicht …"></textarea></div>' +
      '<div class="rv-reihe"><button class="rv-knopf" type="submit">Speichern</button><button class="rv-knopf neben" type="button">Abbrechen</button></div></form>');
    document.body.appendChild(pop); platziere(pop, el);
    offen = { pop: pop, el: el, bearbeitet: false };
    var ta = pop.querySelector("textarea"); ta.focus({ preventScroll: true });
    pop.querySelector(".neben").addEventListener("click", abbrechen);
    pop.addEventListener("submit", function (ev) {
      ev.preventDefault(); var t = ta.value.trim(); if (!t) { ta.focus(); return; }
      pop.remove(); offen = null; window.getSelection().removeAllRanges();
      neu("kommentar", el, { kommentar: t, zitat: zitat || "" });
    });
  }
  function aendernFeld(el) {
    abbrechen();
    var html = el.innerHTML, alt = (el.innerText || el.textContent).trim();
    el.contentEditable = "true"; el.classList.add("rv-bearbeitet"); el.focus();
    var pop = h('<form class="rv-pop" aria-label="Textvorschlag speichern"><p>Schreiben Sie den markierten Text direkt um.</p>' +
      '<div><label for="rv-pop-grund">Warum? <span class="rv-klein">(freiwillig)</span></label><textarea id="rv-pop-grund" rows="2"></textarea></div>' +
      '<p class="rv-fehler" hidden>Sie haben den Text noch nicht verändert.</p>' +
      '<div class="rv-reihe"><button class="rv-knopf" type="submit">Vorschlag speichern</button><button class="rv-knopf neben" type="button">Abbrechen</button></div></form>');
    document.body.appendChild(pop); platziere(pop, el);
    offen = { pop: pop, el: el, html: html, bearbeitet: true };
    pop.querySelector(".neben").addEventListener("click", abbrechen);
    pop.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var neuText = (el.innerText || el.textContent).replace(/\s+/g, " ").trim();
      if (neuText === alt.replace(/\s+/g, " ")) { pop.querySelector(".rv-fehler").hidden = false; el.focus(); return; }
      el.contentEditable = "false"; el.classList.remove("rv-bearbeitet"); el.classList.add("rv-geaendert");
      pop.remove(); offen = null;
      neu("aenderung", el, { alt: alt, neu: neuText, kommentar: pop.querySelector("textarea").value.trim(), stelle: kurz(alt, 160) });
    });
    el.addEventListener("keydown", function enter(ev) {
      if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); if (offen && offen.pop === pop) pop.requestSubmit(); }
      if (!offen || offen.pop !== pop) el.removeEventListener("keydown", enter);
    });
  }

  /* ---------- Nummern an den Stellen ---------- */
  var pinListe = [];
  function pins() {
    pinListe.forEach(function (p) { p.remove(); }); pinListe = [];
    hier().forEach(function (e, i) {
      var el = finde(e.pfad); if (!el) return;
      var r = el.getBoundingClientRect(); if (!r.width && !r.height) return;
      var p = h('<button type="button" class="rv-pin' + (e.art === "aenderung" ? " aenderung" : "") + '" aria-label="Anmerkung ' + (i + 1) + ' öffnen">' + (i + 1) + "</button>");
      p.style.left = Math.min(r.right + window.scrollX - 12, document.documentElement.clientWidth - 40) + "px";
      p.style.top = Math.max(r.top + window.scrollY - 14, 0) + "px";
      p.addEventListener("click", function (ev) {
        ev.stopPropagation(); oeffnen(true);
        var li = document.getElementById("rv-e-" + e.id);
        if (li) { li.scrollIntoView({ block: "nearest" }); li.classList.add("blink"); setTimeout(function () { li.classList.remove("blink"); }, 1600); }
      });
      document.body.appendChild(p); pinListe.push(p);
    });
  }
  var uhr; window.addEventListener("resize", function () { clearTimeout(uhr); uhr = setTimeout(pins, 150); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(pins);
  window.addEventListener("load", pins);

  /* ---------- Ansicht der Tabelle (wie sie bei der Redaktion ankommt) ---------- */
  var BEISPIELE = [
    { zeit: "2026-11-24T09:12:00", name: "Beispiel", seite: "Startseite", art: "kommentar", stelle: "Geräte", kommentar: "Warum ist die Kachel lila? Passt farblich nicht zu den anderen." },
    { zeit: "2026-11-24T09:15:00", name: "Beispiel", seite: "Startseite", art: "aenderung", stelle: "Tipps zum Waschen, Spülen und Putzen. Fragen Sie einfach in Ihren eigenen Worten.", alt: "Fragen Sie einfach in Ihren eigenen Worten.", neu: "Stellen Sie Ihre Frage einfach so, wie Sie sie im Alltag stellen würden.", kommentar: "klingt freundlicher" },
    { zeit: "2026-11-24T10:02:00", name: "Beispiel", seite: "Welches Waschmittel brauche ich für Wolle?", art: "allgemein", stelle: "ganze Seite", kommentar: "Hier fehlt der Hinweis auf das Wollsiegel." }
  ];
  function tabelle() {
    var zeilen = BEISPIELE.map(function (e) { e.beispiel = true; return e; }).concat(state.eintraege);
    var art = { kommentar: "Kommentar", aenderung: "Textvorschlag", allgemein: "Ganze Seite" };
    var sp = ["Zeitpunkt", "Name", "Seite", "Art", "Stelle auf der Seite", "Kommentar", "Vorschlag (alt → neu)"];
    ansicht.innerHTML = '<div class="rv-blatt"><div class="rv-blatt-kopf"><div><h2 id="rv-blatt-titel">So kommt das Feedback bei der Redaktion an</h2>' +
      "<p>Jede Anmerkung landet sofort als eine Zeile in einer Google-Tabelle im Konto der Redaktion. Die Prüfenden sehen diese Tabelle nicht und brauchen kein Konto. Die Tabelle lässt sich als CSV oder Excel herunterladen und an Claude weitergeben.</p></div>" +
      '<button type="button" class="rv-zu" aria-label="Schließen">' + ICO.zu + "</button></div>" +
      '<div class="rv-dateiname">' + ICO.tabelle + "waschtipps-Feedback (Google Tabelle) · graue Zeilen sind Beispiele</div>" +
      '<div class="rv-blatt-rahmen"><table><thead><tr><th class="rv-zeile"></th>' + sp.map(function (s, i) { return '<th class="rv-spalte">' + "ABCDEFG"[i] + "</th>"; }).join("") + "</tr>" +
      '<tr><th class="rv-zeile">1</th>' + sp.map(function (s) { return "<th>" + s + "</th>"; }).join("") + "</tr></thead><tbody>" +
      zeilen.map(function (e, i) {
        return '<tr class="' + (e.beispiel ? "beispiel" : "") + '"><td class="rv-zeile">' + (i + 2) + "</td><td>" + esc(zeit(e.zeit)) + "</td><td>" + esc(e.name || "–") + "</td><td>" + esc(e.seite) + "</td><td>" + art[e.art] +
          "</td><td>" + esc(kurz(e.zitat || e.stelle, 90)) + "</td><td>" + esc(e.kommentar || "") + '</td><td class="rv-diff-zelle">' + (e.art === "aenderung" ? diff(e.alt, e.neu) : "") + "</td></tr>";
      }).join("") + "</tbody></table></div>" +
      '<div class="rv-blatt-fuss"><span class="rv-klein">Notlösung ohne Internet: Die eigenen Anmerkungen lassen sich als Text kopieren und per E-Mail schicken.</span><button type="button" class="rv-knopf neben" data-a="kopieren">Eigene Anmerkungen als Text kopieren</button></div></div>';
    ansicht.hidden = false;
    ansicht.querySelector(".rv-zu").focus();
  }
  function alsText() {
    return "# Feedback zu waschtipps.de\n\n" + state.eintraege.map(function (e, i) {
      var z = "## " + (i + 1) + ". " + e.seite + " – " + ({ kommentar: "Kommentar", aenderung: "Textvorschlag", allgemein: "Ganze Seite" })[e.art] + "\n\n";
      z += "- Von: " + (e.name || "ohne Namen") + ", " + zeit(e.zeit) + "\n- Stelle: " + (e.zitat || e.stelle) + "\n- Adresse: " + (e.adresse || "–") + "\n- Pfad: `" + (e.pfad || "–") + "`\n";
      if (e.art === "aenderung") z += "- Alt: " + e.alt + "\n- Neu: " + e.neu + "\n";
      if (e.kommentar) z += "- Kommentar: " + e.kommentar + "\n";
      return z;
    }).join("\n");
  }
  function kopieren(ort) {
    if (!state.eintraege.length) { melde("Noch keine Anmerkungen"); return; }
    var text = alsText();
    var fallback = function () {
      var ta = ort.querySelector("textarea.rv-export") || ort.appendChild(document.createElement("textarea"));
      ta.className = "rv-export"; ta.value = text; ta.setAttribute("aria-label", "Anmerkungen als Text"); ta.rows = 6; ta.style.width = "100%";
      ta.focus(); ta.select(); melde("Text markiert: jetzt kopieren");
    };
    try { navigator.clipboard.writeText(text).then(function () { melde("Kopiert. Sie können den Text jetzt in eine E-Mail einfügen."); }, fallback); } catch (e) { fallback(); }
  }
  function datei() {
    if (!state.eintraege.length) { melde("Noch keine Anmerkungen"); return; }
    var name = (state.name || "ohne-namen").toLowerCase().replace(/[^a-z0-9äöüß]+/g, "-").replace(/^-|-$/g, "");
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([alsText()], { type: "text/markdown;charset=utf-8" }));
    a.download = "waschtipps-feedback-" + name + "-" + new Date().toISOString().slice(0, 10) + ".md";
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    melde("Datei gespeichert. Bitte per E-Mail zurückschicken.");
  }
  ansicht.addEventListener("click", function (ev) {
    if (ev.target === ansicht || ev.target.closest(".rv-zu")) { ansicht.hidden = true; start.focus(); return; }
    if (ev.target.closest("[data-a='kopieren']")) kopieren(ansicht.querySelector(".rv-blatt-fuss"));
  });

  zeichneListe();
})();

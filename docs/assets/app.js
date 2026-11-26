/* waschtipps.de – Prototyp: Menü, Weitergabe, Suche, Fragenfinder, Pflegesymbol-Finder. */
(function () {
  "use strict";
  var basis = document.documentElement.getAttribute("data-basis") || "";

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }
  function el(html) { var d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstChild; }
  var PFEIL = '<svg class="ico" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  var ZURUECK = '<svg class="ico" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>';
  var HAKEN = '<svg class="ico haken" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';

  /* Menü (Handy) */
  var knopf = document.querySelector(".nav-knopf");
  var nav = document.getElementById("hauptnav");
  if (knopf && nav) {
    knopf.addEventListener("click", function () {
      var offen = nav.classList.toggle("offen");
      knopf.setAttribute("aria-expanded", offen ? "true" : "false");
    });
  }

  /* Weitergabe: Drucken, Link teilen, Per E-Mail */
  var meldung = document.getElementById("meldung");
  function melde(t) { if (meldung) { meldung.textContent = ""; setTimeout(function () { meldung.textContent = t; }, 50); } }
  document.querySelectorAll("[data-aktion]").forEach(function (b) {
    b.addEventListener("click", function () {
      var a = b.getAttribute("data-aktion");
      var titel = document.title.replace(/ – waschtipps\.de$/, "");
      if (a === "drucken") {
        try { window.print(); } catch (e) { /* in manchen Ansichten gesperrt */ }
        melde("Falls kein Druckfenster erscheint: Bitte die Druckfunktion Ihres Browsers nutzen.");
      } else if (a === "teilen") {
        var url = location.href;
        if (navigator.share) {
          navigator.share({ title: titel, url: url }).catch(function () { kopiere(url); });
        } else { kopiere(url); }
      } else if (a === "mail") {
        var kurz = (document.querySelector(".kurz .inhalt") || {}).textContent || "";
        location.href = "mailto:?subject=" + encodeURIComponent(titel) + "&body=" + encodeURIComponent(titel + "\n\n" + kurz.trim() + "\n\n" + location.href);
        melde("Ihr E-Mail-Programm sollte sich jetzt öffnen.");
      }
    });
  });
  function kopiere(t) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(function () {
        melde("Link kopiert. Sie können ihn jetzt einfügen und versenden.");
        var k = document.querySelector('[data-aktion="teilen"]');
        if (k && !k.dataset.text) { k.dataset.text = k.innerHTML; k.classList.add("bestaetigt"); k.innerHTML = '<svg class="ico" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>Link kopiert';
          setTimeout(function () { k.innerHTML = k.dataset.text; delete k.dataset.text; k.classList.remove("bestaetigt"); }, 2200); }
      },
        function () { melde("Link: " + t); });
    } else { melde("Link: " + t); }
  }

  /* Suche */
  function falte(s) {
    return String(s).toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
      .replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  }
  var STOPP = { der: 1, die: 1, das: 1, und: 1, oder: 1, ich: 1, mein: 1, meine: 1, meinen: 1, meiner: 1, wie: 1, was: 1, wo: 1, warum: 1, ein: 1, eine: 1, einen: 1, aus: 1, auf: 1, mit: 1, in: 1, im: 1, von: 1, zu: 1, fuer: 1, den: 1, dem: 1, des: 1, ist: 1, es: 1, sich: 1, bei: 1, man: 1, kann: 1, darf: 1, soll: 1, muss: 1, wird: 1, hat: 1, habe: 1, am: 1, an: 1, so: 1, wenn: 1, welche: 1, welcher: 1, welches: 1 };
  var SYNONYME = { spuelen: ["geschirr"], abwaschen: ["geschirr", "spuelen"], geschirr: ["spuelen"], sofa: ["couch", "polster"], couch: ["polster", "sofa"], stinkt: ["riecht", "geruch"], riecht: ["geruch", "muffig"], mief: ["geruch", "muffig"], kaputt: ["neu", "geraet"], strom: ["energie", "sparen"], kosten: ["sparen", "geld"], billig: ["sparen", "geld"], guenstig: ["sparen", "geld"], kind: ["kinder", "sicher"], vergiftung: ["verschluckt", "giftinformationszentrum"], getrunken: ["verschluckt"], symbol: ["symbole", "pflegesymbole"], zeichen: ["symbole"], etikett: ["symbole", "pflegeetikett"], pulli: ["pullover", "wolle"], pullover: ["wolle"], eingelaufen: ["wolle", "verfilzt"], weichspueler: ["weichspueler"], kalk: ["wasserhaerte", "kalk"], gras: ["flecken"], rotwein: ["flecken"], fett: ["flecken", "fett"], oel: ["flecken", "fett"], blut: ["flecken"] };
  function woerter(q) {
    return falte(q).split(" ").filter(function (w) { return w.length > 1 && !STOPP[w]; });
  }
  function abstand(a, b) {
    if (Math.abs(a.length - b.length) > 1) return 2;
    var m = [], i, j;
    for (i = 0; i <= a.length; i++) { m[i] = [i]; }
    for (j = 0; j <= b.length; j++) { m[0][j] = j; }
    for (i = 1; i <= a.length; i++) for (j = 1; j <= b.length; j++)
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return m[a.length][b.length];
  }
  function suche(q) {
    var idx = window.WT_INDEX || [];
    var ws = woerter(q);
    if (!ws.length) return [];
    var erweitert = ws.slice();
    ws.forEach(function (w) { (SYNONYME[w] || []).forEach(function (s) { erweitert.push(s); }); });
    return idx.map(function (e) {
      var p = 0;
      erweitert.forEach(function (w, n) {
        var gewicht = n < ws.length ? 1 : 0.5;
        var treffer = false;
        [["t", 6], ["f", 4], ["k", 3], ["z", 2], ["x", 0.5]].forEach(function (feld) {
          var text = e[feld[0]];
          if (text.indexOf(w) >= 0) { p += feld[1] * gewicht; treffer = true; }
        });
        if (!treffer && w.length > 4) {
          var tw = (e.t + " " + e.f + " " + e.k).split(" ");
          for (var i = 0; i < tw.length; i++) {
            if (tw[i].length > 3 && (tw[i].indexOf(w.slice(0, 5)) === 0 || abstand(w, tw[i]) <= 1)) { p += 2 * gewicht; break; }
          }
        }
      });
      return { e: e, p: p };
    }).filter(function (r) { return r.p > 0; }).sort(function (a, b) { return b.p - a.p; })
      .filter(function (r, i, alle) { return r.p >= Math.max(2, alle[0].p * 0.3); });
  }
  window.WT_SUCHE = suche;
  document.querySelectorAll("form.suche").forEach(function (f) {
    f.addEventListener("submit", function (ev) {
      var q = f.querySelector("input").value.trim();
      try { sessionStorage.setItem("wt-suche", q); } catch (e) { /* ohne Speicher */ }
      if (document.getElementById("treffer")) { ev.preventDefault(); zeigeTreffer(q); }
    });
  });
  function zeigeTreffer(q) {
    var ziel = document.getElementById("treffer");
    var feld = document.getElementById("suchfeld");
    if (feld) feld.value = q;
    if (!q) { ziel.innerHTML = '<p>Geben Sie oben ein, was Sie wissen möchten, zum Beispiel „Rotwein auf der Bluse“.</p>'; return; }
    var r = suche(q);
    var html = '<p class="anzahl" role="status"><strong>' + r.length + (r.length === 1 ? " Antwort" : " Antworten") + "</strong> auf „" + esc(q) + "“</p>";
    if (!r.length) {
      html += '<div class="karte stapel"><p>Dazu haben wir leider nichts gefunden. Versuchen Sie es mit anderen Wörtern oder mit einer dieser Fragen:</p><div class="beispiele">' +
        (window.WT_BEISPIELE || []).map(function (b) { return '<a href="' + basis + b.u + '">' + esc(b.t) + "</a>"; }).join("") +
        '</div><p><a href="' + basis + 'problem.html">Oder: Ich habe ein Problem – in zwei Fragen zur Lösung</a></p></div>';
    } else {
      var b = r[0].e;
      html += '<div class="kurz"><span class="beschriftung">Beste Antwort</span><h2><a href="' + basis + b.u + '">' + esc(b.titel) + '</a></h2><p class="inhalt">' + esc(b.kurz) + '</p><p><a href="' + basis + b.u + '">Ganze Antwort lesen</a></p></div>';
      if (r.length > 1) {
        html += '<h2>Weitere Antworten</h2><ul class="fragenliste">' + r.slice(1, 12).map(function (x) {
          return '<li><a href="' + basis + x.e.u + '"><span class="thema-punkt" style="--punkt:' + x.e.farbe + '">' + esc(x.e.thema) + '</span><span class="frage">' + esc(x.e.titel) + '</span><span class="anriss">' + esc(x.e.kurz.split(/(?<=[.!?])\s/)[0]) + "</span></a></li>";
        }).join("") + "</ul>";
      }
    }
    ziel.innerHTML = html;
  }
  if (document.getElementById("treffer")) {
    var q = new URLSearchParams(location.search).get("q");
    if (q === null) { try { q = sessionStorage.getItem("wt-suche") || ""; } catch (e) { q = ""; } }
    zeigeTreffer(q);
  }

  /* Fragenfinder (Problem und Flecken) */
  function finder(wurzel, daten) {
    var wahl = [];
    function zeichne() {
      var schritt = daten.schritt(wahl);
      var gesamt = daten.gesamt(wahl);
      var nr = wahl.length + 1;
      var html = '<div class="fortschritt"><span>' + (schritt ? "Schritt " + nr + " von " + gesamt : "Ihr Ergebnis") + '</span><div class="balken" aria-hidden="true"><span style="width:' + Math.round((schritt ? wahl.length : gesamt) / gesamt * 100) + '%"></span></div></div>';
      if (schritt) {
        html += '<h1 id="finder-frage" tabindex="-1">' + esc(schritt.frage) + "</h1>";
        if (schritt.hinweis) html += "<p>" + esc(schritt.hinweis) + "</p>";
        html += '<ul class="auswahl">' + schritt.optionen.map(function (o, i) {
          return '<li><button type="button" data-i="' + i + '" aria-pressed="false">' + (o.bild ? '<span class="auswahl-bild">' + o.bild + "</span>" : "") + '<span>' + esc(o.t) + (o.z ? '<span class="zusatz">' + esc(o.z) + "</span>" : "") + "</span>" + HAKEN + "</button></li>";
        }).join("") + "</ul>";
      } else {
        html += '<div class="ergebnis" id="finder-frage" tabindex="-1">' + daten.ergebnis(wahl) + "</div>";
      }
      html += '<div class="finder-nav">' + (wahl.length ? '<button type="button" class="knopf-neben" data-zurueck>' + ZURUECK + "Zurück</button>" : "") +
        (wahl.length ? '<button type="button" class="knopf-neben" data-neu>Von vorn beginnen</button>' : "") + "</div>";
      wurzel.innerHTML = html;
      wurzel.querySelectorAll(".auswahl button").forEach(function (b) {
        b.addEventListener("click", function () {
          b.setAttribute("aria-pressed", "true");
          wahl.push(schritt.optionen[+b.getAttribute("data-i")]);
          uebergang(function () { zeichne(); }, "vor"); fokus();
        });
      });
      var z = wurzel.querySelector("[data-zurueck]");
      if (z) z.addEventListener("click", function () { wahl.pop(); uebergang(function () { zeichne(); }, "zurueck"); fokus(); });
      var n = wurzel.querySelector("[data-neu]");
      if (n) n.addEventListener("click", function () { wahl = []; zeichne(); fokus(); });
    }
    function fokus() { var h = document.getElementById("finder-frage"); if (h) h.focus(); }
    function uebergang(f, richtung) {
      var ruhig = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!document.startViewTransition || ruhig) { f(); return; }
      document.documentElement.dataset.richtung = richtung;
      document.startViewTransition(f);
    }
    zeichne();
  }
  function artikelKarte(a, titelEbene) {
    var e = (window.WT_ARTIKEL || {})[a];
    if (!e) return "";
    return '<div class="karte"><h' + (titelEbene || 2) + '><a href="' + basis + e.u + '">' + esc(e.titel) + "</a></h" + (titelEbene || 2) + "><p>" + esc(e.kurz) + '</p><p><a href="' + basis + e.u + '">Ganze Antwort lesen</a></p></div>';
  }

  var pw = document.getElementById("problemfinder");
  if (pw && window.WT_PROBLEM) {
    var P = window.WT_PROBLEM;
    finder(pw, {
      gesamt: function () { return 2; },
      schritt: function (w) {
        if (w.length === 0) return { frage: P.frage, optionen: P.bereiche };
        if (w.length === 1) return { frage: w[0].frage2, optionen: w[0].probleme };
        return null;
      },
      ergebnis: function (w) {
        var o = w[1];
        var h = '<h1>Das hilft Ihnen weiter</h1>';
        if (o.achtung) h += '<div class="achtung" role="note">' + P.dreieck + '<div class="text"><p><strong>Achtung:</strong> ' + esc(o.achtung) + "</p></div></div>";
        if (o.werkzeug) h += '<div class="karte"><h2><a href="' + basis + o.werkzeug.u + '">' + esc(o.werkzeug.t) + "</a></h2><p>" + esc(o.werkzeug.z) + "</p></div>";
        h += (o.artikel || []).map(function (a, i) {
          if (o.achtung && i === 0) { var e = (window.WT_ARTIKEL || {})[a]; return e ? '<p><a class="knopf-haupt" href="' + basis + e.u + '">Alle Schritte: ' + esc(e.titel) + "</a></p>" : ""; }
          return artikelKarte(a);
        }).join("");
        return h;
      }
    });
  }

  var fw = document.getElementById("fleckenfinder");
  if (fw && window.WT_FLECK) {
    var F = window.WT_FLECK;
    finder(fw, {
      gesamt: function (w) { return w[1] && w[1].ohneFarbe ? 2 : 3; },
      schritt: function (w) {
        if (w.length === 0) return { frage: "Welcher Fleck ist es?", optionen: F.flecken };
        if (w.length === 1) return { frage: "Worauf ist der Fleck?", optionen: F.stoffe };
        if (w.length === 2 && !w[1].ohneFarbe) return { frage: "Welche Farbe hat das Teil?", optionen: F.farben };
        return null;
      },
      ergebnis: function (w) {
        var fleck = w[0], stoff = w[1], farbe = w[2];
        var h = "<h1>Das tun Sie jetzt</h1>";
        if (stoff.artikel) {
          h += "<p>" + esc(stoff.text) + "</p>" + artikelKarte(stoff.artikel);
          return h;
        }
        h += '<ol class="schritte">' + F.schritte.map(function (s) { return "<li><p>" + s + "</p></li>"; }).join("") + "</ol>";
        h += '<div class="karte"><h2>Bei ' + esc(fleck.t) + "</h2><p>" + esc(fleck.text) + "</p></div>";
        var stoffText = stoff.text;
        if (farbe && farbe.text && !stoff.eigen) stoffText = farbe.text;
        h += '<div class="karte"><h2>Für Ihr Teil</h2><p>' + esc(stoffText) + "</p>" + (stoff.link ? '<p><a href="' + basis + stoff.link.u + '">' + esc(stoff.link.t) + "</a></p>" : "") + "</div>";
        if (!fleck.bekannt) h += '<div class="redaktion"><p class="redaktion-kopf"><span class="stempel">Lücke</span></p><p>' + esc(F.luecke) + "</p></div>";
        h += '<div class="karte"><h2>Wenn danach noch etwas zu sehen ist</h2><p>' + esc(F.danach) + "</p></div>";
        h += '<p><a class="knopf-haupt" href="' + basis + F.artikel + '">Ganze Antwort lesen</a></p>';
        return h;
      }
    });
  }

  /* Pflegesymbol-Finder: Erklärung direkt unter der Gruppe */
  document.querySelectorAll(".symbolraster button").forEach(function (b) {
    b.addEventListener("click", function () {
      var gruppe = b.closest(".symbolgruppe");
      var feld = gruppe.querySelector(".erklaerung");
      var war = b.getAttribute("aria-expanded") === "true";
      gruppe.querySelectorAll(".symbolraster button").forEach(function (x) { x.setAttribute("aria-expanded", "false"); });
      if (war) { feld.hidden = true; return; }
      b.setAttribute("aria-expanded", "true");
      var d = (window.WT_SYMBOLE || {})[b.getAttribute("data-symbol")];
      feld.innerHTML = '<h3 tabindex="-1">' + esc(d.name) + "</h3><dl>" + d.zeilen.map(function (z) { return "<dt>" + esc(z[0]) + "</dt><dd>" + esc(z[1]) + "</dd>"; }).join("") +
        '</dl><p><a href="' + basis + d.link + '">Mehr dazu: Was bedeuten die Symbole auf dem Wäscheetikett?</a></p>';
      feld.hidden = false;
      feld.querySelector("h3").focus();
    });
  });
})();

/* ================= Runde 2: Interaktionen ================= */
(function () {
  "use strict";
  var basis = document.documentElement.getAttribute("data-basis") || "";
  var ruhig = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function lies(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function schreib(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ohne Speicher */ } }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var HAKEN = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';
  var LUPE = '<svg class="ico" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 11a7 7 0 1 0 14 0a7 7 0 1 0-14 0M16 16l5 5M11 8v6M8 11h6"/></svg>';

  /* Redaktionshinweise ein- und ausblenden */
  var schalter = document.getElementById("redaktion-schalter");
  function setzeRedaktion(an) {
    document.body.classList.toggle("zeige-redaktion", an);
    if (schalter) schalter.setAttribute("aria-pressed", an ? "true" : "false");
  }
  setzeRedaktion(lies("wt-redaktion") === "1");
  if (schalter) schalter.addEventListener("click", function () {
    var an = schalter.getAttribute("aria-pressed") !== "true";
    setzeRedaktion(an); schreib("wt-redaktion", an ? "1" : "0");
  });

  /* Lesefortschritt, Mini-Kopf, Seitennavigation */
  var kopf = document.querySelector(".kopf");
  var nachOben = document.querySelector(".nach-oben");
  if (nachOben) nachOben.addEventListener("click", function (e) {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: ruhig ? "auto" : "smooth" });
    var ziel = document.getElementById("inhalt");
    if (ziel) { ziel.setAttribute("tabindex", "-1"); ziel.focus({ preventScroll: true }); }
  });
  var balken = document.querySelector(".lesefortschritt");
  var kopfband = document.querySelector(".kopfband");
  var spalte = document.querySelector(".lesespalte");
  var tick = false, kompakt = false;
  var aktualisiere = function () {
    tick = false;
    /* Abstand zwischen Ein- und Ausschalten, damit die Kopfzeile nicht hin- und herspringt */
    if (kopf) {
      var y = window.scrollY;
      if (!kompakt && y > 80) kompakt = true; else if (kompakt && y < 8) kompakt = false;
      kopf.classList.toggle("kompakt", kompakt);
    }
    if (balken && spalte) {
      var r = spalte.getBoundingClientRect();
      var gesamt = r.height - window.innerHeight * 0.6;
      balken.style.setProperty("--fortschritt", Math.min(1, Math.max(0, -r.top / Math.max(gesamt, 1))).toFixed(3));
    }
    if (kopf && kopfband && balken) kopf.classList.toggle("zeige-titel", kopfband.getBoundingClientRect().bottom < 60);
    if (nachOben) nachOben.classList.toggle("sichtbar", window.scrollY > 700);
  };
  window.addEventListener("scroll", function () { if (!tick) { tick = true; requestAnimationFrame(aktualisiere); } }, { passive: true });
  aktualisiere();
  var navLinks = document.querySelectorAll(".seitennav a[href^='#']");
  if (navLinks.length) {
    var ziele = [];
    navLinks.forEach(function (a) { var z = document.getElementById(a.getAttribute("href").slice(1)); if (z) ziele.push([z, a]); });
    var markiereNav = function () {
      var aktiv = null;
      ziele.forEach(function (p) { if (p[0].getBoundingClientRect().top < window.innerHeight * 0.4) aktiv = p[1]; });
      navLinks.forEach(function (a) { if (a === aktiv) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current"); });
    };
    window.addEventListener("scroll", markiereNav, { passive: true });
    markiereNav();
  }

  /* Schritte zum Abhaken */
  document.querySelectorAll(".inhalt-text ol.schritte").forEach(function (ol, n) {
    var lis = ol.querySelectorAll(":scope > li");
    if (lis.length < 3 || ol.closest(".achtung")) return;
    var rahmen = document.createElement("div");
    rahmen.className = "schritte-rahmen";
    var kopf = document.createElement("div");
    kopf.className = "schritte-kopf";
    kopf.innerHTML = '<span>Zum Abhaken: Tippen Sie auf die Nummer, wenn ein Schritt erledigt ist.</span><span class="schritte-stand" aria-live="polite">0 von ' + lis.length + ' erledigt</span><span class="schritte-balken" aria-hidden="true"><span></span></span>';
    ol.parentNode.insertBefore(rahmen, ol);
    rahmen.appendChild(kopf); rahmen.appendChild(ol);
    ol.classList.add("abhakbar");
    var stand = kopf.querySelector(".schritte-stand"), fuell = kopf.querySelector(".schritte-balken span");
    function zaehle() {
      var x = ol.querySelectorAll(".haken-knopf[aria-pressed='true']").length;
      stand.textContent = x + " von " + lis.length + " erledigt";
      fuell.style.setProperty("--anteil", (x / lis.length).toFixed(3));
    }
    lis.forEach(function (li, i) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "haken-knopf";
      b.setAttribute("aria-pressed", "false");
      b.setAttribute("aria-label", "Schritt " + (i + 1) + " als erledigt markieren");
      b.innerHTML = '<span class="zahl" aria-hidden="true">' + (i + 1) + "</span>" + HAKEN;
      b.addEventListener("click", function () {
        var an = b.getAttribute("aria-pressed") !== "true";
        b.setAttribute("aria-pressed", an ? "true" : "false");
        li.classList.toggle("erledigt", an);
        zaehle();
      });
      li.insertBefore(b, li.firstChild);
    });
  });

  /* Zweispaltige Tabellen als Auswahl */
  document.querySelectorAll(".auswahl-tabelle").forEach(function (w, n) {
    var zeilen = w.querySelectorAll("tbody tr");
    var frage = w.getAttribute("data-auswahl") || "Auswahl";
    var wahl = document.createElement("div");
    wahl.className = "wahl";
    var id = "wahl-" + n;
    wahl.innerHTML = '<p class="wahl-frage" id="' + id + '-f">' + esc(frage) + ': Bitte wählen Sie aus.</p><div class="wahl-knoepfe" role="group" aria-labelledby="' + id + '-f"></div><div class="wahl-feld" id="' + id + '-feld" aria-live="polite"></div><button type="button" class="knopf-neben wahl-alle">Alle als Tabelle zeigen</button>';
    var knoepfe = wahl.querySelector(".wahl-knoepfe"), feld = wahl.querySelector(".wahl-feld");
    function zeige(i) {
      knoepfe.querySelectorAll("button").forEach(function (b, j) { b.setAttribute("aria-pressed", j === i ? "true" : "false"); });
      var td = zeilen[i].querySelectorAll("td");
      feld.innerHTML = "<h3>" + td[0].innerHTML + "</h3><div>" + td[1].innerHTML + "</div>";
      feld.classList.remove("neu"); void feld.offsetWidth; feld.classList.add("neu");
    }
    zeilen.forEach(function (tr, i) {
      var b = document.createElement("button");
      b.type = "button"; b.textContent = tr.querySelector("td").textContent.replace(/\s*\(.*\)$/, "").trim();
      b.setAttribute("aria-controls", id + "-feld");
      b.addEventListener("click", function () { zeige(i); });
      knoepfe.appendChild(b);
    });
    w.parentNode.insertBefore(wahl, w);
    w.hidden = true;
    zeige(0);
    wahl.querySelector(".wahl-alle").addEventListener("click", function (e) {
      var offen = w.hidden;
      w.hidden = !offen;
      e.currentTarget.textContent = offen ? "Tabelle ausblenden" : "Alle als Tabelle zeigen";
    });
  });

  /* Bilder: Vergrößern */
  var dlg = null;
  document.querySelectorAll("figure.bild").forEach(function (fig) {
    var img = fig.querySelector("img");
    if (!img) return;
    var r = document.createElement("div");
    r.className = "bild-rahmen";
    fig.insertBefore(r, img); r.appendChild(img);
    var b = document.createElement("button");
    b.type = "button"; b.className = "lupe-knopf"; b.innerHTML = LUPE + "Vergrößern";
    r.appendChild(b);
    b.addEventListener("click", function () {
      if (!dlg) {
        dlg = document.createElement("dialog");
        dlg.className = "leuchtkasten";
        dlg.innerHTML = '<div class="lk-innen"><div class="lk-kopf"><p class="lk-text"></p><button type="button" class="knopf-neben lk-zu">Schließen</button></div><img alt=""></div>';
        document.body.appendChild(dlg);
        dlg.querySelector(".lk-zu").addEventListener("click", function () { dlg.close(); });
        dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });
      }
      var gi = dlg.querySelector("img");
      gi.src = img.src; gi.alt = img.alt;
      var cap = fig.querySelector("figcaption");
      dlg.querySelector(".lk-text").textContent = cap ? cap.textContent : "";
      if (dlg.showModal) dlg.showModal(); else window.open(img.src);
    });
  });

  /* Fußnoten: Quelle beim Zeigen oder Fokussieren einblenden */
  var tipp = null;
  function schliesseTipp() { if (tipp) { tipp.remove(); tipp = null; } }
  document.querySelectorAll(".inhalt-text sup a[href^='#fn']").forEach(function (a) {
    var ziel = document.getElementById(a.getAttribute("href").slice(1));
    if (!ziel) return;
    a.setAttribute("aria-label", "Quelle " + a.textContent);
    function zeige() {
      schliesseTipp();
      var text = ziel.cloneNode(true);
      text.querySelectorAll(".footnote-backref").forEach(function (x) { x.remove(); });
      tipp = document.createElement("div");
      tipp.className = "quellen-tipp"; tipp.setAttribute("role", "tooltip");
      tipp.innerHTML = '<span class="tipp-titel">Quelle ' + esc(a.textContent) + "</span>" + text.innerHTML;
      document.body.appendChild(tipp);
      tipp.addEventListener("mouseleave", schliesseTipp);
      var r = a.getBoundingClientRect(), w = tipp.offsetWidth;
      var links = Math.min(Math.max(8, r.left + window.scrollX - w / 2), window.scrollX + document.documentElement.clientWidth - w - 8);
      tipp.style.left = links + "px";
      tipp.style.top = (r.bottom + window.scrollY + 8) + "px";
    }
    a.addEventListener("mouseenter", zeige);
    a.addEventListener("focus", zeige);
    a.addEventListener("mouseleave", function () { setTimeout(function () { if (tipp && !tipp.matches(":hover")) schliesseTipp(); }, 250); });
    a.addEventListener("blur", schliesseTipp);
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") schliesseTipp(); });

  /* War diese Antwort hilfreich? */
  document.querySelectorAll("[data-hilfreich]").forEach(function (b) {
    b.setAttribute("aria-pressed", "false");
    b.addEventListener("click", function () {
      document.querySelectorAll("[data-hilfreich]").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      var m = document.querySelector(".hilfreich-meldung");
      if (m) m.textContent = b.getAttribute("data-hilfreich") === "ja" ? "Danke für Ihre Rückmeldung!" : "Danke! Wir verbessern diese Antwort. (Im Prototyp wird die Rückmeldung nicht gespeichert.)";
    });
  });

  /* Suchvorschläge beim Tippen */
  var laedt = null;
  function ladeIndex(fertig) {
    if (window.WT_INDEX) return fertig();
    if (!laedt) {
      laedt = [];
      window.WT_DATEN_LADEN(basis).then(function () { laedt.forEach(function (f) { f(); }); });
    }
    laedt.push(fertig);
  }
  document.querySelectorAll("form.suche input[type='search']").forEach(function (inp, n) {
    var form = inp.closest("form");
    var liste = document.createElement("ul");
    liste.className = "vorschlaege"; liste.id = "vorschlaege-" + n; liste.setAttribute("role", "listbox"); liste.hidden = true;
    liste.setAttribute("aria-label", "Vorschläge");
    (inp.closest(".suche-zeile") || form).appendChild(liste);
    inp.setAttribute("role", "combobox"); inp.setAttribute("aria-autocomplete", "list");
    inp.setAttribute("aria-expanded", "false"); inp.setAttribute("aria-controls", liste.id);
    var treffer = [], aktiv = -1;
    function zu() { liste.hidden = true; inp.setAttribute("aria-expanded", "false"); inp.removeAttribute("aria-activedescendant"); aktiv = -1; }
    function markiere(i) {
      aktiv = i;
      liste.querySelectorAll("li").forEach(function (li, j) { li.setAttribute("aria-selected", j === i ? "true" : "false"); });
      if (i >= 0) inp.setAttribute("aria-activedescendant", liste.id + "-" + i); else inp.removeAttribute("aria-activedescendant");
    }
    function zeige() {
      var q = inp.value.trim();
      if (q.length < 2 || !window.WT_SUCHE) { zu(); return; }
      treffer = window.WT_SUCHE(q).slice(0, 5);
      if (!treffer.length) { zu(); return; }
      liste.innerHTML = treffer.map(function (r, i) {
        return '<li role="option" id="' + liste.id + "-" + i + '" aria-selected="false"><span class="v-titel">' + esc(r.e.titel) + '</span><span class="v-thema">' + esc(r.e.thema) + "</span></li>";
      }).join("");
      liste.querySelectorAll("li").forEach(function (li, i) {
        li.addEventListener("mousedown", function (e) { e.preventDefault(); location.href = basis + treffer[i].e.u; });
      });
      liste.hidden = false; inp.setAttribute("aria-expanded", "true"); markiere(-1);
    }
    inp.addEventListener("focus", function () { ladeIndex(function () {}); });
    inp.addEventListener("input", function () { ladeIndex(zeige); });
    inp.addEventListener("keydown", function (e) {
      if (liste.hidden) return;
      if (e.key === "ArrowDown") { e.preventDefault(); markiere(Math.min(aktiv + 1, treffer.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); markiere(Math.max(aktiv - 1, -1)); }
      else if (e.key === "Enter" && aktiv >= 0) { e.preventDefault(); location.href = basis + treffer[aktiv].e.u; }
      else if (e.key === "Escape") { zu(); }
    });
    inp.addEventListener("blur", function () { setTimeout(zu, 120); });
  });

  /* Video erst nach Klick laden (Datenschutz) */
  document.querySelectorAll(".video[data-youtube]").forEach(function (v) {
    var b = v.querySelector(".video-start");
    if (!b) return;
    b.addEventListener("click", function () {
      var f = document.createElement("iframe");
      f.src = "https://www.youtube-nocookie.com/embed/" + v.getAttribute("data-youtube") + "?autoplay=1&rel=0";
      f.title = "Video: Zeit statt Energie";
      f.allow = "autoplay; encrypted-media; picture-in-picture";
      f.allowFullscreen = true;
      v.innerHTML = ""; v.appendChild(f); f.focus();
    });
  });

  /* Downloads filtern */
  var dokListe = document.getElementById("dok-liste");
  if (dokListe) {
    var felder = { q: document.getElementById("dok-suche"), thema: document.getElementById("dok-thema"), art: document.getElementById("dok-art"), jahr: document.getElementById("dok-jahr") };
    var anzahl = document.getElementById("dok-anzahl"), leer = document.getElementById("dok-leer");
    var faltung = function (x) { return String(x).toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim(); };
    var filtere = function () {
      var woerter = faltung(felder.q.value).split(" ").filter(Boolean);
      var n = 0;
      dokListe.querySelectorAll("li.dok").forEach(function (li) {
        var ok = (!felder.thema.value || (" " + li.dataset.themen + " ").indexOf(" " + felder.thema.value + " ") >= 0)
          && (!felder.art.value || li.dataset.art === felder.art.value)
          && (!felder.jahr.value || li.dataset.jahr === felder.jahr.value)
          && woerter.every(function (w) { return li.dataset.suche.indexOf(w) >= 0; });
        li.hidden = !ok; if (ok) n++;
      });
      anzahl.innerHTML = "<strong>" + n + (n === 1 ? " Dokument" : " Dokumente") + "</strong>";
      leer.hidden = n > 0;
    };
    Object.keys(felder).forEach(function (k) { felder[k].addEventListener(k === "q" ? "input" : "change", filtere); });
    dokListe.closest(".einstieg").querySelector("form.filter").addEventListener("reset", function () { setTimeout(filtere, 0); });
    dokListe.closest(".einstieg").querySelector("form.filter").addEventListener("submit", function (e) { e.preventDefault(); });
  }
})();

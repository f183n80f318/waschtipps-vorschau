/* Waschrechner (Prototyp). Daten und Quellen: design/RECHNER-WASCHEN.md, Werte im JSON-Block der Seite. */
(function () {
  "use strict";
  var form = document.getElementById("waschrechner");
  if (!form) return;
  var D = JSON.parse(document.getElementById("waschrechner-daten").textContent);
  var euro = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  var euro2 = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var zahl = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });
  var basis = document.documentElement.getAttribute("data-basis") || "";

  /* Info-Knöpfe: Erklärung direkt darunter ein- und ausblenden */
  document.querySelectorAll(".info-knopf").forEach(function (b) {
    b.addEventListener("click", function () {
      var feld = document.getElementById(b.getAttribute("aria-controls"));
      var offen = b.getAttribute("aria-expanded") === "true";
      b.setAttribute("aria-expanded", offen ? "false" : "true");
      feld.hidden = offen;
    });
  });

  function zahlAus(name) {
    var v = parseFloat(String(form.elements[name].value).replace(",", "."));
    return isFinite(v) && v >= 0 ? v : null;
  }
  function wert(name) { var el = form.querySelector('[name="' + name + '"]:checked'); return el ? el.value : ""; }
  function eingabe() {
    var label = zahlAus("labelKwh"), liter = zahlAus("labelLiter");
    return {
      proWoche: Math.min(30, zahlAus("proWoche") || 0),
      programm: wert("programm"), fuellung: D.fuellung[wert("trommel")],
      anteilTrockner: D.anteil[wert("trocknen")], trockner: wert("trockner"),
      anteilSolar: D.anteil[wert("solar")], anteilBrunnen: D.anteil[wert("brunnen")],
      labelKwh: label > 0 ? label : null, labelLiter: liter > 0 ? liter : null,
      strom: zahlAus("strom") !== null ? zahlAus("strom") : D.preise.strom,
      solar: zahlAus("solarwert") !== null ? zahlAus("solarwert") : D.preise.solar,
      trinkwasser: zahlAus("trinkwasser") !== null ? zahlAus("trinkwasser") : D.preise.trinkwasser,
      abwasser: zahlAus("abwasser") !== null ? zahlAus("abwasser") : D.preise.abwasser,
      mittel: zahlAus("mittel") !== null ? zahlAus("mittel") : D.preise.mittel
    };
  }
  /* Strom pro Waschgang je nach Füllung: Gerade durch die Werte für volle und halbe Trommel */
  function fuellFaktor(x) { return (D.trommel.grund + D.trommel.steigung * x) / (D.trommel.grund + D.trommel.steigung); }

  function rechne(e) {
    var gaenge = e.proWoche * 52;
    var p = D.programme[e.programm];
    var ecoKwh = e.labelKwh ? e.labelKwh / 100 : D.eco.kwh;
    var kwhGang = p.kwh * (ecoKwh / D.eco.kwh) * fuellFaktor(e.fuellung);
    var literGang = p.liter * (e.labelLiter ? e.labelLiter / D.eco.liter : 1);
    var kwhWaschen = gaenge * kwhGang;
    var kwhTrocknen = gaenge * e.anteilTrockner * D.kgVoll * e.fuellung * D.trocknerKwhProKg[e.trockner];
    var kwh = kwhWaschen + kwhTrocknen;
    var stromPreis = (1 - e.anteilSolar) * e.strom + e.anteilSolar * e.solar;
    var m3 = gaenge * literGang / 1000;
    var k = {
      waschen: kwhWaschen * stromPreis, trocknen: kwhTrocknen * stromPreis,
      wasser: m3 * ((1 - e.anteilBrunnen) * e.trinkwasser + e.abwasser), mittel: gaenge * e.mittel
    };
    var summe = k.waschen + k.trocknen + k.wasser + k.mittel;
    return { gaenge: gaenge, kwh: kwh, liter: m3 * 1000, co2: kwh * (1 - e.anteilSolar) * D.co2, kosten: k, summe: summe,
      proGang: gaenge ? summe / gaenge : 0, ecoKwh: ecoKwh };
  }
  function mit(e, aenderung) { var x = {}, k; for (k in e) x[k] = e[k]; for (k in aenderung) x[k] = aenderung[k]; return x; }

  function tipps(e, r) {
    var liste = [];
    function pruefe(titel, neu, text, link) {
      var n = rechne(neu), spar = r.summe - n.summe;
      if (spar >= 1) liste.push({ titel: titel, spar: spar, kwh: r.kwh - n.kwh, text: text, link: link });
    }
    if (e.programm === "40" || e.programm === "60" || e.programm === "90")
      pruefe("Eco 40-60 statt " + e.programm + " °C", mit(e, { programm: "eco" }), "Das Eco-Programm läuft länger, braucht aber weniger Strom.", D.links.temperatur);
    /* kühler nur bis 30 °C vorschlagen: Wer schon bei 30 °C wäscht, muss nicht noch weiter herunter */
    var kuehler = { "90": "60", "60": "40", "40": "30" }[e.programm];
    if (kuehler)
      pruefe(kuehler + " °C statt " + e.programm + " °C", mit(e, { programm: kuehler }), "Das Aufheizen des Wassers kostet am meisten Strom. Das Pflegeetikett zeigt, wie warm es höchstens sein darf.", D.links.temperatur);
    if (e.fuellung < 1)
      pruefe("Trommel voll machen", mit(e, { fuellung: 1, proWoche: e.proWoche * e.fuellung }), "Dieselbe Wäsche in weniger Waschgängen. Ausgenommen sind Fein- und Wollwäsche.", D.links.waschen);
    if (e.anteilTrockner > 0)
      pruefe("An der Luft trocknen", mit(e, { anteilTrockner: 0 }), "Am sparsamsten trocknet Wäsche im Freien oder in einem unbeheizten, gut gelüfteten Raum.", D.links.trocknen);
    if (e.anteilTrockner > 0 && e.trockner !== "waermepumpe")
      pruefe("Wärmepumpentrockner statt Kondens- oder Ablufttrockner", mit(e, { trockner: "waermepumpe" }), "Lohnt sich vor allem, wenn ohnehin ein neuer Trockner ansteht.", D.links.trockner);
    if (r.ecoKwh > D.klasseA.kwh * 1.15)
      pruefe("Sparsamere Waschmaschine (Klasse A)", mit(e, { labelKwh: D.klasseA.kwh * 100 }),
        "Eine 8-kg-Maschine der Klasse A braucht im Eco-Programm höchstens " + zahl.format(D.klasseA.kwh * 100) + " kWh pro 100 Waschgänge. Lohnt sich vor allem, wenn ohnehin ein neues Gerät ansteht." +
        (e.labelKwh ? "" : " Gerechnet ist mit einer Beispielmaschine; mit dem Wert von Ihrem Energielabel (unter „Genauer rechnen“) wird das Ergebnis genauer."), D.links.label);
    return liste.sort(function (a, b) { return b.spar - a.spar; });
  }

  var $ = function (id) { return document.getElementById(id); };
  function zeige() {
    var e = eingabe();
    $("wr-trockner-feld").hidden = e.anteilTrockner === 0;
    var r = rechne(e);
    $("wr-summe").textContent = euro.format(r.summe);
    if ($("wr-mini-summe")) $("wr-mini-summe").textContent = euro.format(r.summe);
    $("wr-pro-gang").textContent = euro2.format(r.proGang);
    $("wr-gaenge").textContent = zahl.format(r.gaenge);
    var teile = [["Strom fürs Waschen", r.kosten.waschen], ["Strom fürs Trocknen", r.kosten.trocknen], ["Wasser und Abwasser", r.kosten.wasser], ["Waschmittel", r.kosten.mittel]];
    var max = Math.max.apply(null, teile.map(function (t) { return t[1]; })) || 1;
    $("wr-balken").innerHTML = teile.map(function (t) {
      return '<li><span class="b-name">' + t[0] + '</span><span class="b-spur" aria-hidden="true"><span style="--b:' + (t[1] / max).toFixed(3) + '"></span></span><span class="b-wert">' + euro.format(t[1]) + "</span></li>";
    }).join("");
    $("wr-kwh").textContent = zahl.format(r.kwh) + " kWh";
    $("wr-liter").textContent = zahl.format(r.liter) + " Liter";
    $("wr-co2").textContent = zahl.format(r.co2) + " kg";
    var t = tipps(e, r);
    $("wr-tipps").innerHTML = t.length ? t.slice(0, 4).map(function (x) {
      return '<li><div class="t-kopf"><strong>' + x.titel + '</strong><span class="t-spar">spart etwa ' + euro.format(x.spar) + " im Jahr</span></div><p>" + x.text +
        (x.kwh >= 1 ? " Das sind rund " + zahl.format(x.kwh) + " kWh Strom weniger." : "") + '</p><a href="' + basis + x.link + '">Mehr dazu</a></li>';
    }).join("") : '<li><p><strong>Sie waschen bereits sehr sparsam.</strong> Mit Ihren Angaben gibt es keinen großen Hebel mehr.</p></li>';
    $("wr-hygiene").hidden = !(e.programm === "20" || e.programm === "30" || e.programm === "eco");
  }
  form.addEventListener("change", function (ev) {
    if (ev.target.name === "personen") {
      form.elements.proWoche.value = D.personen[ev.target.value];
      $("wr-personen-hinweis").textContent = "Voreinstellung: " + D.personen[ev.target.value] + " Waschgänge pro Woche. Sie können die Zahl ändern.";
    }
    zeige();
  });
  form.addEventListener("input", zeige);
  form.addEventListener("submit", function (e) { e.preventDefault(); });
  form.querySelectorAll("[data-schritt]").forEach(function (b) {
    b.addEventListener("click", function () {
      var v = (zahlAus("proWoche") || 0) + parseFloat(b.getAttribute("data-schritt"));
      form.elements.proWoche.value = Math.max(0, Math.min(30, v));
      zeige();
    });
  });
  zeige();
  var mini = $("wr-mini"), ergebnis = document.querySelector(".wr-ergebnis");
  if (mini && ergebnis && "IntersectionObserver" in window) {
    new IntersectionObserver(function (x) { mini.classList.toggle("verdeckt", x[0].isIntersecting); }).observe(ergebnis);
  }
})();

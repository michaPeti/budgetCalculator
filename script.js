/* =========================================================================
   BUDGETRECHNER – LOGIK
   Diese Datei kümmert sich um:
   - Laden/Speichern der Daten im localStorage des Browsers
   - Berechnen und Anzeigen des Saldos
   - Anlegen, Bearbeiten und Löschen von Ausgaben
   - Prüfen der Benutzereingaben
   ========================================================================= */

// Unter diesem Namen werden alle Daten im localStorage abgelegt.
const SPEICHER_SCHLUESSEL = "budgetrechnerDaten";

// "daten" ist unser zentraler Zustand (State). Alles, was die App anzeigt,
// kommt aus diesem einen Objekt:
//   { einkommen: 2400, ausgaben: [ { id: 1, name: "Miete", betrag: 800 }, ... ] }
let daten = ladeDaten();

// Merkt sich, welche Ausgabe gerade im Bearbeiten-Modus ist (oder null, wenn keine).
let bearbeitenId = null;

/* =========================================================================
   DATEN LADEN & SPEICHERN
   ========================================================================= */

// Liest die gespeicherten Daten aus dem localStorage.
// Gibt es noch keine gespeicherten Daten, wird ein leerer Startzustand zurückgegeben.
function ladeDaten() {
  const gespeichertesJson = localStorage.getItem(SPEICHER_SCHLUESSEL);

  if (gespeichertesJson) {
    return JSON.parse(gespeichertesJson);
  }

  return { einkommen: 0, ausgaben: [] };
}

// Schreibt den aktuellen Zustand "daten" zurück in den localStorage.
// Wird nach jeder Änderung aufgerufen, damit nichts verloren geht.
function speichereDaten() {
  localStorage.setItem(SPEICHER_SCHLUESSEL, JSON.stringify(daten));
}

/* =========================================================================
   HILFSFUNKTIONEN
   ========================================================================= */

// Wandelt eine Zahl in deutsches Geld-Format um, z. B. 1587.01 -> "1.587,01 €"
function formatiereEuro(zahl) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(zahl);
}

// Wandelt einen eingegebenen Text in eine Zahl um.
// Erlaubt sowohl Komma als auch Punkt als Dezimaltrennzeichen (z. B. "12,99" oder "12.99").
// Gibt null zurück, wenn der Text keine gültige Zahl ergibt.
function leseZahlAusText(text) {
  const bereinigterText = text.trim().replace(",", ".");

  if (bereinigterText === "") {
    return null;
  }

  const zahl = Number(bereinigterText);

  if (isNaN(zahl) || !isFinite(zahl)) {
    return null;
  }

  return zahl;
}

// Verhindert, dass Sonderzeichen in Namen (z. B. "<script>") als HTML interpretiert werden.
function escapeHtml(text) {
  const hilfsElement = document.createElement("div");
  hilfsElement.textContent = text;
  return hilfsElement.innerHTML;
}

// Ermittelt eine neue, noch nicht verwendete ID für eine neue Ausgabe.
function ermittleNeueId() {
  if (daten.ausgaben.length === 0) {
    return 1;
  }
  const groessteId = Math.max(...daten.ausgaben.map((ausgabe) => ausgabe.id));
  return groessteId + 1;
}

/* =========================================================================
   ANZEIGE (RENDERING)
   Diese Funktionen übertragen den Zustand "daten" auf den Bildschirm.
   ========================================================================= */

// Berechnet den Saldo und zeigt ihn groß + farbig in der Saldo-Karte an.
function rendereSaldo() {
  const summeAusgaben = daten.ausgaben.reduce(
    (summe, ausgabe) => summe + ausgabe.betrag,
    0
  );
  const saldo = daten.einkommen - summeAusgaben;

  const saldoAnzeige = document.getElementById("saldo-anzeige");
  const saldoKarte = document.getElementById("saldo-karte");

  saldoAnzeige.textContent = formatiereEuro(saldo);

  if (saldo >= 0) {
    saldoKarte.classList.add("positiv");
    saldoKarte.classList.remove("negativ");
  } else {
    saldoKarte.classList.add("negativ");
    saldoKarte.classList.remove("positiv");
  }
}

// Zeichnet die komplette Ausgabenliste neu, je nach Zustand von "daten.ausgaben"
// und "bearbeitenId" (welcher Eintrag gerade bearbeitet wird).
function rendereAusgaben() {
  const liste = document.getElementById("ausgaben-liste");
  const leerHinweis = document.getElementById("leer-hinweis");

  // Liste leeren, bevor wir sie neu befüllen
  liste.innerHTML = "";

  // Hinweistext nur zeigen, wenn keine Ausgaben vorhanden sind
  leerHinweis.style.display = daten.ausgaben.length === 0 ? "block" : "none";

  daten.ausgaben.forEach((ausgabe) => {
    const eintrag = document.createElement("li");
    eintrag.className = "ausgabe-eintrag";
    eintrag.dataset.id = ausgabe.id;

    if (ausgabe.id === bearbeitenId) {
      // ---- Bearbeiten-Modus: Eingabefelder statt reinem Text ----
      const betragAlsText = String(ausgabe.betrag).replace(".", ",");
      eintrag.innerHTML = `
        <div class="ausgabe-bearbeiten">
          <input type="text" class="edit-name-input" value="${escapeHtml(ausgabe.name)}">
          <input type="text" class="edit-betrag-input" value="${betragAlsText}" inputmode="decimal">
          <div class="ausgabe-buttons">
            <button type="button" class="btn btn-speichern">Speichern</button>
            <button type="button" class="btn btn-abbrechen">Abbrechen</button>
          </div>
          <p class="fehler-text edit-fehler"></p>
        </div>
      `;
    } else {
      // ---- Normale Ansicht ----
      eintrag.innerHTML = `
        <span class="ausgabe-name">${escapeHtml(ausgabe.name)}</span>
        <span class="ausgabe-betrag">${formatiereEuro(ausgabe.betrag)}</span>
        <div class="ausgabe-buttons">
          <button type="button" class="btn btn-bearbeiten">Bearbeiten</button>
          <button type="button" class="btn btn-loeschen">Löschen</button>
        </div>
      `;
    }

    liste.appendChild(eintrag);
  });
}

// Ruft alle Render-Funktionen auf einmal auf. Wird nach jeder Datenänderung genutzt.
function rendereAlles() {
  rendereSaldo();
  rendereAusgaben();
}

/* =========================================================================
   EINKOMMEN
   ========================================================================= */

const einkommenInput = document.getElementById("einkommen-input");
const einkommenFehler = document.getElementById("einkommen-fehler");

// Beim Tippen wird das Einkommen direkt geprüft, gespeichert und der Saldo aktualisiert.
einkommenInput.addEventListener("input", () => {
  const eingegebenerText = einkommenInput.value;

  // Leeres Feld wird als Einkommen 0 behandelt (kein Fehler nötig)
  if (eingegebenerText.trim() === "") {
    einkommenFehler.textContent = "";
    daten.einkommen = 0;
    speichereDaten();
    rendereSaldo();
    return;
  }

  const zahl = leseZahlAusText(eingegebenerText);

  if (zahl === null) {
    einkommenFehler.textContent = "Bitte gib eine gültige Zahl ein.";
    return;
  }

  if (zahl < 0) {
    einkommenFehler.textContent = "Das Einkommen darf nicht negativ sein.";
    return;
  }

  einkommenFehler.textContent = "";
  daten.einkommen = zahl;
  speichereDaten();
  rendereSaldo();
});

/* =========================================================================
   AUSGABE HINZUFÜGEN
   ========================================================================= */

const ausgabeFormular = document.getElementById("ausgabe-formular");
const ausgabeNameInput = document.getElementById("ausgabe-name-input");
const ausgabeBetragInput = document.getElementById("ausgabe-betrag-input");
const nameFehler = document.getElementById("name-fehler");
const betragFehler = document.getElementById("betrag-fehler");

ausgabeFormular.addEventListener("submit", (event) => {
  // Verhindert, dass die Seite neu geladen wird (Standardverhalten von Formularen)
  event.preventDefault();

  // Fehlermeldungen erstmal zurücksetzen
  nameFehler.textContent = "";
  betragFehler.textContent = "";

  const name = ausgabeNameInput.value.trim();
  const betrag = leseZahlAusText(ausgabeBetragInput.value);

  let eingabeIstGueltig = true;

  if (name === "") {
    nameFehler.textContent = "Bitte gib einen Namen ein.";
    eingabeIstGueltig = false;
  }

  if (betrag === null) {
    betragFehler.textContent = "Bitte gib eine gültige Zahl ein.";
    eingabeIstGueltig = false;
  } else if (betrag <= 0) {
    betragFehler.textContent = "Der Betrag muss größer als 0 sein.";
    eingabeIstGueltig = false;
  }

  if (!eingabeIstGueltig) {
    return;
  }

  // Neue Ausgabe zum Zustand hinzufügen
  daten.ausgaben.push({
    id: ermittleNeueId(),
    name: name,
    betrag: betrag,
  });

  speichereDaten();
  rendereAlles();

  // Formular für die nächste Eingabe zurücksetzen
  ausgabeNameInput.value = "";
  ausgabeBetragInput.value = "";
  ausgabeNameInput.focus();
});

/* =========================================================================
   AUSGABE BEARBEITEN & LÖSCHEN
   Ein einziger Klick-Listener auf der Liste kümmert sich um alle Buttons
   (Bearbeiten, Löschen, Speichern, Abbrechen) – das nennt man "Event Delegation".
   ========================================================================= */

const ausgabenListe = document.getElementById("ausgaben-liste");

ausgabenListe.addEventListener("click", (event) => {
  const geklickterButton = event.target;
  const eintrag = geklickterButton.closest(".ausgabe-eintrag");

  if (!eintrag) {
    return;
  }

  const id = Number(eintrag.dataset.id);

  if (geklickterButton.classList.contains("btn-loeschen")) {
    loescheAusgabe(id);
  } else if (geklickterButton.classList.contains("btn-bearbeiten")) {
    bearbeitenId = id;
    rendereAusgaben();
  } else if (geklickterButton.classList.contains("btn-abbrechen")) {
    bearbeitenId = null;
    rendereAusgaben();
  } else if (geklickterButton.classList.contains("btn-speichern")) {
    speichereBearbeiteteAusgabe(id, eintrag);
  }
});

// Löscht eine Ausgabe, aber erst nach kurzer Rückfrage.
function loescheAusgabe(id) {
  const ausgabe = daten.ausgaben.find((a) => a.id === id);
  if (!ausgabe) {
    return;
  }

  const bestaetigt = confirm(`"${ausgabe.name}" wirklich löschen?`);
  if (!bestaetigt) {
    return;
  }

  daten.ausgaben = daten.ausgaben.filter((a) => a.id !== id);
  speichereDaten();
  rendereAlles();
}

// Liest die Eingabefelder im Bearbeiten-Modus aus, prüft sie und speichert die Änderung.
function speichereBearbeiteteAusgabe(id, eintragElement) {
  const nameInput = eintragElement.querySelector(".edit-name-input");
  const betragInput = eintragElement.querySelector(".edit-betrag-input");
  const fehlerText = eintragElement.querySelector(".edit-fehler");

  const name = nameInput.value.trim();
  const betrag = leseZahlAusText(betragInput.value);

  if (name === "") {
    fehlerText.textContent = "Bitte gib einen Namen ein.";
    return;
  }

  if (betrag === null) {
    fehlerText.textContent = "Bitte gib eine gültige Zahl ein.";
    return;
  }

  if (betrag <= 0) {
    fehlerText.textContent = "Der Betrag muss größer als 0 sein.";
    return;
  }

  const ausgabe = daten.ausgaben.find((a) => a.id === id);
  ausgabe.name = name;
  ausgabe.betrag = betrag;

  bearbeitenId = null;
  speichereDaten();
  rendereAlles();
}

/* =========================================================================
   DARK MODE / LIGHT MODE
   ========================================================================= */

const MODUS_SCHLUESSEL = "budgetrechnerModus";
const modusButton = document.getElementById("modus-umschalten");

// Schaltet die CSS-Klasse "dunkel-modus" am <body> um und passt das Icon an.
function wendeModusAn(modus) {
  const istDunkel = modus === "dunkel";
  document.body.classList.toggle("dunkel-modus", istDunkel);
  modusButton.textContent = istDunkel ? "☀️" : "🌙";
}

modusButton.addEventListener("click", () => {
  const istAktuellDunkel = document.body.classList.contains("dunkel-modus");
  const neuerModus = istAktuellDunkel ? "hell" : "dunkel";
  wendeModusAn(neuerModus);
  localStorage.setItem(MODUS_SCHLUESSEL, neuerModus);
});

/* =========================================================================
   START
   ========================================================================= */

// Zeigt das gespeicherte Einkommen im Eingabefeld an (falls vorhanden)
// und stellt den zuletzt gewählten Modus (hell/dunkel) wieder her.
function initialisiere() {
  if (daten.einkommen) {
    einkommenInput.value = String(daten.einkommen).replace(".", ",");
  }
  wendeModusAn(localStorage.getItem(MODUS_SCHLUESSEL) || "hell");
  rendereAlles();
}

initialisiere();

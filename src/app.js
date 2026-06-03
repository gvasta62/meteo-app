// === Meteo-app ===
// Logica: cerca una città, recupera il meteo da Open-Meteo e mostra i dati.
// Funzionalità: meteo attuale, previsioni a più giorni, stima produzione
// fotovoltaica giornaliera (potenza/inclinazione/orientamento configurabili,
// con correzione termica in base a temperatura e vento), memoria dell'ultima
// città e configurazione (localStorage).
// API usate (entrambe gratuite, senza chiave):
//  - Geocoding: città -> coordinate
//  - Forecast:  coordinate -> meteo attuale + previsioni giornaliere
//               + irradianza/temperatura/vento orari (per la stima PV)

// --- Costanti configurabili / di modello ---
const POTENZA_DEFAULT = 900; // potenza di picco di default, in Watt (STC, 1000 W/m²)
const CITTA_DEFAULT = "Assemini"; // località mostrata al primo avvio
const GIORNI_PREVISIONE = 7;

// Perdite di sistema NON termiche (inverter, cablaggi, mismatch, sporco).
// L'effetto della temperatura è modellato a parte (vedi sotto), per non contarlo due volte.
const LOSS_SISTEMA = 0.85;

// Effetto termico sul modulo (silicio cristallino tipico):
//  - GAMMA: coefficiente di potenza, ~ -0,4%/°C rispetto ai 25 °C di STC
//  - Modello di Faiman per la temperatura di cella: T_cell = T_aria + G / (U0 + U1·vento)
//    con vento in m/s; U0/U1 valori IEC 61853 per moduli liberi sul retro.
const GAMMA = -0.004; // 1/°C
const T_STC = 25; // °C
const FAIMAN_U0 = 25.0; // W/m²/K
const FAIMAN_U1 = 6.84; // W/m²/K per (m/s)

// Chiavi localStorage
const KEY_CITTA = "ultimaCitta";
const KEY_POTENZA = "potenzaPannello";

// Etichette orientamento (convenzione Open-Meteo: 0=Sud, -90=Est, 90=Ovest, ±180=Nord)
const ETICHETTE_AZIMUTH = {
  "0": "Sud",
  "-45": "Sud-Est",
  "-90": "Est",
  "45": "Sud-Ovest",
  "90": "Ovest",
  "180": "Nord",
};

// Riferimenti al DOM
const form = document.getElementById("form-ricerca");
const inputCitta = document.getElementById("input-citta");
const btnCerca = document.getElementById("btn-cerca");
const inputPotenza = document.getElementById("potenza");
const inputTilt = document.getElementById("tilt");
const selectAzimuth = document.getElementById("azimuth");
const stato = document.getElementById("stato");
const risultato = document.getElementById("risultato");
const elLuogo = document.getElementById("luogo");
const elIcona = document.getElementById("icona");
const elTemperatura = document.getElementById("temperatura");
const elCondizioni = document.getElementById("condizioni");
const elPercepita = document.getElementById("percepita");
const elUmidita = document.getElementById("umidita");
const elVento = document.getElementById("vento");
const previsioni = document.getElementById("previsioni");
const listaGiorni = document.getElementById("lista-giorni");
const notaPv = document.getElementById("nota-pv");

// Stato: ultimo luogo trovato (per ricalcolare al cambio di configurazione)
let ultimoLuogo = null;

// Mappa dei codici meteo WMO -> testo + emoji
function descrizioneMeteo(code) {
  const mappa = {
    0: ["Sereno", "☀️"],
    1: ["Prevalentemente sereno", "🌤️"],
    2: ["Parzialmente nuvoloso", "⛅"],
    3: ["Nuvoloso", "☁️"],
    45: ["Nebbia", "🌫️"],
    48: ["Nebbia con brina", "🌫️"],
    51: ["Pioviggine leggera", "🌦️"],
    53: ["Pioviggine", "🌦️"],
    55: ["Pioviggine intensa", "🌦️"],
    61: ["Pioggia leggera", "🌧️"],
    63: ["Pioggia", "🌧️"],
    65: ["Pioggia intensa", "🌧️"],
    66: ["Pioggia gelata", "🌧️"],
    67: ["Pioggia gelata intensa", "🌧️"],
    71: ["Neve leggera", "❄️"],
    73: ["Neve", "❄️"],
    75: ["Neve intensa", "❄️"],
    77: ["Granelli di neve", "❄️"],
    80: ["Rovesci leggeri", "🌦️"],
    81: ["Rovesci", "🌦️"],
    82: ["Rovesci violenti", "🌦️"],
    85: ["Rovesci di neve", "🌨️"],
    86: ["Rovesci di neve intensi", "🌨️"],
    95: ["Temporale", "⛈️"],
    96: ["Temporale con grandine", "⛈️"],
    99: ["Temporale con grandine forte", "⛈️"],
  };
  return mappa[code] || ["Condizioni sconosciute", "❓"];
}

// Temperatura di cella stimata (modello di Faiman). vento in m/s.
function temperaturaCella(tAria, gWm2, ventoMs) {
  return tAria + gWm2 / (FAIMAN_U0 + FAIMAN_U1 * ventoMs);
}

// Stima dell'energia giornaliera (kWh) per ciascun giorno locale, integrando ora per ora
// l'irradianza sul piano del pannello e correggendo l'efficienza con la temperatura di cella
// (che dipende da temperatura dell'aria e vento). Ritorna { "YYYY-MM-DD": kWh }.
function produzionePerGiorno(meteo, potenzaW) {
  const giorni = {};
  const h = meteo.hourly;
  if (!h || !h.time || !h.global_tilted_irradiance) return giorni;

  const G = h.global_tilted_irradiance; // W/m² sul piano del pannello
  const T = h.temperature_2m; // °C
  const V = h.wind_speed_10m; // km/h

  for (let i = 0; i < h.time.length; i++) {
    const g = G[i];
    if (g == null || g <= 0) continue; // di notte / senza sole nessuna produzione

    const tAria = T && T[i] != null ? T[i] : T_STC;
    const ventoMs = (V && V[i] != null ? V[i] : 0) / 3.6; // km/h -> m/s
    const tCella = temperaturaCella(tAria, g, ventoMs);
    const etaTermico = 1 + GAMMA * (tCella - T_STC); // <1 se cella calda, >1 se fredda

    // Energia oraria (kWh): valore orario => 1 h, quindi potenza media ≈ energia.
    const eWh =
      (potenzaW / 1000) * (g / 1000) * LOSS_SISTEMA * etaTermico; // kWh in quell'ora

    const giorno = h.time[i].slice(0, 10); // "YYYY-MM-DD" (ora locale, timezone=auto)
    giorni[giorno] = (giorni[giorno] || 0) + eWh;
  }
  return giorni;
}

// Formatta "2026-06-03" in "mer 3 giu" (italiano)
function formattaData(isoDate) {
  const d = new Date(isoDate + "T12:00:00"); // mezzogiorno: evita problemi di fuso
  return d.toLocaleDateString("it-IT", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

// Lettura dei controlli, con valori di sicurezza
function leggiPotenza() {
  let p = parseFloat(inputPotenza.value);
  if (isNaN(p) || p <= 0) p = POTENZA_DEFAULT;
  return p;
}
function leggiTilt() {
  let t = parseFloat(inputTilt.value);
  if (isNaN(t)) t = 30;
  return Math.min(90, Math.max(0, t));
}
function leggiAzimuth() {
  const a = parseFloat(selectAzimuth.value);
  return isNaN(a) ? 0 : a;
}

// 1) Geocoding: dal nome città alle coordinate
async function geocode(citta) {
  const url =
    "https://geocoding-api.open-meteo.com/v1/search?name=" +
    encodeURIComponent(citta) +
    "&count=1&language=it&format=json";
  const resp = await fetch(url);
  if (!resp.ok) throw new Error("Errore di rete (geocoding)");
  const dati = await resp.json();
  if (!dati.results || dati.results.length === 0) {
    return null; // città non trovata
  }
  return dati.results[0];
}

// 2) Forecast: meteo attuale + previsioni giornaliere + dati orari per la stima PV
async function getMeteo(lat, lon, tilt, azimuth) {
  const url =
    "https://api.open-meteo.com/v1/forecast?latitude=" +
    lat +
    "&longitude=" +
    lon +
    "&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m" +
    "&daily=weather_code,temperature_2m_max,temperature_2m_min" +
    "&hourly=global_tilted_irradiance,temperature_2m,wind_speed_10m" +
    "&tilt=" + tilt +
    "&azimuth=" + azimuth +
    "&forecast_days=" + GIORNI_PREVISIONE +
    "&timezone=auto";
  const resp = await fetch(url);
  if (!resp.ok) throw new Error("Errore di rete (forecast)");
  return resp.json();
}

// Mostra il meteo attuale nella card
function mostraRisultato(luogo, meteo) {
  const c = meteo.current;
  const u = meteo.current_units;
  const [testo, emoji] = descrizioneMeteo(c.weather_code);

  const nomeLuogo =
    luogo.name +
    (luogo.admin1 ? ", " + luogo.admin1 : "") +
    (luogo.country ? " (" + luogo.country + ")" : "");

  elLuogo.textContent = nomeLuogo;
  elIcona.textContent = emoji;
  elTemperatura.textContent = Math.round(c.temperature_2m) + (u.temperature_2m || "°C");
  elCondizioni.textContent = testo;
  elPercepita.textContent =
    Math.round(c.apparent_temperature) + (u.apparent_temperature || "°C");
  elUmidita.textContent = c.relative_humidity_2m + (u.relative_humidity_2m || "%");
  elVento.textContent = Math.round(c.wind_speed_10m) + " " + (u.wind_speed_10m || "km/h");

  risultato.hidden = false;
}

// Mostra le previsioni a più giorni con la stima fotovoltaica (corretta in temperatura)
function mostraPrevisioni(meteo) {
  const d = meteo.daily;
  if (!d || !d.time) {
    previsioni.hidden = true;
    return;
  }

  const potenza = leggiPotenza();
  const pvGiorni = produzionePerGiorno(meteo, potenza); // kWh per giorno

  listaGiorni.innerHTML = "";
  let totale = 0;
  let nGiorni = 0;
  for (let i = 0; i < d.time.length; i++) {
    const data = d.time[i];
    const [testo, emoji] = descrizioneMeteo(d.weather_code[i]);
    const max = Math.round(d.temperature_2m_max[i]);
    const min = Math.round(d.temperature_2m_min[i]);
    const pv = pvGiorni[data]; // può mancare per un giorno orario incompleto
    let pvTesto = "produzione n/d";
    if (pv != null) {
      pvTesto = "☀️ ~" + pv.toFixed(1) + " kWh";
      totale += pv;
      nGiorni++;
    }

    const riga = document.createElement("div");
    riga.className = "giorno";
    riga.innerHTML =
      '<span class="giorno-data">' + formattaData(data) + "</span>" +
      '<span class="giorno-icona" title="' + testo + '">' + emoji + "</span>" +
      '<span class="giorno-temp"><strong>' + max + "°</strong> " +
      '<span class="min">' + min + "°</span></span>" +
      '<span class="giorno-pv">' + pvTesto + "</span>";
    listaGiorni.appendChild(riga);
  }

  // Riga totale settimanale
  if (nGiorni > 0) {
    const rigaTot = document.createElement("div");
    rigaTot.className = "giorno totale";
    rigaTot.innerHTML =
      '<span class="giorno-data">Totale ' + nGiorni + " giorni</span>" +
      '<span></span><span></span>' +
      '<span class="giorno-pv"><strong>☀️ ~' + totale.toFixed(1) + " kWh</strong></span>";
    listaGiorni.appendChild(rigaTot);
  }

  // Nota con la configurazione usata
  const etichetta = ETICHETTE_AZIMUTH[String(leggiAzimuth())] || "personalizzato";
  notaPv.innerHTML =
    "☀️ Impianto <strong>" + potenza + "&nbsp;Wp</strong>, inclinazione <strong>" +
    leggiTilt() + "°</strong>, orientamento <strong>" + etichetta + "</strong>. " +
    "Stima oraria su irradianza nel piano del pannello, perdite di sistema " +
    String(LOSS_SISTEMA).replace(".", ",") +
    " e correzione termica (temperatura di cella da aria e vento). Valore indicativo.";

  previsioni.hidden = false;
}

// Imposta un messaggio di stato (caricamento o errore)
function impostaStato(messaggio, isErrore = false) {
  stato.textContent = messaggio;
  stato.classList.toggle("errore", isErrore);
}

// Carica meteo + previsioni per un luogo già noto e aggiorna la UI
async function caricaEmostra(luogo) {
  impostaStato("Caricamento…");
  risultato.hidden = true;
  previsioni.hidden = true;
  btnCerca.disabled = true;
  try {
    const meteo = await getMeteo(
      luogo.latitude,
      luogo.longitude,
      leggiTilt(),
      leggiAzimuth()
    );
    ultimoLuogo = luogo;
    mostraRisultato(luogo, meteo);
    mostraPrevisioni(meteo);
    impostaStato("");
    // Memoria: ultima città e potenza impostata
    localStorage.setItem(KEY_CITTA, luogo.name);
    localStorage.setItem(KEY_POTENZA, String(leggiPotenza()));
  } catch (err) {
    console.error(err);
    impostaStato("Si è verificato un errore. Riprova.", true);
  } finally {
    btnCerca.disabled = false;
  }
}

// Funzione principale: geocoding della città, poi caricamento meteo
async function cercaMeteo(citta) {
  citta = citta.trim();
  if (!citta) {
    impostaStato("Inserisci il nome di una città.", true);
    return;
  }

  impostaStato("Caricamento…");
  btnCerca.disabled = true;

  let luogo;
  try {
    luogo = await geocode(citta);
  } catch (err) {
    console.error(err);
    impostaStato("Si è verificato un errore. Riprova.", true);
    btnCerca.disabled = false;
    return;
  }

  if (!luogo) {
    impostaStato('Città "' + citta + '" non trovata.', true);
    btnCerca.disabled = false;
    return;
  }

  await caricaEmostra(luogo);
}

// Al cambio di potenza/inclinazione/orientamento: ricalcola sull'ultimo luogo trovato.
// La potenza non richiede una nuova chiamata (basta ricalcolare le previsioni),
// ma per semplicità rifacciamo il caricamento: tilt/azimuth cambiano la GTI lato API.
function suCambioConfig() {
  if (ultimoLuogo) caricaEmostra(ultimoLuogo);
}
inputPotenza.addEventListener("change", suCambioConfig);
inputTilt.addEventListener("change", suCambioConfig);
selectAzimuth.addEventListener("change", suCambioConfig);

// Gestione del submit del form (bottone o tasto Invio)
form.addEventListener("submit", (e) => {
  e.preventDefault();
  cercaMeteo(inputCitta.value);
});

// --- PWA: service worker + prompt d'installazione ---

// Registra il service worker (abilita installazione e uso offline su smartphone).
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("sw.js")
      .catch((err) => console.error("Service worker non registrato:", err));
  });
}

// Prompt d'installazione in-app (Android/Chrome). Su iOS l'evento non esiste:
// il bottone resta nascosto e l'utente usa "Condividi → Aggiungi a Home".
const btnInstalla = document.getElementById("btn-installa");
let eventoInstall = null;

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault(); // evita il mini-infobar automatico: lo gestiamo noi
  eventoInstall = e;
  if (btnInstalla) btnInstalla.hidden = false;
});

if (btnInstalla) {
  btnInstalla.addEventListener("click", async () => {
    if (!eventoInstall) return;
    eventoInstall.prompt();
    try {
      await eventoInstall.userChoice; // attende la scelta dell'utente
    } finally {
      eventoInstall = null; // il prompt è usa-e-getta
      btnInstalla.hidden = true;
    }
  });
}

// Ad installazione avvenuta, nascondi il bottone.
window.addEventListener("appinstalled", () => {
  eventoInstall = null;
  if (btnInstalla) btnInstalla.hidden = true;
});

// --- Avvio ---
// Ripristina la potenza salvata (se presente), altrimenti resta il default 900.
const potenzaSalvata = localStorage.getItem(KEY_POTENZA);
if (potenzaSalvata) inputPotenza.value = potenzaSalvata;

// Città: ultima cercata se presente, altrimenti la località di default (Assemini).
const cittaIniziale = localStorage.getItem(KEY_CITTA) || CITTA_DEFAULT;
inputCitta.value = cittaIniziale;
cercaMeteo(cittaIniziale);

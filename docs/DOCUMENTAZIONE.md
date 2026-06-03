# Meteo & Fotovoltaico — Documentazione del progetto

## 1. Scopo del progetto

**Meteo & Fotovoltaico** è una web app leggera che, data una città, mostra:

1. il **meteo attuale** (temperatura, condizioni, percepita, umidità, vento);
2. le **previsioni a 7 giorni** (icona condizioni, temperatura massima/minima);
3. una **stima della produzione fotovoltaica giornaliera** di un impianto, con
   potenza, inclinazione e orientamento configurabili e correzione dell'efficienza
   in funzione di **temperatura** e **vento**;
4. il **totale settimanale** di energia stimata.

### Perché è stato fatto

L'obiettivo è duplice:

- **Didattico**: è un esempio completo di applicazione web "vera" costruita senza
  framework — solo HTML, CSS e JavaScript — che integra una API pubblica, gestisce
  errori, persiste preferenze e si installa come app su smartphone (PWA).
- **Pratico**: fornire una stima rapida e ragionevole di quanta energia produrrebbe
  un pannello/impianto fotovoltaico in una località, su un orizzonte di una settimana,
  utile per valutare a colpo d'occhio l'effetto di **taglia dell'impianto**,
  **inclinazione**, **orientamento** e **condizioni meteo** (incluso l'effetto del
  caldo che riduce la resa e del vento che la recupera).

La località di default è **Assemini** (Sardegna) e la potenza di default è **900 Wp**.

---

## 2. Tecnologie

| Ambito        | Scelta                                                        |
|---------------|---------------------------------------------------------------|
| Linguaggi     | HTML5, CSS3, JavaScript (ES6+ vanilla)                        |
| Framework     | **Nessuno** (no React/Vue/…); nessun build step, nessun npm  |
| Dati meteo    | [Open-Meteo](https://open-meteo.com/) — gratuita, **senza chiave** |
| Installabilità| PWA (manifest + service worker), funziona offline (app shell) |
| Persistenza   | `localStorage` (ultima città, ultima potenza)                |

Niente dipendenze esterne: i file si aprono direttamente nel browser o si servono
come file statici.

---

## 3. Struttura del repository

```
Meteo-app/
├── src/                        # PWA pubblicata su GitHub Pages
│   ├── index.html              # struttura pagina + meta PWA + CSP
│   ├── style.css               # stili (card, previsioni, controlli, safe-area)
│   ├── app.js                  # logica: fetch, modello PV, rendering, localStorage, SW, install
│   ├── manifest.webmanifest    # manifest PWA "ricco" (id, icone, screenshots, display_override)
│   ├── sw.js                   # service worker (cache app shell, API solo rete)
│   ├── icons/                  # icone PWA (192, 512, maskable, apple-touch, favicon)
│   └── screenshots/            # screenshot per il manifest (narrow + wide)
├── android/                    # impacchettamento TWA (vero APK)
│   ├── twa-manifest.json       # config TWA (package, compileSdk 36, targetSdk 35)
│   └── assetlinks.json         # Digital Asset Links (SHA-256 della chiave dell'APK)
├── docs/
│   ├── PIANO.md                # piano di sviluppo e decisioni
│   ├── DOCUMENTAZIONE.md       # questo documento
│   └── BUILD-ANDROID.md        # come generare/distribuire l'APK
├── .github/workflows/          # deploy automatico su GitHub Pages
├── build_icons.py              # script PIL per (ri)generare le icone
├── CHANGELOG.md                # storico versioni (0.1.0 → 0.6.0)
├── LICENSE                     # MIT
├── README.md
└── CLAUDE.md                   # istruzioni per Claude Code
```

> Non versionati (in `.gitignore`): `dist/` (APK/AAB + keystore + password, generati da
> PWABuilder), `android/android.keystore` (chiave di test), screenshot di prova. L'APK
> distribuibile è pubblicato come **GitHub Release** (`Meteo.apk`).

---

## 4. Come funziona (flusso)

1. All'avvio l'app legge da `localStorage` l'ultima città e l'ultima potenza; se non
   c'è una città salvata usa **Assemini**. Avvia subito una ricerca.
2. **Geocoding**: il nome città viene risolto in coordinate (lat/lon) tramite l'API di
   geocoding di Open-Meteo.
3. **Forecast**: con le coordinate (e con inclinazione/orientamento scelti) si richiede
   un'unica chiamata che restituisce:
   - meteo attuale (`current`);
   - previsioni giornaliere (`daily`: codice meteo, T max/min);
   - serie **orarie** per la stima PV (`hourly`: irradianza sul piano del pannello,
     temperatura dell'aria, velocità del vento).
4. Si renderizza il meteo attuale, le 7 card giornaliere con la stima PV e il totale
   settimanale.
5. Cambiando **potenza**, **inclinazione** o **orientamento** la stima si **ricalcola**
   usando l'ultimo luogo trovato (per tilt/azimuth serve una nuova chiamata, perché
   l'irradianza sul piano dipende da essi).

### Endpoint Open-Meteo usati

Geocoding:
```
https://geocoding-api.open-meteo.com/v1/search?name={città}&count=1&language=it&format=json
```

Forecast:
```
https://api.open-meteo.com/v1/forecast
  ?latitude={lat}&longitude={lon}
  &current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m
  &daily=weather_code,temperature_2m_max,temperature_2m_min
  &hourly=global_tilted_irradiance,temperature_2m,wind_speed_10m
  &tilt={0-90}&azimuth={-180..180}
  &forecast_days=7&timezone=auto
```

Convenzione **azimuth** (verificata interrogando l'API):
`Sud = 0°, Est = −90°, Ovest = +90°, Nord = ±180°`.

---

## 5. Il modello fotovoltaico

La produzione è stimata **ora per ora** e poi sommata sul giorno locale (`timezone=auto`).

### 5.1 Irradianza sul piano del pannello
Si usa `global_tilted_irradiance` (GTI, W/m²): l'irradianza già proiettata sul piano del
pannello per l'inclinazione (`tilt`) e l'orientamento (`azimuth`) scelti — non quella
orizzontale. Questo rende la stima sensibile a come è montato l'impianto.

### 5.2 Temperatura di cella (modello di Faiman)
I moduli si scaldano al sole e perdono efficienza; il vento li raffredda:
```
vento_ms = wind_speed_10m / 3.6
T_cell   = T_aria + G / (U0 + U1 · vento_ms)
```
con `U0 = 25 W/m²/K` e `U1 = 6,84 W/m²/K·(m/s)` (valori IEC 61853 per modulo libero sul retro).
Più sole → cella più calda; più vento → cella più fredda.

### 5.3 Correzione di efficienza termica
```
eta_T = 1 + GAMMA · (T_cell − 25)      con GAMMA = −0,004 /°C  (≈ −0,4 %/°C)
```
A 25 °C (STC) `eta_T = 1`. A 45 °C di cella ≈ `0,92` (−8 %).

### 5.4 Energia
```
E_ora   = (P_W / 1000) · (G / 1000) · LOSS_SISTEMA · eta_T        [kWh]
E_giorno = Σ_ora E_ora
```
- `P_W` = potenza di picco impostata (default 900 W).
- `LOSS_SISTEMA = 0,85` = perdite di sistema **non termiche** (inverter, cablaggi,
  mismatch, sporco). L'effetto termico è tenuto separato (`eta_T`) per **non contarlo
  due volte**.

### 5.5 Costanti
Tutte in cima a `src/app.js` e facili da modificare:
`POTENZA_DEFAULT`, `CITTA_DEFAULT`, `GIORNI_PREVISIONE`, `LOSS_SISTEMA`, `GAMMA`,
`T_STC`, `FAIMAN_U0`, `FAIMAN_U1`.

### 5.6 Limiti del modello (onestà intellettuale)
La stima è **indicativa** e non sostituisce un dimensionamento professionale. Non modella:
- ombreggiamenti (orizzonte, edifici, alberi);
- sporcamento reale e degrado del modulo nel tempo;
- albedo specifica del sito e contributo riflesso;
- dipendenza dell'efficienza dal livello di irraggiamento (comportamento *low-light*) e
  dallo spettro;
- curva reale dell'inverter (efficienza variabile col carico, soglia di accensione).

È adatta a **confrontare** giornate, orientamenti, inclinazioni e taglie d'impianto, e a
dare un ordine di grandezza credibile.

---

## 6. PWA — installazione su smartphone

L'app è una **Progressive Web App**: si può "installare" sulla schermata home del
telefono e aprire a schermo intero come un'app nativa; l'app shell è disponibile anche
offline (i dati meteo richiedono però la rete).

Componenti:
- `manifest.webmanifest`: nome, icone (192/512/maskable), colori, `display: standalone`.
- `sw.js`: service worker; **cache-first** per i file locali, **solo rete** per le API.
- meta tag in `index.html`: `theme-color`, `apple-touch-icon`, `apple-mobile-web-app-*`.

### Come installarla (comportamento attuale del bottone)

L'app rileva la piattaforma (`navigator.userAgent`) e adatta il bottone:

- **Android** → bottone **«📥 Scarica l'app (APK)»**: al clic scarica l'**APK firmato**
  dalla release GitHub (`releases/latest/download/Meteo.apk`). L'utente apre il file e
  conferma l'installazione (sideload). Avendo `targetSdk 35`, **non** compare l'avviso
  Play Protect "versione precedente di Android".
- **Desktop (Chrome/Edge)** → bottone **«📲 Installa l'app»**: appare quando scatta
  `beforeinstallprompt` e installa la PWA.
- **iOS/Safari** → il bottone non compare (l'evento non esiste): *Condividi → Aggiungi a Home*.

> Limite di sicurezza Android: una pagina web può **avviare il download** di un APK ma
> **non** può installarlo da sola — l'installazione richiede sempre la conferma dell'utente
> e, la prima volta, il permesso "installa app da questa origine".

> Nota: in locale la PWA è pienamente funzionante solo via `http://localhost` o `https://`.
> Aprendo il file con `file://` il service worker non si registra (è normale).

### L'avviso "Android 16" e perché abbiamo scelto la TWA

Su Android 15/16 il sistema **segnala le app con `targetSdk` troppo vecchio** (l'avviso
scatta quando è più di 2 versioni sotto l'API del dispositivo). Quando si installa una PWA,
Android crea un **WebAPK** il cui `targetSdk` è deciso dal *minting server* di Google
(**non** dal manifest): per questo l'hardening della PWA (manifest ricco, CSP, icone…)
**non basta** a cambiare quel numero, e su alcuni dispositivi l'avviso resta.

**Soluzione definitiva adottata:** impacchettare la PWA in una **Trusted Web Activity (TWA)**
— un vero APK con `targetSdk 35` — distribuito come release. Così l'avviso non compare.

- Configurazione TWA: [`android/twa-manifest.json`](../android/twa-manifest.json)
  (package `io.github.gvasta62.meteoapp`, `compileSdk 36`, `targetSdk 35`).
- APK generato con **PWABuilder** e pubblicato come **GitHub Release `v1.0.0`**
  (`Meteo.apk`), verificato con `aapt` (`targetSdkVersion 35`).
- Guida completa (PWABuilder e Bubblewrap) in [`docs/BUILD-ANDROID.md`](BUILD-ANDROID.md).

L'hardening PWA resta comunque applicato (manifest `id`/`screenshots`/`display_override`,
icone 192/512+maskable, service worker con `fetch`, **CSP** restrittiva, nessuno script
inline): migliora sicurezza, qualità dell'install e affidabilità del WebAPK su desktop.

### Aprire l'APK a schermo intero (opzionale)

Una TWA mostra una sottile barra dell'indirizzo finché il dominio non è verificato con i
**Digital Asset Links**. Per rimuoverla va pubblicato
`https://gvasta62.github.io/.well-known/assetlinks.json` (contenuto pronto in
[`android/assetlinks.json`](../android/assetlinks.json), con la SHA-256 della chiave
dell'APK). ⚠️ Deve stare alla **radice del dominio** (repo `gvasta62.github.io`), non in
questo repository. Senza, l'app funziona comunque e **non** mostra l'avviso Play Protect.

Riferimenti: [Google Play target API level](https://developer.android.com/google/play/requirements/target-sdk),
[Android 14 minimum SDK](https://bayton.org/android/android-14-minimum-sdk/),
[web.dev — installabilità](https://web.dev/articles/install-criteria).

---

## 7. Avvio in locale

Apri `src/index.html` nel browser, oppure (consigliato, per far funzionare la PWA):

```bash
cd src
python3 -m http.server 8000
# poi apri http://localhost:8000
```

Per rigenerare le icone (richiede Pillow):
```bash
python3 build_icons.py
```

---

## 8. Roadmap / estensioni possibili

- Geolocalizzazione del browser ("meteo qui").
- Toggle °C/°F.
- Modello PV più ricco: low-light, spettro, curva inverter, ombreggiamenti.
- Grafico orario della produzione e dell'irraggiamento.
- Più impianti/stringhe e confronto fra configurazioni.

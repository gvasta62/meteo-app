# Changelog

Tutte le modifiche rilevanti del progetto **Meteo & Fotovoltaico**.
Formato ispirato a [Keep a Changelog](https://keepachangelog.com/it/1.1.0/);
versionamento [SemVer](https://semver.org/lang/it/).

> Nota: il progetto è nato come **progetto guidato** e tutte le versioni qui elencate
> sono state sviluppate il **2026-06-03** in iterazioni successive.

## [0.6.0] — 2026-06-03 — PWA installabile + conformità Android 15/16

### Aggiunto
- Bottone in-app **«📲 Installa l'app sul telefono»** gestito via `beforeinstallprompt`
  (con `appinstalled` per nasconderlo dopo l'installazione).
- Manifest "ricco" per far coniare a Chrome un **WebAPK completo**: `id`, `categories`,
  `display_override`, **screenshots** (`narrow` 412×915 e `wide` 1280×800).
- **Content-Security-Policy** restrittiva via `<meta>` (solo risorse locali + API Open-Meteo).
- Sezione di documentazione su **sicurezza/installabilità** e sull'avviso Android 16.

### Modificato
- Registrazione del service worker e logica del prompt spostate in `app.js`
  (**nessuno script inline**, per una CSP severa).
- Cache del service worker portata a `meteo-app-v2`.

### Contesto
Su Android 15/16 le app con `targetSdk < 24` vengono segnalate. Per una PWA il `targetSdk`
del WebAPK è deciso dal *minting server* di Google (non dal manifest): rendendo la PWA
pienamente conforme si evita il fallback a un'installazione "degradata" che genera l'avviso.

## [0.5.0] — 2026-06-03 — PWA, pubblicazione e documentazione

### Aggiunto
- **PWA**: `manifest.webmanifest`, service worker (`sw.js`, cache app-shell + API solo rete),
  icone generate con Pillow (`build_icons.py`): 192/512, maskable, apple-touch, favicon.
- Meta tag mobile (theme-color, apple-mobile-web-app-*, safe-area per il notch).
- **Documentazione dettagliata** (`docs/DOCUMENTAZIONE.md`) e licenza **MIT**.
- **CI/CD**: workflow GitHub Actions che pubblica `src/` su **GitHub Pages**.
- Pubblicazione del repository pubblico `gvasta62/meteo-app` e sito online
  https://gvasta62.github.io/meteo-app/.

## [0.4.0] — 2026-06-03 — Potenza configurabile, Assemini, correzione termica

### Aggiunto
- Campo **Potenza** dell'impianto (default **900 Wp**); la stima scala linearmente.
- Località di **default Assemini**; memoria anche della potenza in `localStorage`.
- **Correzione termica** della resa: temperatura di cella (modello di **Faiman**, che
  include il vento) + coefficiente di potenza del modulo (`-0,4 %/°C`). Calcolo **ora per ora**.
- **Totale settimanale** dei kWh stimati.

### Modificato
- Le perdite di sistema (`0,85`) sono ora separate dall'effetto termico, per non contarlo
  due volte (prima erano lumpate in un unico `PR = 0,75`).

## [0.3.0] — 2026-06-03 — Fotovoltaico sul piano inclinato

### Aggiunto
- Controlli **Inclinazione** (0–90°) e **Orientamento** (Sud/SE/E/SO/O/Nord).
- Stima PV basata sull'irradianza **sul piano del pannello** (`global_tilted_irradiance`)
  con parametri `tilt`/`azimuth`, invece dell'irradianza orizzontale.
- Ricalcolo immediato al cambio di inclinazione/orientamento (riusa l'ultimo luogo trovato).

### Verificato
- Convenzione azimuth Open-Meteo confermata via API: `Sud = 0°, Est = −90°, Ovest = +90°, Nord = ±180°`.

## [0.2.0] — 2026-06-03 — Previsioni, memoria, prima stima PV

### Aggiunto
- **Previsioni a 7 giorni** (icona condizioni, temperatura max/min).
- **Memoria** dell'ultima città cercata (`localStorage`) con ricarica automatica all'avvio.
- Prima **stima fotovoltaica** giornaliera per un pannello da 900 Wp (modello peak-sun-hours
  su irradianza orizzontale `shortwave_radiation_sum`).

## [0.1.0] — 2026-06-03 — App meteo di base

### Aggiunto
- Ricerca di una città (geocoding Open-Meteo) e **meteo attuale**: temperatura, condizioni
  (codici WMO → testo + emoji), percepita, umidità, vento.
- Gestione errori: campo vuoto, città non trovata, errore di rete.
- Struttura del progetto (`src/`, `docs/`, `README.md`, `CLAUDE.md`) e piano (`docs/PIANO.md`).
- Stack: HTML/CSS/JavaScript vanilla, API Open-Meteo senza chiave.

[0.6.0]: https://github.com/gvasta62/meteo-app
[0.5.0]: https://github.com/gvasta62/meteo-app
[0.4.0]: https://github.com/gvasta62/meteo-app
[0.3.0]: https://github.com/gvasta62/meteo-app
[0.2.0]: https://github.com/gvasta62/meteo-app
[0.1.0]: https://github.com/gvasta62/meteo-app

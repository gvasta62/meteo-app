# Meteo-app — Istruzioni per Claude Code

## Cos'è questo progetto

Una semplice applicazione web che mostra il meteo attuale di una città.
L'utente inserisce il nome di una città, l'app recupera i dati meteo e li mostra.

## Stack tecnologico

- **HTML / CSS / JavaScript vanilla** — nessun framework (no React, Vue, Angular...)
- **Nessun build step**, nessun bundler, nessun npm install: i file si aprono direttamente nel browser
- **API**: [Open-Meteo](https://open-meteo.com/) — gratuita, **senza chiave API**
  - Geocoding: `https://geocoding-api.open-meteo.com/v1/search?name={città}`
  - Forecast: `https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,...`

## Struttura dei file

```
src/
├── index.html    # struttura della pagina
├── style.css     # stili
└── app.js        # logica: fetch API, gestione ricerca, aggiornamento DOM
docs/
└── PIANO.md      # piano di sviluppo dettagliato
```

## Principi e convenzioni

- **Semplicità prima di tutto.** Preferire codice chiaro e leggibile a soluzioni "intelligenti".
- Mantenere separati i tre file: struttura (HTML), stile (CSS), logica (JS).
- JavaScript moderno (ES6+): `const`/`let`, arrow function, `async/await`, `fetch`.
- Niente dipendenze esterne, niente CDN per librerie JS.
- Commenti in italiano, brevi e utili.
- Gestire sempre gli errori: città non trovata, errore di rete, campo vuoto.

## Come testare

Aprire `src/index.html` nel browser (o servire `src/` con un server locale) e verificare
che la ricerca di una città mostri i dati meteo corretti.

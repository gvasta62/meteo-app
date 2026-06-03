# Piano di sviluppo — Meteo-app

## 1. Obiettivo

App web che mostra il meteo attuale di una città. L'utente cerca una città e vede i dati
meteo. Può cercare città diverse. Solo HTML/CSS/JS, API Open-Meteo (senza chiave).

## 2. API Open-Meteo (due chiamate)

### a) Geocoding — trovare le coordinate dalla città
```
GET https://geocoding-api.open-meteo.com/v1/search?name=Roma&count=1&language=it&format=json
```
Risposta (estratto):
```json
{
  "results": [
    { "name": "Roma", "latitude": 41.89, "longitude": 12.48, "country": "Italia", "admin1": "Lazio" }
  ]
}
```
Se manca `results` → città non trovata.

### b) Forecast — meteo attuale dalle coordinate
```
GET https://api.open-meteo.com/v1/forecast?latitude=41.89&longitude=12.48
    &current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m
    &timezone=auto
```
Risposta (estratto):
```json
{
  "current": {
    "temperature_2m": 24.3,
    "relative_humidity_2m": 55,
    "apparent_temperature": 25.1,
    "weather_code": 2,
    "wind_speed_10m": 12.4
  },
  "current_units": { "temperature_2m": "°C", "wind_speed_10m": "km/h" }
}
```

### c) weather_code → descrizione + icona
Mappare i codici WMO in testo italiano + emoji. Esempi:
| codice | descrizione        | emoji |
|--------|--------------------|-------|
| 0      | Sereno             | ☀️    |
| 1,2,3  | Poco/parz. nuvoloso| 🌤️/⛅/☁️ |
| 45,48  | Nebbia             | 🌫️   |
| 51-67  | Pioggia            | 🌧️   |
| 71-77  | Neve               | ❄️    |
| 80-82  | Rovesci            | 🌦️   |
| 95-99  | Temporale          | ⛈️    |

## 3. Interfaccia (index.html)

```
┌─────────────────────────────────┐
│           🌤️ Meteo              │
│  ┌──────────────────┐ ┌──────┐  │
│  │ Cerca una città… │ │ Cerca│  │
│  └──────────────────┘ └──────┘  │
│                                 │
│   [ area risultato meteo ]      │
│     Roma, Italia                │
│        ☀️  24°C                 │
│     Sereno                      │
│     Percepita 25° · Umidità 55% │
│     Vento 12 km/h               │
│                                 │
│   [ area errori / caricamento ] │
└─────────────────────────────────┘
```

## 4. Logica (app.js)

1. Riferimenti al DOM: input, bottone, form, contenitore risultato, contenitore stato.
2. `cercaMeteo(citta)`:
   - validazione: se vuoto → messaggio "Inserisci una città".
   - mostra stato "Caricamento…".
   - `geocode(citta)` → coordinate (gestisci "non trovata").
   - `getMeteo(lat, lon)` → dati current.
   - `mostraRisultato(...)` aggiorna il DOM.
   - `catch` → messaggio errore di rete.
3. Eventi: submit del form (così funziona anche con Invio) → `cercaMeteo`.
4. Funzione `descrizioneMeteo(code)` → { testo, emoji } dalla tabella WMO.

## 5. Stile (style.css)

- Layout centrato, card con ombra, angoli arrotondati.
- Sfondo gradiente azzurro.
- Responsive (mobile-first), font di sistema.
- Stati visivi distinti per errore (rosso) e caricamento.

## 6. Casi limite da gestire

- Campo di ricerca vuoto.
- Città inesistente (nessun `results`).
- Errore di rete / API non raggiungibile.
- Doppio invio mentre carica (disabilitare bottone durante il fetch).

## 7. Passi di implementazione

1. `src/index.html` — struttura + collegamento a CSS e JS.
2. `src/style.css` — stili della card e degli stati.
3. `src/app.js` — fetch, mappatura codici, rendering, gestione errori.
4. Test nel browser: città valida, città inesistente, campo vuoto.

## 8. Estensioni implementate (v2)

### 8.1 Previsioni a più giorni
Aggiungere alla chiamata forecast i parametri `daily`:
```
&daily=weather_code,temperature_2m_max,temperature_2m_min,shortwave_radiation_sum
&forecast_days=7
```
Risposta:
```json
"daily": {
  "time": ["2026-06-03", ...],
  "weather_code": [2, ...],
  "temperature_2m_max": [27.1, ...],
  "temperature_2m_min": [16.4, ...],
  "shortwave_radiation_sum": [24.8, ...]   // MJ/m² al giorno
}
```
Mostrare una card per giorno con: data (gg breve), emoji, max/min.

### 8.2 Memoria ultima città (localStorage)
- Al termine di una ricerca riuscita: `localStorage.setItem("ultimaCitta", nome)`.
- Al caricamento della pagina: se esiste `ultimaCitta`, precompilare l'input e avviare
  automaticamente la ricerca.

### 8.3 Produzione fotovoltaica giornaliera (potenza/piano configurabili, con correzione termica)
Per ogni giorno della previsione stimare l'energia prodotta da un impianto di **potenza
configurabile** (default **900 Wp**), tenendo conto di **inclinazione** e **orientamento**
scelti, e correggendo l'efficienza in base alla **temperatura** e al **vento** del luogo.

Dati orari richiesti (irradianza sul piano del pannello + aria + vento):
```
&hourly=global_tilted_irradiance,temperature_2m,wind_speed_10m
&tilt={0-90}&azimuth={-180..180}&timezone=auto
```
Convenzione azimuth Open-Meteo (verificata via API):
`0 = Sud, -90 = Est, 90 = Ovest, ±180 = Nord`.

Calcolo **ora per ora**, poi somma sul giorno locale:
```
// temperatura di cella — modello di Faiman (include il vento)
vento_ms = wind_speed_10m / 3.6
T_cell   = T_aria + G / (U0 + U1 · vento_ms)          // U0=25, U1=6.84 (W/m²/K)

// efficienza relativa per effetto termico (coeff. potenza del modulo)
eta_T    = 1 + GAMMA · (T_cell − 25)                  // GAMMA = -0.004 /°C

// energia oraria (kWh): valore orario => 1 h
E_h      = (P_W / 1000) · (G / 1000) · LOSS_SISTEMA · eta_T
E_giorno = Σ_ora E_h
```
- `P_W` = potenza di picco impostata (default 900 W).
- `LOSS_SISTEMA = 0.85` = perdite NON termiche (inverter, cablaggi, mismatch, sporco).
  L'effetto termico è separato (`eta_T`) per non contarlo due volte.
- `GAMMA = -0.004 /°C` (~ -0,4%/°C, silicio cristallino tipico).
- Faiman `U0=25`, `U1=6.84` (IEC 61853, modulo libero sul retro).
- Costanti tutte in cima a `app.js` (`POTENZA_DEFAULT`, `CITTA_DEFAULT`, `LOSS_SISTEMA`,
  `GAMMA`, `FAIMAN_U0/U1`).
- UI: input **Potenza** (W) + **Inclinazione** (0-90°, default 30) + **Orientamento**
  (default Sud). Al cambio di uno qualunque si **ricalcola** sull'ultimo luogo trovato.
- Viene mostrato anche il **totale settimanale** dei kWh.

Comportamento atteso (verificato): a parità di giorno, una cella più calda rende meno
(efficienza < 1), il vento la raffredda e recupera resa; la produzione scala linearmente
con la potenza impostata.

Nota: stima indicativa. Non modella ombreggiamenti, albedo specifica del sito, sporcamento
reale né la dipendenza dell'efficienza dal livello di irraggiamento (low-light).

## 9. Default e memoria

- **Città di default**: Assemini (`CITTA_DEFAULT`), usata al primo avvio se non c'è una
  città salvata.
- **Potenza di default**: 900 W (`POTENZA_DEFAULT`).
- `localStorage` ricorda l'ultima città cercata (`ultimaCitta`) e l'ultima potenza
  impostata (`potenzaPannello`).

## 10. Estensioni ancora possibili (futuro)

- Geolocalizzazione del browser ("meteo qui").
- Toggle °C/°F.
- Dipendenza dell'efficienza dall'irraggiamento (low-light) e da spettro/sporcamento.

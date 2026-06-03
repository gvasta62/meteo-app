# Meteo & Fotovoltaico

Web app che mostra il meteo attuale e le previsioni a 7 giorni di una città, e stima la
**produzione fotovoltaica giornaliera** di un impianto (potenza, inclinazione e orientamento
configurabili, con correzione termica). Solo HTML/CSS/JS vanilla, dati [Open-Meteo](https://open-meteo.com/),
**senza chiave API**. È una **PWA**: si installa e si usa sullo smartphone.

🔗 **App online (PWA):** https://gvasta62.github.io/meteo-app/

> Documentazione dettagliata in [`docs/DOCUMENTAZIONE.md`](docs/DOCUMENTAZIONE.md);
> piano e decisioni in [`docs/PIANO.md`](docs/PIANO.md).

## Caratteristiche

- Ricerca di una città per nome
- Meteo attuale: temperatura, condizioni, vento, umidità
- Previsioni a 7 giorni (icona, temperatura max/min) + **totale settimanale** dei kWh
- Stima della produzione fotovoltaica giornaliera con **potenza, inclinazione e orientamento
  configurabili** e **correzione termica** (la resa cala con la temperatura di cella, il vento la raffredda)
- Località di default **Assemini**, potenza di default **900 Wp**
- Memoria di ultima città e potenza (`localStorage`)
- Nessuna chiave API richiesta (usa [Open-Meteo](https://open-meteo.com/))
- Solo HTML, CSS e JavaScript vanilla — nessun framework

### Nota sul calcolo fotovoltaico

La stima usa i dati **orari** di Open-Meteo (irradianza sul piano del pannello
`global_tilted_irradiance`, temperatura `temperature_2m`, vento `wind_speed_10m`) per
l'inclinazione e l'orientamento scelti, integrando ora per ora con correzione termica:

```
T_cell  = T_aria + G ÷ (25 + 6,84 · vento_m/s)        (modello di Faiman)
eta_T   = 1 + (−0,004) · (T_cell − 25)                (coeff. potenza modulo)
E_ora   = (P_W ÷ 1000) · (G ÷ 1000) · 0,85 · eta_T    (kWh)
E_giorno = somma delle ore
```

`0,85` sono le perdite di sistema **non** termiche (inverter, cablaggi, mismatch, sporco);
l'effetto della temperatura è separato per non contarlo due volte. Convenzione orientamento
(azimuth Open-Meteo): `Sud = 0°, Est = −90°, Ovest = +90°, Nord = ±180°`. Cambiando potenza,
inclinazione o orientamento la stima si ricalcola subito. Le costanti di modello sono in cima
a `src/app.js`. Valore indicativo: non modella ombreggiamenti, sporcamento reale né la
dipendenza dell'efficienza dal livello di irraggiamento.

## Tecnologie

- HTML5
- CSS3
- JavaScript (ES6, vanilla)
- API gratuite Open-Meteo (geocoding + forecast)

## Come avviare in locale

Servi la cartella `src/` con un piccolo server (consigliato, per far funzionare la PWA):

```bash
cd src
python3 -m http.server 8000
# poi apri http://localhost:8000
```

(Aprendo il file con `file://` la PWA/service worker non si registra: è normale.)

## Installazione sullo smartphone (PWA)

1. Apri l'app online: **https://gvasta62.github.io/meteo-app/**
2. **Android/Chrome**: menu ⋮ → *Installa app* / *Aggiungi a schermata Home*.
3. **iOS/Safari**: *Condividi* → *Aggiungi a Home*.

L'app shell funziona anche offline; i dati meteo richiedono la rete.

## Struttura del progetto

```
Meteo-app/
├── src/                      # app: HTML, CSS, JS, manifest, service worker, icone
├── docs/                     # DOCUMENTAZIONE.md + PIANO.md
├── .github/workflows/        # deploy automatico su GitHub Pages
├── build_icons.py            # rigenerazione icone PWA (Pillow)
├── README.md
└── CLAUDE.md
```

## Licenza

MIT — vedi [`LICENSE`](LICENSE).

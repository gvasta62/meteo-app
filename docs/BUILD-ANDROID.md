# Build dell'app Android (TWA) — eliminare l'avviso Play Protect

L'avviso *«Questa app è stata sviluppata per una versione precedente di Android»* dipende
**solo** dal `targetSdkVersion` del pacchetto installato. Quando installi una PWA, Android
crea un **WebAPK** il cui `targetSdk` è deciso dal *minting server* di Google (non dal
manifest): se è troppo vecchio, scatta l'avviso.

La soluzione definitiva è **impacchettare la PWA in una Trusted Web Activity (TWA)** — un
vero APK Android — con `targetSdkVersion` recente. Questo progetto è già configurato:
vedi [`android/twa-manifest.json`](../android/twa-manifest.json).

Parametri del pacchetto:

| Campo | Valore |
|-------|--------|
| Package ID | `io.github.gvasta62.meteoapp` |
| `compileSdk` | 36 (Android 16) |
| **`targetSdk`** | **35** → su Android 16 nessun avviso Play Protect |
| `minSdk` | 21 |
| URL caricato | https://gvasta62.github.io/meteo-app/ |

## ✅ APK già generato (PWABuilder)

L'APK è stato generato con PWABuilder e si trova in **`dist/Meteo.apk`** (cartella locale,
esclusa dal repository). Verificato: `targetSdkVersion 35` → su Android 16 **nessun avviso
Play Protect**.

Contenuto di `dist/`:
- `Meteo.apk` — da installare sul telefono (sideload)
- `Meteo.aab` — per un'eventuale pubblicazione sul Google Play Store
- `signing.keystore` + `signing-key-info.txt` — **chiave di firma e password: tenere riservate!**
- `assetlinks.json` — Digital Asset Links con l'impronta di questa chiave

Chiave effettivamente usata dall'APK (PWABuilder), **SHA-256**:
`36:2E:56:1E:5A:F1:D7:A7:D7:AD:DF:76:C6:0B:0F:C8:63:62:D5:B8:45:E4:16:57:32:1D:4B:9E:98:72:FA:B4`
→ è questa l'impronta in [`android/assetlinks.json`](../android/assetlinks.json).

> Esiste anche una keystore locale di prova (`android/android.keystore`, alias `android`,
> pass `meteoapp2026`, SHA-256 `94:D6:…:1D:D1`) creata durante i test: **non** è quella
> dell'APK consegnato. Usa quella di PWABuilder (`dist/signing.keystore`) per le versioni future.

---

## Perché l'APK non è stato compilato automaticamente

La toolchain è stata installata e il progetto TWA generato, ma la **compilazione Gradle**
non è eseguibile nell'ambiente di sviluppo usato: Gradle richiede connessioni **loopback
(127.0.0.1)** tra i suoi processi, che in quell'ambiente (WSL/sandbox) sono **rifiutate**.
Su una macchina normale (Windows/Linux/Mac) questo problema non esiste.

---

## Opzione A — PWABuilder (consigliata, senza installare nulla)

1. Vai su **https://www.pwabuilder.com/** e inserisci `https://gvasta62.github.io/meteo-app/`.
2. Sezione **Android** → *Generate Package*.
3. In *Package ID* metti `io.github.gvasta62.meteoapp`.
4. **Signing key**: per far combaciare l'`assetlinks.json` già preparato, scegli
   *Use existing* e carica `android/android.keystore` (alias `android`, password `meteoapp2026`).
   In alternativa lascia che PWABuilder generi una chiave nuova: in quel caso usa l'**SHA-256
   che ti mostra PWABuilder** per rigenerare `assetlinks.json`.
5. Scarica lo ZIP: contiene l'**APK** (sideload diretto) e l'**AAB** (per il Play Store).
6. Copia l'APK sul telefono e installalo: avendo `targetSdk 35`, **non** comparirà l'avviso
   *«versione precedente di Android»*.

## Opzione B — Bubblewrap su una macchina con rete normale

Prerequisiti: Node.js, JDK 17, Android SDK (Bubblewrap può scaricarli da solo).

```bash
npm i -g @bubblewrap/cli
# copia android/twa-manifest.json e android/android.keystore in una cartella vuota
cd quella-cartella
bubblewrap update --skipVersionUpgrade      # genera il progetto dal twa-manifest.json
BUBBLEWRAP_KEYSTORE_PASSWORD=meteoapp2026 \
BUBBLEWRAP_KEY_PASSWORD=meteoapp2026 \
  bubblewrap build --skipPwaValidation
# output: app-release-signed.apk  (+ app-release-bundle.aab)
```

> In WSL la build fallisce per il blocco del loopback di Gradle: eseguila in **Windows
> nativo** (PowerShell) o su Linux/Mac, oppure usa l'Opzione A.

---

## Aprire l'app a schermo intero (senza barra dell'indirizzo)

Una TWA mostra una sottile barra del browser finché non verifichi il dominio con i
**Digital Asset Links**. Serve pubblicare questo file:

`https://gvasta62.github.io/.well-known/assetlinks.json`

con il contenuto già pronto in [`android/assetlinks.json`](../android/assetlinks.json)
(package + SHA-256 della nostra chiave).

⚠️ Attenzione: il file deve stare alla **radice del dominio** `gvasta62.github.io`, cioè nel
repository GitHub Pages dell'utente chiamato `gvasta62.github.io` — **non** in questo
repository (che è pubblicato sotto `/meteo-app/`). Se quel repo non esiste, va creato
(può contenere solo `.well-known/assetlinks.json`).

Senza asset links l'app **funziona comunque** e **non** mostra l'avviso Play Protect:
vedrai solo una sottile barra con l'URL.

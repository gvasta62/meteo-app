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

Chiave di firma: [`android/android.keystore`](../android/) (alias `android`).
**SHA-256:** `94:D6:D1:39:E0:AC:EA:38:10:90:A9:F8:96:D1:72:BE:FA:BC:A0:6F:C3:54:14:5D:3F:95:07:8B:27:8C:1D:D1`

> La keystore e le sue password vanno tenute **riservate** (non sono nel repository).
> Password usate in fase di setup: store/key = `meteoapp2026` (cambiale se vuoi rigenerare la chiave).

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

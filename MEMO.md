# MEMO — Jingle Machine

Guida operativa per lavorare in locale in modo veloce. Versionato su git apposta:
quando qualcosa cambia (versioni, decisioni architetturali, trucchi), **aggiorna questo file**.

---

## 1. Cos'è

Webapp per una **libreria di jingle PRIVATA per utente**. Permette di:

1. Autenticarsi (Firebase Authentication: email/password + Google). **Login obbligatorio** (`authGuard`), sessione **24h** → si rilogga una volta al giorno.
2. Caricare un file audio (o **estrarlo da YouTube**), tagliarlo in **MP3**, salvarlo nella **propria** libreria.
3. Storage: **Cloudinary** per i file MP3 (storage remoto) + **Firestore** per i metadati. **Due utenti vedono librerie diverse** (filtro per `uid`).

> **YouTube → MP3**: implementato (Fase 2) via il **Mixer locale** (yt-dlp + ffmpeg, `/info` + `/extract`). Attivo nell'**app standalone (Electron)** e in **dev**; su **GitHub Pages è disattivato** (nessun Mixer → pulsante nascosto). Contesto storico/ricerca in [§8](#8-youtube--audio-il-nodo-da-sciogliere).

## Struttura del repo (monorepo "semplice")

Due cartelle sorelle, ognuna **indipendente** (proprio `package.json` e `node_modules`):

```
JingleMachine/
├── client/    # app Angular (la "sala": ciò che l'utente vede)
├── server/    # app desktop Electron + server locale per YouTube → MP3 (la "cucina")
├── firebase/  # security rules (solo Firestore; storage.rules obsoleto → Cloudinary)
├── .github/   # workflow: deploy GitHub Pages + build pacchetti Electron
├── MEMO.md · ROADMAP.md · CLAUDE.md · README.md
```

> Regola d'oro: i comandi `npm ...` vanno lanciati **dentro la cartella giusta** (`client/` per l'app, `server/` per il server). Non c'è un `package.json` in radice.

> 📌 **Architettura attuale**: **Firebase Auth + Firestore** (gratis, no carta) · **Cloudinary** per i file MP3 (gratis, no carta) ·
> **Mixer locale** per estrarre da YouTube, **embedded nell'app standalone Electron**. Libreria **privata per utente**.
> ⚠️ **Firebase Storage NON è più usato** (migrazione a Cloudinary completata, Fase 3): eventuali riferimenti residui allo Storage sono storici.

## 🎨 Riferimenti di design

- **Mockup Figma** (di DiNardo) — fonte di verità per la **UI**, da seguire quando costruiamo le schermate.
  File **pubblico** (accessibile a tutti): <https://www.figma.com/design/wKTJuVY5rC1KI6NBEGVxkj/Jingle-Machine?node-id=0-1>
  > Nota: l'attuale UI (login + editor) è una prima bozza funzionale; andrà allineata al mockup (Fase 5).

---

## 2. Stack & versioni

| Ambito        | Tecnologia            | Versione (al setup) |
|---------------|-----------------------|---------------------|
| Framework     | Angular (standalone, signals, zone.js) | 21.1 |
| UI kit        | ng-zorro-antd         | 21.3 |
| CSS utility   | Tailwind CSS (v4, via `@tailwindcss/postcss`) | 4.3 |
| Backend-as-a-service | Firebase JS SDK | 12.x |
| Audio         | @ffmpeg/ffmpeg + @ffmpeg/util (core **single-thread** 0.12.10) | 0.12.15 / 0.12.2 |
| Node / npm    | Node 24, npm 11       | — |

> ❗ **Non usiamo `@angular/fire`**: la sua ultima versione richiede ancora Angular ^20 e non supporta Angular 21. Usiamo l'SDK Firebase JS direttamente, incapsulato in piccoli service Angular (vedi `src/app/core`).

---

## 3. Setup iniziale (una volta sola)

### 3.1 Dipendenze
```bash
cd client
npm install
```

### 3.2 Configura Firebase  ✅ FATTO (progetto `jingle-machine-2026`)
Fatto il 2026-06-06: Authentication (**Email/Password** + **Google**), **Firestore** creato, **regole per-utente** ([`firebase/firestore.rules`](firebase/firestore.rules)) applicate, `firebaseConfig` in [`environment.ts`](client/src/environments/environment.ts).
> La config web Firebase NON è segreta (sta nel client; la sicurezza la fanno Auth + Security Rules).
> ❌ **Niente Firebase Storage**: i file MP3 stanno su **Cloudinary** (vedi §11). `firebase/storage.rules` è obsoleto.
> 🔐 Le password (mail, account Google/Firebase) stanno in **`CREDENZIALI.local.md`** (gitignored, mai committato).

### 3.3 Cloudinary  ✅ FATTO (cloud `dnpbzwccm`, preset `unsigned`)
Account creato (no carta) + **upload preset unsigned**; `cloudName` + `uploadPreset` in `environment.ts`.
Upload audio **validato** (resource_type=video → `secure_url`). Dettagli §11.

### 3.4 Domini autorizzati (login Google)
In **Authentication → Settings → Authorized domains**: `localhost` (già presente, vale anche per l'app standalone su `http://localhost:<port>`) e il dominio GitHub Pages (`<utente>.github.io`).

---

## 4. Comandi locali

> Tutti questi comandi vanno lanciati **dentro `client/`** (`cd client` prima).

```bash
npm start            # dev server su http://localhost:4200
npm run build        # build di produzione in client/dist/jingle-machine/browser
npm test             # unit test (vitest)

npm run start:all       # client (:4200) + Mixer (:4321) insieme (concurrently)
npm run start:all:mock  # come sopra ma client in MOCK (userless: niente Firebase/Cloudinary)
npm run start:mock      # solo client in mock
```

> **Modalità mock** (`environment.mock.ts`, config build `mock`): utente finto, libreria in memoria,
> upload finto via object URL. Serve a testare la UI **senza** Firebase/Cloudinary. L'estrazione YouTube resta reale (Mixer).

Generare codice con lo schematics (componenti standalone, **niente scss** → schematics `style: none`):
```bash
ng g component views/<vista>       # nuova pagina/vista
ng g component ui/<nome>           # componente riusabile (selettore ui-*)
ng g service core/<nome>           # nuovo service
```

---

## 5. Struttura dell'app Angular (`client/`)

```
client/src/
  environments/environment.ts     # config Firebase + Cloudinary + mixer.baseUrl (CONFIGURATI)
  environments/environment.mock.ts # override per la modalità mock (userless)
  styles/                          # stili globali (referenziati in angular.json):
    theme.less                     #   tema NgZorro (Less vars + dark base)
    styles.css                     #   entry Tailwind + classi helper jm-*
    ng-zorro.scss                  #   override dei componenti ng-zorro
  app/
    app.config.ts                  # provider: router, http, animazioni, NgZorro (i18n it_IT + CDN icons), Firebase
    app.routes.ts                  # /login (guest), / (authGuard → Library), /stylesheet (no guard)
    app.ts                         # shell: <router-outlet /> + heartbeat al Mixer (template inline)
    core/
      firebase.providers.ts        # initializeApp + token DI: AUTH, FIRESTORE (no STORAGE)
      auth.service.ts              # stato auth (signal) + login/registrazione/logout + scadenza sessione 24h
      auth.guard.ts                # authGuard (login + sessione non scaduta) + guestGuard
      cdn-icons.service.ts         # icone caricate da CDN (Ant Design + Material via namespace)
      cloudinary.service.ts        # upload audio (resource_type=video) e immagini su Cloudinary
      mixer.service.ts             # client del Mixer locale: /health, /info, /extract, /heartbeat
      library.service.ts           # CRUD jingle su Cloudinary + Firestore; libreria PRIVATA per uid
      ffmpeg.service.ts            # wrapper ffmpeg.wasm (taglio client-side, eredità Fase 0)
    ui/                            # componenti riusabili (selettore ui-*): button, color-picker, tag-input
    views/
      login/login.ts|html          # form login/registrazione + Google
      library/
        library.ts|html            # view principale: header + griglia jingle + ricerca (+ gate YouTube)
        jingle-item/               # card jingle: play/pause, progress bar, tags, edit/delete
        create-jingle-modal/       # modal crea jingle: audio (file o da YouTube) + immagine + nome + tags + colore
        edit-jingle-modal/         # modal modifica jingle
        youtube-import-modal/      # modal "Carica da Youtube": URL → taglio → extract
      stylesheet/stylesheet.ts|html  # pagina dev /stylesheet: demo dei componenti tematizzati
```

**Convenzioni**: componenti standalone, signals, niente NgModule. **Niente `.scss` per-componente** (Tailwind inline; override ng-zorro nello `.scss` globale). Componenti riusabili in `app/ui` (`ui-*`), pagine in `app/views`.
Firebase: `inject(AUTH | FIRESTORE)` — STORAGE rimosso, si usa Cloudinary.
**authGuard ATTIVO** in `app.routes.ts` (login obbligatorio, sessione 24h).

---

## 6. ffmpeg.wasm — note importanti

- Usiamo il **core single-thread** perché quello multi-thread richiede `SharedArrayBuffer`,
  che a sua volta richiede gli header **COOP/COEP** (cross-origin isolation) **non impostabili su GitHub Pages**.
  Single-thread è più lento ma funziona ovunque.
- `core` e **worker** vengono scaricati da **CDN (unpkg)** al primo taglio e messi in cache dal browser.
  Il worker è caricato via `classWorkerURL` per evitare problemi di bundling del worker con esbuild.
- ⚠️ Se aggiorni `@ffmpeg/ffmpeg`, il nome del file worker (`814.ffmpeg.js`) **può cambiare**:
  controlla `node_modules/@ffmpeg/ffmpeg/dist/umd/` e aggiorna `FFMPEG_BASE`/il nome file in
  [`ffmpeg.service.ts`](client/src/app/core/ffmpeg.service.ts). Aggiorna anche le versioni pinnate negli URL CDN.

---

## 7. Tailwind + NgZorro — note

- Gli stili globali stanno in **`client/src/styles/`** (referenziati in `angular.json`): `theme.less`, `styles.css`, `ng-zorro.scss`.
- Tailwind v4 si configura con [`.postcssrc.json`](client/.postcssrc.json) (`@tailwindcss/postcss`) e
  `@import "tailwindcss";` in `src/styles/styles.css` (con `@source '../';` perché il file è in una sottocartella). **Niente** `tailwind.config.js`.
- **NgZorro theming via Less**: `src/styles/theme.less` sovrascrive le variabili Less **prima** di
  `@import 'ng-zorro-antd/ng-zorro-antd.dark.less'` (Less lazy evaluation: va PRIMA dell'import).
  `stylePreprocessorOptions.includePaths: ["node_modules"]`. Gli **override dei componenti** ng-zorro stanno in `src/styles/ng-zorro.scss` (caricato per ultimo).
- **Icone**: caricate **dinamicamente da CDN** via `cdn-icons.service.ts` (Ant Design da jsDelivr + Material Icons via namespace `mi:`/`mi-outlined:`…). Le icone pre-registrate in `app.config.ts` restano istantanee; le altre si scaricano al volo → **non serve più registrarle a mano**.
- Locale impostato su **it_IT**.
- **Classi custom `jm-*`** in `src/styles/styles.css` (`jm-btn-*` via `ui-button`, `jm-card`, `jm-tag`, `jm-upload-area`, `jm-search-box`).

### Trappole NgZorro (imparate il 2026-05-30)
- `NzMessageService` è un **service**, non un modulo → **non va in `imports[]`** del componente; si inietta con `inject()`.
- `NgStyle` va importato esplicitamente nei componenti standalone (`import { NgStyle } from '@angular/common'`).
- Segnali con tipo `const tuple` troppo stretto (es. `JingleColor`): usare `signal<string>()` invece di `signal<JingleColor>()` per evitare errori TS2345.

---

## 8. YouTube → audio (ricerca + decisione, storico)

**Stato: IMPLEMENTATO (Fase 2)** tramite il Mixer locale (vedi §10/§12). Questa sezione resta come
**contesto e ricerca** che ha portato alla scelta. In breve: una pagina statica **non può** scaricare
l'audio di YouTube da sola (no CORS sugli stream, serve decodifica signature + IP non-browser) → serve
un componente locale (yt-dlp). Su **GitHub Pages la funzione è disattivata**; nell'**app standalone (Electron)** è attiva.

### Verdetto della ricerca (2026) — leggere prima di scegliere

Ricerca multi-fonte verificata (fonti in fondo alla sezione). Conclusioni chiave:

1. **Lo standard è Python + `yt-dlp`, non Node.** La libreria Node storica `@distube/ytdl-core` è
   **archiviata da ago 2025**. I wrapper Node (`youtube-dl-exec`, `ytdlp-nodejs`) **chiamano comunque
   yt-dlp** sotto (e `youtube-dl-exec` richiede anche Python3). → Node può solo *orchestrare* yt-dlp.
2. **Il fattore decisivo è l'IP, non il linguaggio.** I maintainer di yt-dlp dichiarano che gli IP dei
   **datacenter** sono soggetti al blocco `Sign in to confirm you're not a bot` e che **nemmeno un PO
   token valido** lo aggira in modo affidabile da lì ("We cannot help with this"). → Render/Fly/Koyeb/
   Cloud Run/Railway sono **strutturalmente fragili**.
3. **Cookie e PO token = mitigazioni probabilistiche, non garanzie.** yt-dlp può dare il blocco anche con i cookie.
4. **Rischio ban**: usare i cookie di un account Google **reale** rischia il ban → usare account
   **usa-e-getta**; i cookie **scadono in 3-5 giorni** (rinnovo periodico = manutenzione continua).
5. **Novità**: da yt-dlp **v2025.11.12** serve un **runtime JS esterno** (Deno raccomandato) per il pieno
   supporto YouTube; il PO token richiede un **provider separato** (`bgutil-ytdlp-pot-provider`).

➡️ **Scelta più robusta e gratuita per un principiante:** server **Python + yt-dlp (+ Deno + ffmpeg)**
sul **PC di casa**, esposto online con **Cloudflare Tunnel** (IP residenziale, quasi mai bloccato).
I free tier su datacenter restano una scommessa.

> ⚠️ Forte deperibilità: yt-dlp e l'enforcement YouTube cambiano ogni mese. Trattare il setup come
> manutenzione continua, non "installa e dimentica".

### Architettura consigliata quando lo faremo
- Server **minimale e stateless**. Endpoint:
  - `GET /info?url=...` → metadati del video (titolo, durata, autore, thumbnail) via yt-dlp `--dump-single-json`, **senza scaricare**.
  - `POST /extract { url, start?, end? }` → risponde con l'MP3.
- Il **taglio** può restare client-side (ffmpeg.wasm già pronto) oppure farlo server-side con ffmpeg nativo (più veloce).
- **Sicurezza**: il client invia l'ID token Firebase, il server lo verifica + rate limiting + CORS ristretto all'origine di Pages.
- Il client legge l'URL del server da un env var (`extractorUrl`); se assente, la feature YouTube resta nascosta (come ora).
- **Confezionamento**: Docker (yt-dlp + Deno + ffmpeg + il server) → gira identico in locale, su tunnel o su un host.

### ✅ Decisioni di implementazione del Mixer (Fase 1)
Scelte fatte con l'utente prima di scrivere il codice:

| Aspetto | Scelta | Perché |
|---|---|---|
| Motore HTTP | **Express** | standard, minimale, ottimo per imparare; bastano 2 endpoint |
| Binari (yt-dlp / ffmpeg / Deno) | **Download automatico al primo avvio** in una cartella del Mixer | comodo per i colleghi; si sposa con l'auto-update di yt-dlp. In Fase 1 sul PC dello sviluppatore si possono comunque installare a mano |
| Taglio audio | **Server-side con ffmpeg nativo** | più veloce; `/extract` riceve `start`/`end` e restituisce l'MP3 già pronto. NB: il taglio client-side (ffmpeg.wasm) **resta** per i file caricati a mano |

### ✅ Decisione finale (architettura definitiva)

Dopo analisi di costi/affidabilità (vedi storico decisioni sotto):

| Pezzo | Tecnologia scelta | Perché |
|---|---|---|
| Login | **Firebase Auth** (piano Spark, gratis, **no carta**) | già integrato |
| Metadati jingle | **Firebase Firestore** (Spark, gratis, **no carta**) | già integrato |
| **File MP3** | **Cloudinary** (free 25 crediti/mese, **no carta**) | Firebase Storage richiede Blaze+carta (**dal 3 feb 2026**); Cloudinary no |
| **Estrazione da YouTube** | **Mixer locale** Node + yt-dlp + ffmpeg, sul PC di chi carica | IP residenziale → niente blocchi YouTube; gratis |
| Webapp ↔ Mixer | **HTTP su `localhost`** | richiesta/risposta; l'MP3 va diretto Mixer→browser |

- **NIENTE Firebase Storage / NIENTE Blaze** → l'intero stack resta gratuito **senza carta**.
- Solo chi *estrae* da YouTube avvia il Mixer; chi *ascolta* usa solo la webapp.
- Su Cloudinary free, se si sfora la quota **l'account si sospende** (file inaccessibili) → **nessun addebito a sorpresa**.

> ⚠️ Impatto sul codice: la `LibraryService` attuale (scritta per Firebase Storage) va **riscritta per Cloudinary**.
> Le sezioni §3.2/§5/§6 e `firebase/storage.rules` che citano lo Storage sono **superate** da questa decisione.

### ⚠️ REQUISITO A VERBALE: ottimizzare il consumo di LETTURE (banda Cloudinary)

Su Cloudinary **anche le letture consumano** (1 credito = 1 GB di banda di delivery). In un'app "tutti
ascoltano" la **banda di lettura è la voce di consumo principale**, non lo storage. Quindi è un
**requisito di progetto**, non un optional, prevedere un'ottimizzazione seria delle riproduzioni:

1. **Cache HTTP del browser**: servire i file con header di cache lunghi → riascolti = 0 banda.
2. **Cache locale in IndexedDB**: i jingle già ascoltati restano nel browser → riascolti = 0 banda, anche tra sessioni.
3. **File piccoli**: jingle brevi, bitrate adeguato (no MP3 da 320k inutili per voci/jingle).
4. **Evitare ri-fetch inutili**: niente `?cache-bust`, niente ricarica della lista che riscarica gli audio; lazy-load dell'audio solo al play.
5. **Monitoraggio**: tenere d'occhio i crediti "banda" nella dashboard Cloudinary + alert quando ci si avvicina.

> Obiettivo: per un gruppo di colleghi restare **comodamente** entro i 25 crediti/mese, con margine.

### Fonti (ricerca 2026)
- yt-dlp #10128 (IP datacenter): <https://github.com/yt-dlp/yt-dlp/issues/10128>
- PO-Token Guide: <https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide>
- yt-dlp #15012 (runtime JS richiesto da v2025.11.12): <https://github.com/yt-dlp/yt-dlp/issues/15012>
- `@distube/ytdl-core` archiviata: <https://github.com/distubejs/ytdl-core>
- yt-dlp FAQ/Extractors (rischio ban + cookie): <https://github.com/yt-dlp/yt-dlp/wiki/FAQ>
- bgutil POT provider: <https://github.com/Brainicism/bgutil-ytdlp-pot-provider>

---

## 9. Deploy su GitHub Pages

Automatico via GitHub Actions ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)).

> 🎯 **Modello a due canali** (decisione 2026-06-05): GitHub Pages serve la webapp **senza** la funzione
> YouTube (nessun Mixer → il pulsante "Carica da Youtube" resta nascosto); l'**app standalone (Electron)**
> incorpora il Mixer e ha tutte le funzioni. Il backend cloud è lo stesso (Cloudinary + Firestore); le librerie sono **private per utente**.

> **Stato**: repo già creato e pushato → **https://github.com/ClemAnto/JingleMachine** (pubblico, account `ClemAnto`).
> ⚠️ Pages **non ancora abilitato**: finché non si fa il punto 2 qui sotto, lo step di deploy del workflow **fallisce**
> (la build invece passa). Lo abiliteremo nella Fase 6, quando l'app sarà pronta.

Una tantum:
1. Crea il repo su GitHub e fai push su `main`.  ✅ (fatto)
2. Repo → **Settings → Pages → Build and deployment → Source = GitHub Actions**.  ⬅️ ANCORA DA FARE
3. Ogni push su `main` builda e pubblica. Il workflow imposta `--base-href=/<nome-repo>/` e crea
   un `404.html` (fallback SPA per i deep-link).

> Se il login Google non funziona online, controlla i **domini autorizzati** in Firebase Auth (§3.4).

---

## 10. Mixer locale (`server/`) — IMPLEMENTATO (Fase 1)

Server Express 5 che gira sul PC di chi estrae. **Testato end-to-end il 2026-05-29** (info + extract su
video reale → MP3). Avvio/endpoint/comandi di test: vedi [`server/README.md`](server/README.md).

- **Avvio**: `cd server && yarn install && yarn start` → `http://127.0.0.1:4321` (mini pagina di test).
  > ⚠️ Il server usa **`yarn`**, non `npm`. Il client Angular usa `npm`. Non mescolare.
- **Endpoint**: `GET /health`, `GET /info?url=...`, `POST /extract {url,start?,end?}`, `GET /logs`.
- **Binari**: scaricati automaticamente al primo avvio in `server/bin/` (gitignored) e `yt-dlp` si auto-aggiorna (`-U`).
- **Taglio**: fatto da `yt-dlp --download-sections "*start-end" --force-keyframes-at-cuts` (usa ffmpeg sotto), bitrate 128k.
- **Mini pagina di test** (`server/public/index.html`): dark theme, testo in inglese. Flusso: inserisci URL → **Test** (recupera metadati + scarica MP3 completo in background) → slider doppio per il range → **▶ Preview** (seek istantaneo sul blob già scaricato, stop via `timeupdate`) → **Extract MP3** (scarica il solo range tagliato). Il pulsante Preview è disabilitato con label `(loading…)` finché il preload non è completato. `AbortController` annulla il preload se si preme Test di nuovo.

### Fatti verificati (2026-05-29, deperibili)
- yt-dlp **standalone single-binary** (no Python): asset `yt-dlp.exe` (Win), `yt-dlp_macos` (mac). Versione testata **2026.03.17**.
- **Deno** richiesto da yt-dlp per YouTube: testato **2.8.1** (zip per-OS da denoland/deno releases).
- ffmpeg/ffprobe static: **BtbN** (Win), **evermeet.cx** (mac). Express **5.2.x** stable.

### ⚠️ Trappole risolte (non riproporre)
- **Unzip**: NON usare il `tar` di sistema per gli `.zip` → il `tar` di **Git for Windows è GNU tar** e NON estrae zip
  (solo il `tar.exe` nativo di Windows lo fa). Usiamo la libreria **`adm-zip`** (cross-platform). Inoltre passare a `tar`
  un path Windows con `:` (drive) lo fa interpretare come host remoto.

### Ancora da fare (sicurezza Fase 1)
- Header **Local Network Access** per il preflight del browser (le origini CORS sono già ristrette).
- **Token di abbinamento** webapp↔Mixer (l'ascolto è già solo su `127.0.0.1`).

### Packaging — Fase 7: **Electron** (decisione 2026-06-05; sostituisce yao-pkg)

**Strumento**: **Electron + electron-builder** → finestra app pulita (no console), icona, esperienza "app vera".
Scelta motivata: vedi memoria `project-packaging-decision`. yao-pkg **rimosso**.

**Come funziona** (riuso del server, niente riscrittura):
- `electron-main.cjs` (main process, **CommonJS**) → avvia il server Express embedded (`src/server.js` → `startServer()`),
  poi apre una `BrowserWindow` su **`http://localhost:<port>`** (same-origin → no CORS; `localhost` è dominio
  Firebase autorizzato → login Google ok). Chiusura finestra → `app.quit()` → muore anche il server.

> ⚠️ **Bug Electron 33 + ESM (risolto 2026-06-06).** Electron 33 include Node 20.18, che ha un bug
> nel loader ESM (`cjsPreparseModuleExports`): **importare un modulo CJS via `import` crasha** la app
> all'avvio (anche `import { app } from "electron"`, perché `electron` è CJS). Sintomo: la finestra
> non si apre, il processo muore in ~2s, `%APPDATA%\JingleMachine` non viene nemmeno creata.
> **Fix**: il main process è **CommonJS** (`electron-main.cjs`) → `require("electron")` + `import()`
> dinamico dell'ESM `server.js`; e in `server.js`/`binaries.js` i CJS (`express`, `cors`, `adm-zip`)
> si caricano con **`createRequire(import.meta.url)`**, non con `import`. NB: `createRequire("electron")`
> NON funziona (risolve al pacchetto npm `electron`, cioè il path-shim, non all'API) → serve un main CJS.
> Node 22 (headless `yarn start`) non ha il bug: `createRequire` lì è solo innocuo.
- `src/index.js` resta l'entry **headless** (dev / `yarn start`) con prompt console.
- **Dati mutabili** (binari yt-dlp/ffmpeg/deno, tmp): in `app.getPath('userData')` (`%APPDATA%\JingleMachine`),
  passato al server via `process.env.JM_DATA_DIR` (la cartella dell'app è read-only). Disinstallare = rimuovere quella cartella.
- **Distribuzione**: Windows = **installer NSIS**; macOS = **dmg universal**. Config in `package.json` → `build`.

**Pipeline CI** (`.github/workflows/build-packages.yml`): matrix `windows-latest` + `macos-latest` →
Angular build (**senza `--base-href`**: default `/`) → copia dist in `server/app/` → `yarn install` →
`yarn dist --publish never` (electron-builder) → upload artifact (`jingle-machine-win` = .exe, `jingle-machine-mac` = .dmg).

> ✅ **CI verificata end-to-end (2026-06-06).** [Run #27059622842](https://github.com/ClemAnto/JingleMachine/actions/runs/27059622842):
> entrambi i leg verdi → **`Jingle Machine Setup 0.4.4.exe`** (~79 MB) + **`Jingle Machine-0.4.4-universal.dmg`** (~172 MB).

> ⚠️ **Trappole CI risolte (2026-06-06), non riproporre:**
> 1. **`--base-href /` NON va nella action**: sul runner Windows gira in **Git Bash**, che converte lo `/` in
>    `C:/Program Files/Git/` (path mangling MSYS). L'app Electron è servita dalla root → basta il default Angular `/` → **niente flag**.
> 2. **NON impostare `GH_TOKEN`** sullo step `yarn dist`: con il token presente electron-builder attiva un publish
>    provider GitHub e crasha generando i metadati di auto-update (*"Cannot read properties of null (reading 'provider')"*).
>    Noi distribuiamo via **artifact**, non Release → niente token + `--publish never`. Il download di Electron funziona lo stesso.

**Triggering build**: `gh workflow run build-packages.yml --ref <branch>` (manuale, `workflow_dispatch`) oppure **push di un tag** `v*`.
`gh` installato in `C:\Program Files\GitHub CLI\` — non nel PATH di default (aggiungerlo a `$env:PATH` nella sessione).

> ⚠️ La build Electron va eseguita in CI o su macchina con GUI (richiede download di Electron + toolchain NSIS).
> **macOS non firmato** → Gatekeeper: l'utente apre con "tasto destro → Apri" (notarizzazione Apple Dev $99/anno rimandata).

> ✅ **Build Windows verificata in locale (2026-06-06).** `npm run build -- --base-href=/` (con **PowerShell**:
> Git Bash mangia lo `/` → `--base-href C:/Program Files/Git/`!) → copia dist in `server/app/` → `yarn dist`.
> Prodotto `dist-electron/Jingle Machine Setup 0.4.4.exe` (~79 MB, NSIS). Smoke test su `win-unpacked`:
> server up, Angular servito (HTTP 200), binari scaricati in `%APPDATA%\JingleMachine\bin` → `/health ready=true`
> in ~27s (ytDlp 2026.03.17, ffmpeg, deno 2.8.2). Il **dmg macOS** ora si costruisce in CI (vedi sotto), ma **non è ancora stato eseguito** su un Mac reale.
> 🐞 *Robustezza nota (non bloccante)*: se un download binario viene interrotto, resta un file troncato che
> `ensureBinaries` non riscarica (controlla l'esistenza, non l'integrità) → `yt-dlp -U` poi fallisce con
> *"Could not load PyInstaller's embedded PKG archive"*. Workaround: cancellare `%APPDATA%\JingleMachine\bin`.

**Note ancora valide (da rispettare):**
- **SPA fallback `app.get("*")`** DOPO tutte le route API (in `src/server.js`), altrimenti torna `index.html` invece del JSON.
- **Campo `version` in `package.json`** va aggiornato esplicitamente nel file, non basta il messaggio di commit.
- **`config.js`** usa `__dirname` quando disponibile, `import.meta.url` in ESM nativo.
- ⚠️ **Rinominare il campo `name` in `server/package.json`** richiede un **`yarn install`** subito dopo, altrimenti
  `yarn start` fallisce con *"Package for jingle-machine-mixer@workspace:. not found"* (Yarn 4 tiene il nome workspace nel `yarn.lock`).

**Da sistemare (eredità yao-pkg)**: `scripts/download-release.js` riferisce ancora i vecchi
artefatti (`jingle-machine.exe/.dmg` + `version.txt`) → aggiornarlo ai nomi prodotti da electron-builder.

> 🗄️ *Storico yao-pkg (superato)*: bundle esbuild ESM→CJS, `--base-href /`, `lipo`+`hdiutil` per il dmg,
> `.yarnrc.yml nodeLinker: node-modules`, asset pkg da `package.json` → tutto **non più in uso** con Electron.

---

## 11. Cloudinary — setup e note (Fase 3 ✅ configurato 2026-06-06)

**Credenziali attive** (in `client/src/environments/environment.ts`, non segrete):
- `cloudinary.cloudName` = **`dnpbzwccm`**
- `cloudinary.uploadPreset` = **`unsigned`** (Signing mode: Unsigned)
- ✅ Upload audio **validato** via API: `POST .../dnpbzwccm/video/upload` con `upload_preset=unsigned` → `secure_url`.

**Come funziona l'upload client-side** (nessun backend necessario):
- Audio MP3: `POST https://api.cloudinary.com/v1_1/{cloudName}/video/upload` (Cloudinary tratta l'audio come "video")
- Immagine cover: `POST https://api.cloudinary.com/v1_1/{cloudName}/image/upload`
- `CloudinaryService.uploadAudio(blob, filename)` e `.uploadImage(file)` restituiscono `{ publicId, url, secureUrl }`.

**Eliminazione file**: con unsigned preset il delete client-side non è supportato. I file rimossi dalla libreria restano su Cloudinary. Per il delete reale serve un backend (o la dashboard Cloudinary). Da implementare in futuro se necessario.

**Firestore rules**: libreria **privata per utente** → `read/create/update/delete` solo se `resource.data.uid == request.auth.uid`. `LibraryService.list()` filtra `where('uid','==',uid)` (ordinamento lato client per evitare l'indice composito).

---

## 12. Flusso YouTube — IMPLEMENTATO (Fase 2)

Componente: `views/library/youtube-import-modal/`. Pulsante visibile solo se `/health` risponde.
1. **URL** input → `GET /info?url=...` del Mixer (titolo, durata, autore, thumbnail) → errore se non valido
2. Step **taglio**: anteprima metadati + **slider range** (`nz-slider` `nzRange`, start/end in s, label mm:ss)
3. **"Procedi"** → `POST /extract {url, start, end}` → riceve il **blob MP3**
4. Il blob viene passato alla **CreateJingleModal** (`openWithAudio`): nome prefillato dal titolo, audio già pronto
5. **"Crea"** → upload MP3 su **Cloudinary** + metadati su Firestore (upload solo alla conferma → non spreca crediti se si annulla)

> Possibili evoluzioni: anteprima audio/waveform prima dell'estrazione (non implementata).

---

## 13. Limiti noti / TODO

- [x] **Migrare lo storage file da Firebase Storage → Cloudinary** (✅ fatto il 2026-05-30)
- [x] **Mixer locale** Node + yt-dlp + ffmpeg con endpoint `/health`, `/info`, `/extract` (HTTP localhost). Vedi §10.
- [x] **Fase 2**: estrazione da YouTube via Mixer (✅ vedi §12).
- [x] **Libreria privata per utente** + **authGuard riabilitato** con sessione 24h (login giornaliero).
- [x] **Packaging → Electron** (sostituito yao-pkg); GitHub Pages senza YouTube. Vedi §10.
- [x] **Configurare Firebase + Cloudinary** in `environment.ts` (2026-06-06) + **flusso testato end-to-end** in locale.
- [ ] **REQUISITO: ottimizzazione consumo letture** (cache HTTP + IndexedDB + file piccoli + monitoraggio). Vedi §8. → **Fase 4 (prossima)**
- [ ] Verificare la **build Electron** in CI (primo run) + aggiornare `download-release.js`/`server/README.md` + icona app.
- [ ] Nessuna paginazione della libreria (ok per pochi elementi).
- [ ] (eredità) card jingle mostra ancora `uploaderEmail`, ora ridondante in libreria per-utente.

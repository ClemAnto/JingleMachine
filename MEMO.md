# MEMO — Jingle Machine

Guida operativa per lavorare in locale in modo veloce. Versionato su git apposta:
quando qualcosa cambia (versioni, decisioni architetturali, trucchi), **aggiorna questo file**.

---

## 1. Cos'è

Webapp **senza backend** che permette di:

1. Autenticarsi (Firebase Authentication: email/password + Google).
2. Caricare un file audio, ascoltarlo, **selezionare una porzione** e **tagliarla in MP3** — tutto nel browser con `ffmpeg.wasm`.
3. Salvare l'MP3 nella propria libreria (Firebase **Storage** per il file + **Firestore** per i metadati).

> ⚠️ Lo scarico diretto **da YouTube** NON è ancora implementato: non è fattibile senza un componente server. Vedi la sezione [§8 YouTube](#8-youtube--audio-il-nodo-da-sciogliere).

## Struttura del repo (monorepo "semplice")

Due cartelle sorelle, ognuna **indipendente** (proprio `package.json` e `node_modules`):

```
JingleMachine/
├── client/    # app Angular (la "sala": ciò che l'utente vede)
├── server/    # server Node per YouTube → audio (la "cucina") — IN ARRIVO
├── firebase/  # security rules (Firestore + Storage)
├── .github/   # workflow di deploy su GitHub Pages
├── MEMO.md · CLAUDE.md · README.md
```

> Regola d'oro: i comandi `npm ...` vanno lanciati **dentro la cartella giusta** (`client/` per l'app, `server/` per il server). Non c'è un `package.json` in radice.

> 📌 **Stato delle decisioni**: l'architettura definitiva è in **[§8 → "Decisione finale"](#-decisione-finale-architettura-definitiva)**.
> In sintesi: **Firebase Auth + Firestore** (gratis, no carta) · **Cloudinary** per i file MP3 (gratis, no carta) ·
> **helper locale** per estrarre da YouTube. ⚠️ Le parti di questo MEMO che citano **Firebase Storage** sono
> **superate** (lo Storage ora richiede Blaze+carta): saranno aggiornate quando implementeremo la migrazione a Cloudinary.

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

### 3.2 Configura Firebase
1. Crea un progetto su <https://console.firebase.google.com> (piano **Spark / free** va bene).
2. **Authentication** → abilita i provider **Email/Password** e **Google**.
3. **Firestore Database** → crea il database (modalità produzione).
4. **Storage** → crea il bucket.
5. Project Settings → *Le tue app* → app **Web** → copia l'oggetto `firebaseConfig`.
6. Incollalo in [`client/src/environments/environment.ts`](client/src/environments/environment.ts) (sostituendo i `TODO_*`).
   > Questi valori NON sono segreti: la config web Firebase è pensata per stare nel client. La sicurezza la fanno le Security Rules.
7. Copia le regole:
   - [`firebase/firestore.rules`](firebase/firestore.rules) → Console → Firestore → **Regole**.
   - [`firebase/storage.rules`](firebase/storage.rules) → Console → Storage → **Regole**.

### 3.3 CORS dello Storage (per riprodurre/scaricare i file)
`getDownloadURL` restituisce URL già accessibili dal browser, quindi di norma **non serve** toccare la CORS.
Se in futuro dovessi leggere i byte via `fetch` cross-origin, imposta la CORS del bucket con `gsutil`.

### 3.4 Domini autorizzati
In **Authentication → Settings → Authorized domains** aggiungi il dominio di GitHub Pages
(`<utente>.github.io`) e `localhost` (già presente) per far funzionare il login Google.

---

## 4. Comandi locali

> Tutti questi comandi vanno lanciati **dentro `client/`** (`cd client` prima).

```bash
npm start          # dev server su http://localhost:4200
npm run build      # build di produzione in client/dist/jingle-machine/browser
npm run watch      # build incrementale in sviluppo
npm test           # unit test (vitest)
```

Generare codice con lo schematics (componenti standalone + scss):
```bash
ng g component features/<nome>     # nuovo componente
ng g service core/<nome>           # nuovo service
```

---

## 5. Struttura dell'app Angular (`client/`)

```
client/src/
  environments/environment.ts     # config Firebase (placeholder da compilare)
  styles.css                       # entry Tailwind (@import "tailwindcss")
  app/
    app.config.ts                  # provider: router, animazioni, NgZorro (i18n it_IT + icone), Firebase
    app.routes.ts                  # /login (guest) e / (protetta da authGuard)
    app.ts / app.html              # shell: header con logout + <router-outlet>
    core/
      firebase.providers.ts        # initializeApp + token DI: AUTH, FIRESTORE, STORAGE
      auth.service.ts              # stato auth via signal + login/registrazione/logout
      auth.guard.ts                # authGuard (protegge) + guestGuard (solo non loggati)
      ffmpeg.service.ts            # wrapper ffmpeg.wasm: trimToMp3()
      library.service.ts          # upload Storage + CRUD metadati Firestore
    features/
      auth/login.ts|html           # form login/registrazione + Google
      editor/editor.ts|html        # upload -> selezione -> taglio MP3 -> download/salva + libreria
```

**Convenzioni**: componenti standalone, change detection con signals, niente NgModule.
I service Firebase si iniettano con `inject(AUTH | FIRESTORE | STORAGE)`.

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

- Tailwind v4 si configura con [`.postcssrc.json`](client/.postcssrc.json) (`@tailwindcss/postcss`) e
  `@import "tailwindcss";` in [`src/styles.css`](client/src/styles.css). **Niente** `tailwind.config.js` necessario.
- In [`angular.json`](client/angular.json) gli stili sono caricati in quest'ordine: **Tailwind prima**, **CSS di NgZorro dopo**,
  così il preflight di Tailwind non "resetta" i componenti Ant Design.
- Le **icone** di NgZorro sono tree-shakable: vanno registrate una per una in `app.config.ts`
  (array `icons`). Se usi una nuova icona nel template (`nzType="..."`), **aggiungila lì** o non comparirà.
- Locale impostato su **it_IT**.

---

## 8. YouTube → audio (il nodo da sciogliere)

**Stato: non implementato.** Una pagina statica su GitHub Pages **non può** scaricare l'audio di
YouTube da sola: YouTube non espone gli stream con header CORS e serve la decodifica delle signature
+ un IP non-browser → tutto lato server. Con piano Firebase **free** non abbiamo Cloud Functions.

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

### ✅ Decisioni di implementazione dell'helper (Fase 1)
Scelte fatte con l'utente prima di scrivere il codice:

| Aspetto | Scelta | Perché |
|---|---|---|
| Motore HTTP | **Express** | standard, minimale, ottimo per imparare; bastano 2 endpoint |
| Binari (yt-dlp / ffmpeg / Deno) | **Download automatico al primo avvio** in una cartella dell'helper | comodo per i colleghi; si sposa con l'auto-update di yt-dlp. In Fase 1 sul PC dello sviluppatore si possono comunque installare a mano |
| Taglio audio | **Server-side con ffmpeg nativo** | più veloce; `/extract` riceve `start`/`end` e restituisce l'MP3 già pronto. NB: il taglio client-side (ffmpeg.wasm) **resta** per i file caricati a mano |

### ✅ Decisione finale (architettura definitiva)

Dopo analisi di costi/affidabilità (vedi storico decisioni sotto):

| Pezzo | Tecnologia scelta | Perché |
|---|---|---|
| Login | **Firebase Auth** (piano Spark, gratis, **no carta**) | già integrato |
| Metadati jingle | **Firebase Firestore** (Spark, gratis, **no carta**) | già integrato |
| **File MP3 (condivisi)** | **Cloudinary** (free 25 crediti/mese, **no carta**) | Firebase Storage richiede Blaze+carta (**dal 3 feb 2026**); Cloudinary no |
| **Estrazione da YouTube** | **Helper locale** Node + yt-dlp + ffmpeg, sul PC di chi carica | IP residenziale → niente blocchi YouTube; gratis |
| Webapp ↔ helper | **HTTP su `localhost`** | richiesta/risposta; l'MP3 va diretto helper→browser |

- **NIENTE Firebase Storage / NIENTE Blaze** → l'intero stack resta gratuito **senza carta**.
- Solo chi *estrae* da YouTube avvia l'helper; chi *ascolta* usa solo la webapp.
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

## 10. Helper locale (`server/`) — IMPLEMENTATO (Fase 1)

Server Express 5 che gira sul PC di chi estrae. **Testato end-to-end il 2026-05-29** (info + extract su
video reale → MP3). Avvio/endpoint/comandi di test: vedi [`server/README.md`](server/README.md).

- **Avvio**: `cd server && npm install && npm start` → `http://127.0.0.1:4321` (mini pagina di test con textbox log).
- **Endpoint**: `GET /health`, `GET /info?url=...`, `POST /extract {url,start?,end?}`, `GET /logs`.
- **Binari**: scaricati automaticamente al primo avvio in `server/bin/` (gitignored) e `yt-dlp` si auto-aggiorna (`-U`).
- **Taglio**: fatto da `yt-dlp --download-sections "*start-end" --force-keyframes-at-cuts` (usa ffmpeg sotto), bitrate 128k.

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
- **Token di abbinamento** webapp↔helper (l'ascolto è già solo su `127.0.0.1`).

---

## 11. Limiti noti / TODO

- [ ] **Migrare lo storage file da Firebase Storage → Cloudinary** (riscrivere `LibraryService`; rimuovere `firebase/storage.rules`). Vedi §8.
- [x] **Helper locale** Node + yt-dlp + ffmpeg con endpoint `/health`, `/info`, `/extract` (HTTP localhost). Vedi §10.
- [ ] **REQUISITO: ottimizzazione consumo letture** (cache HTTP + IndexedDB + file piccoli + monitoraggio). Vedi §8.
- [ ] Scarico da YouTube via helper (vedi §8).
- [ ] Taglio molto preciso al millisecondo: lo slider ha step 0.1s.
- [ ] Nessuna paginazione della libreria (ok per pochi elementi).
- [ ] ffmpeg single-thread: file lunghi sono lenti (limite di GitHub Pages, vedi §6).

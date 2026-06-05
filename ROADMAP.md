# 🗺️ Roadmap — Jingle Machine

Piano di lavoro dal progetto attuale al prodotto finito. Le decisioni architetturali e i "perché"
sono in [`MEMO.md`](MEMO.md) §8. Spunta gli item man mano (`[ ]` → `[x]`).

---

## 🎯 Visione

App per gestire una **libreria di jingle PRIVATA per utente**: ognuno logga col proprio account e vede
**solo i propri** jingle (due utenti → librerie diverse), caricati da file o **estratti da YouTube**.
Stack **100% gratuito e senza carta di credito**.

**Due canali di distribuzione** (decisione 2026-06-05):
- **App desktop standalone (Electron)** → incorpora il server locale, **tutte le funzioni attive** (incluso YouTube).
- **GitHub Pages** → stessa webapp online ma **senza YouTube** (nessun helper): login + libreria + upload file.

**Design:** la UI segue il **mockup Figma** di DiNardo → <https://www.figma.com/design/wKTJuVY5rC1KI6NBEGVxkj/Jingle-Machine?node-id=0-1>

**Architettura:**
- **Firebase Auth** → login obbligatorio (sessione 24h) · **Firestore** → metadati (privati per `uid`)
- **Cloudinary** → file MP3 (storage remoto, free, no carta)
- **Helper locale** (Node + yt-dlp + ffmpeg) → estrazione YouTube; **embedded in Electron**, separato in dev (`localhost:4321`)

---

## ✅ Fase 0 — Fondamenta (FATTO)

- [x] Scaffold Angular 21 (standalone + signals) in `client/`
- [x] UI: NgZorro 21 + Tailwind v4 (locale `it_IT`)
- [x] Login Firebase Auth (email/password + Google) + route guard
- [x] Editor: upload file audio → selezione intervallo → taglio MP3 in-browser (ffmpeg.wasm) → download
- [x] Salvataggio metadati su Firestore (versione iniziale)
- [x] Struttura monorepo `client/` + `server/`
- [x] Deploy GitHub Pages (GitHub Actions) configurato
- [x] Ricerca e decisioni su YouTube/hosting/storage (vedi `MEMO.md` §8)

---

## 🔌 Fase 1 — Helper locale (`server/`)  ✅ QUASI COMPLETA (mancano i 2 punti di sicurezza)

> Piccola app sul PC di chi vuole estrarre da YouTube. Obiettivo della fase: **provarlo subito in locale**.

> Decisioni prese (vedi `MEMO.md` §8 "Decisioni di implementazione dell'helper"):
> **Express** · binari **scaricati automaticamente al primo avvio** · **taglio server-side con ffmpeg nativo**.

- [x] Inizializzare progetto Node in `server/`
- [x] Server Express minimo con endpoint `GET /health` → **primo test nel browser**
- [x] Endpoint `GET /info?url=...` → yt-dlp `--dump-single-json` → metadati del video (titolo, durata, autore, thumbnail), **senza scaricare**
- [x] Endpoint `POST /extract { url, start, end }` → yt-dlp scarica audio, **ffmpeg taglia + converte in MP3 server-side** → restituisce MP3
- [x] **Provarlo a mano** (testato con curl: info + extract 10-20s su video reale → MP3 128k OK)
- [x] **Download automatico dei binari al primo avvio**: **yt-dlp** + **ffmpeg** (+ **Deno**, richiesto da yt-dlp per YouTube)
- [x] **Auto-aggiornamento di yt-dlp** (così non si rompe a ogni cambio di YouTube)
- [x] **Mini interfaccia di test** servita dall'helper (`/`) con form per i 3 endpoint + textbox dei log (`/logs`)
- [ ] **CORS**: origini ristrette già impostate; manca l'header **Local Network Access** (preflight)
- [ ] **Sicurezza**: ascolto solo su `127.0.0.1` ✅ fatto; manca il **token di abbinamento**

> In questa fase l'helper gira come **script Node** (`npm start`) → multipiattaforma, zero grane.
> L'impacchettamento in **eseguibile Win + Mac** è uno step a sé → **Fase 7** (obbligatorio per il prodotto finale).

---

## 🔗 Fase 2 — Integrazione webapp ↔ helper  ✅ FATTA

> Componente `youtube-import-modal`. Pulsante "Carica da Youtube" visibile solo se `/health` risponde.

- [x] Pulsante "Carica da Youtube" gated su `/health` (nascosto su GitHub Pages)
- [x] Modal: incolla URL → `/info` (titolo/durata/autore/thumbnail)
- [x] Step taglio: slider range (start/end) → **Procedi** → `POST /extract` → blob MP3
- [x] Blob passato alla CreateJingleModal (`openWithAudio`, nome prefillato) → **Crea** = upload Cloudinary
- [x] Lifecycle helper: heartbeat 60s + auto-shutdown 150s (kill on close); refresh-safe
- [ ] (opz.) Anteprima audio/waveform prima dell'estrazione

---

## 📦 Fase 3 — Storage su Cloudinary ✅ INFRASTRUTTURA PRONTA

> Far atterrare gli MP3 estratti nella libreria (privata per utente). Sostituisce Firebase Storage (richiede Blaze+carta).

- [ ] Creare account Cloudinary (no carta) e cloud name → ottenere `cloudName` + upload preset unsigned
- [ ] Inserire le credenziali Cloudinary in `client/src/environments/environment.ts`
- [x] `CloudinaryService`: upload audio (resource_type=video) e immagini → `uploadAudio()` / `uploadImage()`
- [x] Riscrivere `LibraryService`: nuovo modello `Jingle` (color, tags, imageUrl, uploaderEmail), upload su Cloudinary
- [x] **Libreria PRIVATA per utente** (decisione 2026-06-05): query Firestore con filtro `uid` → ognuno vede solo i suoi jingle
- [x] **Firestore security rules** per-utente: `read/write` solo se `resource.data.uid == request.auth.uid`
- [x] Rimuovere Firebase Storage (STORAGE token, `firebase/storage.rules`)
- [ ] Collegare l'estrazione YouTube (Fase 2): MP3 estratto → upload su Cloudinary + metadati Firestore
- [x] Mostrare l'autore di ogni jingle nella card (`uploaderEmail`)

---

## ⚡ Fase 4 — Ottimizzazione consumo letture (REQUISITO)

> Su Cloudinary anche gli ascolti consumano banda → requisito di progetto, non opzionale.

- [ ] Servire i file con **cache HTTP lunga** (delivery Cloudinary via CDN)
- [ ] **Cache locale in IndexedDB**: i jingle ascoltati restano nel browser → riascolti = 0 banda
- [ ] **Lazy-load**: scaricare l'audio solo al play, non al caricamento della lista
- [ ] File piccoli: bitrate adeguato in fase di taglio (no 320k inutili)
- [ ] Monitoraggio crediti Cloudinary (dashboard + promemoria soglia)

---

## 🔒 Fase 5 — Sicurezza & rifiniture

- [x] **UI allineata al mockup Figma**: tema NgZorro Less (dark teal), Library view, JingleItem card, CreateModal, EditModal
- [x] Verifica finale Firestore security rules (libreria privata per utente) ✅
- [ ] Allineare la UI al mockup Figma aggiornato da DiNardo (tags visibili su card, mockup YouTube)
- [ ] Gestione errori chiara (helper offline, blocco YouTube, quota Cloudinary)
- [ ] Stati di caricamento / feedback UX
- [ ] Pagina `/stylesheet` — aggiornare quando il mockup include i tags

---

## 🚀 Fase 6 — Deploy & verifica end-to-end

- [ ] Domini autorizzati in Firebase Auth (`<utente>.github.io`)
- [ ] Deploy webapp su GitHub Pages
- [ ] Test completo (standalone): login → estrai da YouTube → salva → ricompare nella propria libreria
- [ ] Test GitHub Pages: login + libreria + upload file (YouTube nascosto, nessun helper)
- [ ] Mini-istruzioni per i colleghi: scaricare/installare l'**app standalone** (l'helper è incluso)

---

## 📦 Fase 7 — App desktop standalone (**Electron**) — Win + Mac

> Prodotto finale: i colleghi scaricano un installer e fanno doppio clic → **finestra app pulita** (no console).

**Architettura**: **Electron** avvia il server Express embedded e apre una `BrowserWindow` su
`http://localhost:<port>` (same-origin → no CORS; `localhost` autorizzato per il login Google).
Chiusura finestra → `app.quit()` → server giù. Libreria su Cloudinary + Firestore.
Motivazioni in `MEMO.md` §10 e memoria `project-packaging-decision`.

- [x] Scelto **Electron + electron-builder** (sostituisce yao-pkg) — finestra vera, no console
- [x] `electron-main.js`: avvia `startServer()` + `BrowserWindow` su localhost + single-instance + no menu
- [x] Refactor server: `src/server.js` (`startServer`) riusato da headless (`index.js`) e da Electron
- [x] `config.js`: dati mutabili in `%APPDATA%\JingleMachine` via `JM_DATA_DIR` (la cartella app è read-only)
- [x] `package.json`: `build` electron-builder → **NSIS** (Win) + **dmg universal** (mac); rimossa sezione `pkg`
- [x] CI `build-packages.yml`: matrix windows/macos → `yarn dist`
- [ ] **Verificare il primo build Electron in CI** (download Electron/NSIS; non testabile in locale headless)
- [ ] Aggiornare `scripts/download-release.js` + `server/README.md` ai nuovi artefatti electron-builder
- [ ] Icona app (`build/icon.*`) — ora icona Electron di default
- [ ] **Windows**: SmartScreen → "Esegui comunque" (firma opzionale, a pagamento)
- [ ] **macOS**: Gatekeeper → "tasto destro → Apri" (notarizzazione = Apple Dev $99/anno → rimandata)
- [ ] (Opz.) Tray icon / auto-update — fuori scope

> 🗄️ La precedente implementazione **yao-pkg (v0.1.10)** è stata sostituita; le sue note restano come storico in `MEMO.md` §10.

---

## 🔭 Eventuali evoluzioni future (NON ora)

- [ ] "Sempre online" senza PC acceso → server + **proxy residenziale** a pagamento (pochi €/mese) o **PC + Cloudflare Tunnel**
- [ ] Mitigazioni anti-blocco YouTube se necessario: **cookie** (account usa-e-getta) o **PO token** (`bgutil-ytdlp-pot-provider`)
- [ ] Supporto anche **Linux** per l'helper
- [ ] Paginazione / ricerca nella libreria se cresce molto

---

## 👉 Dove eravamo / Prossimo passo

**Stato (sessione 2026-06-05):**
- **Fase 2 FATTA**: pipeline YouTube completa (modal URL → taglio → extract → create prefillata) + lifecycle helper.
- **Libreria PER-UTENTE** + **authGuard riabilitato** (sessione 24h). Supera la vecchia "libreria condivisa".
- **Refactor UI**: `app/views` + `app/ui` (`ui-*`), niente `.scss` per-componente, stili in `src/styles/`, icone via CDN.
- **Packaging → Electron** (sostituisce yao-pkg): NSIS + dmg; GitHub Pages senza YouTube. **Build CI da verificare** (primo run).
- **UI Library** (Fase 5 parziale) + pagina `/stylesheet` ok.
- ⚠️ Restano: configurare **Cloudinary** (serve per salvare i jingle); verificare build Electron in CI.

**Prossimo passo — opzioni:**
1. **Configurare Cloudinary** (`cloudName` + unsigned preset in `environment.ts`) → testare upload end-to-end in locale.
2. **Verificare la build Electron in CI** (tag/`yarn release`) + aggiornare `download-release.js`/`server/README.md`.
3. **Fase 4**: ottimizzazione letture Cloudinary (cache HTTP + IndexedDB) — anche via PWA.

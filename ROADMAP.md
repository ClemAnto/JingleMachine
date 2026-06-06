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
- **GitHub Pages** → stessa webapp online ma **senza YouTube** (nessun Mixer): login + libreria + upload file.

**Design:** la UI segue il **mockup Figma** di DiNardo → <https://www.figma.com/design/wKTJuVY5rC1KI6NBEGVxkj/Jingle-Machine?node-id=0-1>

**Architettura:**
- **Firebase Auth** → login obbligatorio (sessione 24h) · **Firestore** → metadati (privati per `uid`)
- **Cloudinary** → file MP3 (storage remoto, free, no carta)
- **Mixer locale** (Node + yt-dlp + ffmpeg) → estrazione YouTube; **embedded in Electron**, separato in dev (`localhost:4321`)

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

## 🔌 Fase 1 — Mixer locale (`server/`)  ✅ QUASI COMPLETA (mancano i 2 punti di sicurezza)

> Piccola app sul PC di chi vuole estrarre da YouTube. Obiettivo della fase: **provarlo subito in locale**.

> Decisioni prese (vedi `MEMO.md` §8 "Decisioni di implementazione del Mixer"):
> **Express** · binari **scaricati automaticamente al primo avvio** · **taglio server-side con ffmpeg nativo**.

- [x] Inizializzare progetto Node in `server/`
- [x] Server Express minimo con endpoint `GET /health` → **primo test nel browser**
- [x] Endpoint `GET /info?url=...` → yt-dlp `--dump-single-json` → metadati del video (titolo, durata, autore, thumbnail), **senza scaricare**
- [x] Endpoint `POST /extract { url, start, end }` → yt-dlp scarica audio, **ffmpeg taglia + converte in MP3 server-side** → restituisce MP3
- [x] **Provarlo a mano** (testato con curl: info + extract 10-20s su video reale → MP3 128k OK)
- [x] **Download automatico dei binari al primo avvio**: **yt-dlp** + **ffmpeg** (+ **Deno**, richiesto da yt-dlp per YouTube)
- [x] **Auto-aggiornamento di yt-dlp** (così non si rompe a ogni cambio di YouTube)
- [x] **Mini interfaccia di test** servita dal Mixer (`/mixer`) con form per i 3 endpoint + textbox dei log (`/logs`)
- [ ] **CORS**: origini ristrette già impostate; manca l'header **Local Network Access** (preflight)
- [ ] **Sicurezza**: ascolto solo su `127.0.0.1` ✅ fatto; manca il **token di abbinamento**

> In questa fase il Mixer gira come **script Node** (`yarn start`) → multipiattaforma, zero grane.
> L'impacchettamento in **eseguibile Win + Mac** è uno step a sé → **Fase 7** (obbligatorio per il prodotto finale).

---

## 🔗 Fase 2 — Integrazione webapp ↔ Mixer  ✅ FATTA

> Componente `youtube-import-modal`. Pulsante "Carica da Youtube" visibile solo se `/health` risponde.

- [x] Pulsante "Carica da Youtube" gated su `/health` (nascosto su GitHub Pages)
- [x] Modal: incolla URL → `/info` (titolo/durata/autore/thumbnail)
- [x] Step taglio: slider range (start/end) → **Procedi** → `POST /extract` → blob MP3
- [x] Blob passato alla CreateJingleModal (`openWithAudio`, nome prefillato) → **Crea** = upload Cloudinary
- [x] Lifecycle Mixer: heartbeat 60s + auto-shutdown 150s (kill on close); refresh-safe
- [x] **Anteprima istantanea**: full audio precaricato all'apertura del taglio → play/pause + seek senza ri-estrazione (stop a fine intervallo)
- [x] **Testato end-to-end in locale** (2026-06-06): login → estrai → taglio/anteprima → crea → riproduci ✅

---

## 📦 Fase 3 — Storage su Cloudinary ✅ FATTA (configurato + testato)

> Far atterrare gli MP3 estratti nella libreria (privata per utente). Sostituisce Firebase Storage (richiede Blaze+carta).

- [x] Creare account Cloudinary (no carta) + upload preset unsigned → **cloud `dnpbzwccm`, preset `unsigned`**
- [x] Inserire le credenziali Cloudinary in `client/src/environments/environment.ts`
- [x] `CloudinaryService`: upload audio (resource_type=video) e immagini → `uploadAudio()` / `uploadImage()`
- [x] Riscrivere `LibraryService`: nuovo modello `Jingle` (color, tags, imageUrl, uploaderEmail), upload su Cloudinary
- [x] **Libreria PRIVATA per utente** (decisione 2026-06-05): query Firestore con filtro `uid` → ognuno vede solo i suoi jingle
- [x] **Firestore security rules** per-utente: `read/write` solo se `resource.data.uid == request.auth.uid`
- [x] Rimuovere Firebase Storage (STORAGE token, `firebase/storage.rules`)
- [x] Collegare l'estrazione YouTube (Fase 2): MP3 estratto → upload su Cloudinary + metadati Firestore
- [x] Upload unsigned **validato** via API (2026-06-06): `video/upload` accetta l'MP3 → `secure_url` ✅
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
- [ ] Gestione errori chiara (Mixer offline, blocco YouTube, quota Cloudinary)
- [ ] Stati di caricamento / feedback UX
- [ ] Pagina `/stylesheet` — aggiornare quando il mockup include i tags

---

## 🚀 Fase 6 — Deploy & verifica end-to-end

- [ ] Domini autorizzati in Firebase Auth (`<utente>.github.io`)
- [ ] Deploy webapp su GitHub Pages
- [ ] Test completo (standalone): login → estrai da YouTube → salva → ricompare nella propria libreria
- [ ] Test GitHub Pages: login + libreria + upload file (YouTube nascosto, nessun Mixer)
- [ ] Mini-istruzioni per i colleghi: scaricare/installare l'**app standalone** (il Mixer è incluso)

---

## 📦 Fase 7 — App desktop standalone (**Electron**) — Win + Mac

> Prodotto finale: i colleghi scaricano un installer e fanno doppio clic → **finestra app pulita** (no console).

**Architettura**: **Electron** avvia il server Express embedded e apre una `BrowserWindow` su
`http://localhost:<port>` (same-origin → no CORS; `localhost` autorizzato per il login Google).
Chiusura finestra → `app.quit()` → server giù. Libreria su Cloudinary + Firestore.
Motivazioni in `MEMO.md` §10 e memoria `project-packaging-decision`.

- [x] Scelto **Electron + electron-builder** (sostituisce yao-pkg) — finestra vera, no console
- [x] `electron-main.cjs` (CommonJS): avvia `startServer()` + `BrowserWindow` su localhost + single-instance + no menu
- [x] Refactor server: `src/server.js` (`startServer`) riusato da headless (`index.js`) e da Electron
- [x] `config.js`: dati mutabili in `%APPDATA%\JingleMachine` via `JM_DATA_DIR` (la cartella app è read-only)
- [x] `package.json`: `build` electron-builder → **NSIS** (Win) + **dmg universal** (mac); rimossa sezione `pkg`
- [x] CI `build-packages.yml`: matrix windows/macos → `yarn dist`
- [x] **Primo build Windows verificato in LOCALE** (2026-06-06): installer NSIS `Jingle Machine Setup 0.4.4.exe` (~79 MB), app avviata, server up, binari scaricati, `/health ready=true`. Risolto bug ESM/CJS di Electron 33 (main → `.cjs` + `createRequire`); vedi `MEMO.md` §10.
- [ ] **Verificare il primo build in CI** (matrix Win+Mac via tag/`yarn release`) — il **dmg macOS** è ancora non testato
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
- [ ] Supporto anche **Linux** per il Mixer
- [ ] Paginazione / ricerca nella libreria se cresce molto

---

## 👉 Dove eravamo / Prossimo passo

**Stato (sessione 2026-06-06):**
- **Fasi 0–3 FATTE.** Flusso **testato end-to-end in locale** (dev): login Firebase reale → "Carica da Youtube" → taglio + anteprima istantanea → Crea → upload Cloudinary + Firestore → libreria per-utente. ✅
- **Firebase** (`jingle-machine-2026`) + **Cloudinary** (`dnpbzwccm` / preset `unsigned`) **configurati** in `environment.ts` (console Firebase già impostata: Email/Password + Google + Firestore + rules).
- **Libreria PER-UTENTE** + **authGuard** (sessione 24h) · **Refactor UI** (`app/views` + `app/ui`, Tailwind inline, icone CDN) · **rename → Mixer** completo.
- **Modalità mock** userless (`npm run start:all:mock`) + script `npm run start:all` (client + Mixer) per i test.
- **Packaging → Electron** scaffoldato (NSIS + dmg). Credenziali locali in `CREDENZIALI.local.md` (gitignored).

**Prossimo passo — opzioni:**
1. **Fase 4**: ottimizzazione letture Cloudinary (cache HTTP + IndexedDB + lazy-load) — anche via **PWA**.
2. **Verificare la build Electron in CI** (tag/`yarn release`) + aggiornare `download-release.js`/`server/README.md` + icona app.
3. **Chiudere Fase 1** (Local Network Access + token) e **Fase 6** (deploy GitHub Pages + domini autorizzati).

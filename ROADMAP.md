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
- **Firebase Auth** → login obbligatorio (sessione 7 giorni) · **Firestore** → metadati (privati per `uid`)
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
- [x] **🎨 Sistema di tema a token CSS (multi-tema)** ✅ — architettura e dettagli in [`THEMING.md`](THEMING.md):
  - [x] Ordine cascade layer in `styles.css` (`theme,base,ngzorro,components,utilities`) + ng-zorro **precompilato** in `@layer ngzorro`
  - [x] `themes/default.scss`: `@theme static { --color-*, --radius-*, --font-sans }` → utility native (`bg-primary`, `rounded-xl`)
  - [x] `tokens.css`: token strutturali in `@layer base` (z-index `--z-*`, `--control-height`, body, focus)
  - [x] `ng-zorro.scss` in `@layer components`: hex→`var(--color-*)`, `fade()`→`color-mix()`, **zero `!important`**
  - [x] **Eliminato `theme.less`** (brand → `@theme`; base ng-zorro = CSS precompilato)
  - [x] Eliminate tutte le classi `.jm-*` → utility-da-token / `ui-button` / `.ant-*`
  - [x] Template ripuliti dai valori letterali (hex, `rounded-[…]`); valori tarati sull'**SVG del mockup**
  - [x] `/stylesheet` aggiornata (varianti reali, swatch `on-*`, `nzSize`) + **contrasto WCAG verificato**
  - [ ] (Opz. futuro) selezione tema **runtime** (`ThemeService` + `:root[data-theme]` + localStorage)
- [x] **Responsive** (mobile-first Tailwind, host `display:block`, bottoni icon-only su mobile, modali `max-w`) ✅
- [x] **Motion** (micro-animazioni CSS + transizione di route `route-enter`; `@angular/animations` deprecato → solo CSS; `prefers-reduced-motion`) ✅
- [x] **Anteprima immagine** alla selezione (create/edit) + **search nascosta** sotto i 2 jingle ✅
- [x] **Modale "Carica da Youtube" allineata al mockup** (2026-06-07): nuovo `ui-trim-slider` (taglio ai decimi, drag fluido fuori-zone), box anteprima + bottoni `rounded-lg` come da `Modal.svg`; integrata nella `youtube-import-modal` reale + sezione in `/stylesheet`. Vedi `MEMO.md` §7.
- [ ] Allineare il resto della UI al mockup Figma aggiornato da DiNardo (tags visibili su card)
- [ ] Gestione errori chiara (Mixer offline, blocco YouTube, quota Cloudinary)
- [ ] Stati di caricamento / feedback UX
- [ ] Pagina `/stylesheet` — aggiornare quando il mockup include i tags

---

## 🚀 Fase 6 — Deploy & verifica end-to-end

- [x] **Deploy webapp su GitHub Pages** ✅ LIVE: https://clemanto.github.io/JingleMachine/ (Pages abilitato via `gh api … -f build_type=workflow`; redeploy automatico a ogni push su `main`)
- [ ] **Domini autorizzati in Firebase Auth**: aggiungere `clemanto.github.io` (Console → Auth → Settings) → **serve perché il login Google funzioni su Pages** (ora KO online; username/password ok)
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
- [x] **Build CI verificata (2026-06-06)**: matrix Win+Mac verde → artifact `jingle-machine-win` (.exe ~79 MB) + `jingle-machine-mac` (.dmg universal ~172 MB). Trappole CI risolte (`--base-href`, `GH_TOKEN`) in `MEMO.md` §10.
- [ ] **Eseguire il dmg su un Mac reale** (build OK in CI, ma mai avviato su macOS) — verificare Gatekeeper + download binari (yt-dlp_macos/ffmpeg/deno)
- [x] Script di download riscritto → `npm run download` in radice (`scripts/download-packages.mjs`). Resta: aggiornare `server/README.md`
- [x] **Check aggiornamenti in-app** (2026-06-10, v0.9.0): installer pubblicati su **GitHub Releases** al tag `v*` (link pubblico, niente login) + banner nella Library quando esce una versione più nuova (vedi `MEMO.md` §10)
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
- **Packaging → Electron: PRIMA VERSIONE FUNZIONANTE.** Risolto il bug ESM/CJS di Electron 33 (main → `electron-main.cjs` + `createRequire`); **build CI verificata** (Win + Mac, [run #27059622842](https://github.com/ClemAnto/JingleMachine/actions/runs/27059622842)) → installer `.exe` (~79 MB) e `.dmg` universal (~172 MB). Scaricabili con **`npm run download`** (root). Dettagli e trappole CI in `MEMO.md` §10. Credenziali locali in `CREDENZIALI.local.md` (gitignored).

**Aggiornamento (sessione 2026-06-07, v0.7.0):** creato **`ui-trim-slider`** (video-trimmer dual-handle: CSS-var driven, drag fuori-zone, taglio ai **decimi** via `[step]=0.1`) → sostituisce `nz-slider` nella `youtube-import-modal` + sezione "Carica da Youtube" nello `/stylesheet`. **`ui-button` → `rounded-lg`** (come il mockup; tolto il pill). Tutto allineato a `Modal.svg`. Committato e pubblicato su GitHub Pages.

**Aggiornamento (sessione 2026-06-30):**
- **Login settimanale**: sessione 24h → **7 giorni** (`SESSION_MAX_AGE_MS` in `auth.service.ts`); doc allineata.
- **Azioni della card** spostate in un **menu kebab** (3 puntini, alto-dx) con **Modifica** + **Programma** (`scheduleRequest`); tolto il cestino e le icone inline. L'**eliminazione** ora è dentro il pannello di Modifica (pulsante "Elimina" variante `alert` + conferma).
- **Nuova feature "Programma"** (`schedule-jingle-modal`): wired in `library.ts` (`openSchedule`) — **da rifinire/testare end-to-end**.
- Polish: footer modale allineato a 24px, gap modale uniformati, **scrollbar a tema** (teal). Dettagli tecnici in `MEMO.md` §7.
- ✅ Pendenze del 2026-06-30 **risolte** in v0.10.0: icone `more`/`clock-circle`/`reload` **registrate** in `app.config.ts`; la programmazione **persiste** (Firestore, collezione `schedules`).

**Aggiornamento (sessione 2026-07-01, v0.10.0) — Programmazione jingle COMPLETA & pubblicata:**
- Feature completa: menu kebab (Modifica/Programma) · modale con orario **HH:mm:ss** + "ripeti ogni giorno" · tab **Tutti | Programmati** · card programmate identiche + orario/badge/**toggle attiva-disattiva** · **scheduler** che suona all'orario con **toast countdown animato + Blocca**, che **resta durante la riproduzione** (Interrompi) e sparisce se la voce viene rimossa/disattivata.
- `ScheduleService` refactor a **signal-store** (fonte di verità, update ottimistici → meno letture). **Cascade delete** (jingle → sue programmazioni). Tick via **Web Worker** (no throttling tab in background). **Audio solo dallo standalone** se anche il browser è aperto. Dettagli in `MEMO.md` §14.
- **Regole Firestore** (`schedules`) **deployate** su `jingle-machine-2026` (account `syndacate.dev@gmail.com`; config `firebase.json`+`.firebaserc`).
- **Pubblicato**: push su `main` (Pages) + tag **`v0.10.0`** → Release con installer Win (.exe) + Mac (.dmg): <https://github.com/ClemAnto/JingleMachine/releases/tag/v0.10.0>

**Aggiornamento (sessione 2026-07-10, v0.12.3) — Fix permessi microfono (voice trigger) su macOS:**
- Loop infinito del prompt microfono su Mac risolto lato **packaging**: `mac.hardenedRuntime: false` (electron-builder lo attiva di default → macOS bloccava il mic senza l'entitlement `audio-input` sugli Helper; ad-hoc+HR rompeva anche la library validation). Coerente con "no notarizzazione". Dettagli in `MEMO.md` §15.
- Gestione permessi **OS-aware + per-device** (v0.12.2): bridge TCC nel main (`askForMediaAccess`) + preload IPC (`window.jingleMachine`) + memoria in `localStorage` + stop retry su rifiuto + re-richiesta guidata (deep-link Impostazioni) + recupero automatico (`focus`/`onchange`). Banner "Consenti microfono".
- Pubblicato: push su `main` + tag **`v0.12.3`** → Release con installer Win (.exe) + Mac (.dmg). ⚠️ **Da confermare su un Mac reale** (build/fix OK ma non verificabile da Windows).

**Prossimo passo — opzioni:**
1. **Scheduler a finestra chiusa** (consigliato): tray + background + (opz.) avvio automatico nello standalone Electron → oggi la programmazione suona solo ad app aperta. Vedi `MEMO.md` §14/§13.
2. **Fase 4**: ottimizzazione letture Cloudinary (cache HTTP + IndexedDB + lazy-load) — anche via **PWA**.
3. **Rifinire Fase 7**: eseguire il **dmg su un Mac reale** (build OK ma mai avviato su macOS), **icona app** (`build/icon.*`), aggiornare `server/README.md`.
4. **Chiudere Fase 1** (Local Network Access + token) e **Fase 6** (deploy GitHub Pages + domini autorizzati).
5. Nice-to-have scheduler: badge "programmato" sulle card in **Tutti**, "prossima esecuzione", gestione di 2+ jingle allo stesso secondo.

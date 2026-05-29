# 🗺️ Roadmap — Jingle Machine

Piano di lavoro dal progetto attuale al prodotto finito. Le decisioni architetturali e i "perché"
sono in [`MEMO.md`](MEMO.md) §8. Spunta gli item man mano (`[ ]` → `[x]`).

---

## 🎯 Visione

Webapp online (GitHub Pages) dove un gruppo di colleghi condivide una **libreria di jingle**:
ognuno può **caricare** un jingle (anche estraendolo da YouTube) e **tutti** possono ascoltarli.
Stack **100% gratuito e senza carta di credito**.

**Design:** la UI segue il **mockup Figma** di DiNardo → <https://www.figma.com/design/wKTJuVY5rC1KI6NBEGVxkj/Jingle-Machine?node-id=0-1>
(l'attuale UI è una prima bozza, da allineare al mockup nella Fase 5).

**Architettura decisa:**
- **Firebase Auth + Firestore** → login + metadati (piano Spark, gratis, no carta)
- **Cloudinary** → file MP3 condivisi (free 25 crediti/mese, no carta)
- **Helper locale** (Node + yt-dlp + ffmpeg) → estrazione da YouTube sul PC di chi carica (IP residenziale)
- **Webapp ↔ helper** → HTTP su `localhost`

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

## 🔗 Fase 2 — Integrazione webapp ↔ helper  ⬅️ PROSSIMA

> Collegare la webapp all'helper. All'inizio basta "estrai → ascolta/scarica nel browser", senza ancora salvare.

- [ ] Sezione "Estrai da YouTube" nella webapp
- [ ] Ping a `http://localhost:PORT/health` → stato "🟢 Helper connesso / 🔴 non trovato"
- [ ] Flusso base: incolla URL + scegli intervallo → `POST /extract` → ricevi MP3 → riproducilo/scaricalo
- [ ] Gestire il **prompt di permesso** del browser (Local Network Access) — uso personale, basta accettarlo
- [ ] Barra di avanzamento (opz.: WebSocket o polling stato)

---

## 📦 Fase 3 — Storage condiviso su Cloudinary

> Far atterrare gli MP3 estratti nella libreria condivisa. Sostituisce Firebase Storage (richiede Blaze+carta).

- [ ] Creare account Cloudinary (no carta) e cloud name
- [ ] Aggiungere config Cloudinary in `client/src/environments/environment.ts`
- [ ] Riscrivere `LibraryService`: upload su Cloudinary + lettura via URL CDN
- [ ] **Rendere la libreria CONDIVISA**: la query Firestore non filtra più per utente → tutti vedono tutti i jingle (oggi è per-utente)
- [ ] Aggiornare le **Firestore security rules**: lettura a tutti gli autenticati, scrittura/eliminazione solo del proprio documento
- [ ] Rimuovere `firebase/storage.rules` e i riferimenti a Firebase Storage
- [ ] Collegare l'estrazione (Fase 2): MP3 estratto → upload su Cloudinary + metadati Firestore
- [ ] Mostrare l'autore di ogni jingle nella lista

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

- [ ] **Allineare la UI al mockup Figma** di DiNardo (login, editor, libreria)
- [ ] Verifica finale Firestore security rules (libreria condivisa)
- [ ] Gestione errori chiara (helper offline, blocco YouTube, quota Cloudinary)
- [ ] Stati di caricamento / feedback UX
- [ ] (Opz.) Riproduttore audio più curato (waveform, ecc.)

---

## 🚀 Fase 6 — Deploy & verifica end-to-end

- [ ] Domini autorizzati in Firebase Auth (`<utente>.github.io`)
- [ ] Deploy webapp su GitHub Pages
- [ ] Test completo: login → estrai da YouTube (helper) → salva → un altro utente ascolta
- [ ] Mini-istruzioni per i colleghi su come scaricare/avviare l'helper

---

## 📦 Fase 7 — Packaging in eseguibile unico (Win + Mac) — STEP FINALE

> Requisito del prodotto finale: i colleghi scaricano un'app da doppio clic, senza installare Node.

**Architettura**: eseguibile unico che racchiude **server + client**. Il server Express serve anche
la dist Angular come file statici (`express.static`). L'utente apre `http://localhost:4321`
nel browser → ha l'intera app. La libreria condivisa continua ad appoggiarsi su Cloudinary + Firestore
(internet serve solo per quello).

> Accortezza per non chiudersi le porte già in Fase 2: aggiungere al server la route
> `express.static(path alla dist Angular)` opzionale (una riga). Non serve attivarla ora.

- [ ] Fare la build Angular (`ng build`) e copiare la `dist/` dentro `server/` (o come asset del bundle)
- [ ] Aggiungere al server Express la route `express.static` che serve la dist Angular
- [ ] Scegliere lo strumento: **pkg/@yao-pkg/pkg** (eseguibile leggero ~40-80 MB) oppure **Electron** (100-200 MB, comodo per tray/auto-update)
- [ ] Includere i binari per-OS (yt-dlp / ffmpeg / Deno) — bundle o download al primo avvio
- [ ] **Build multipiattaforma** via GitHub Actions (matrice Windows + macOS, gratis su repo pubblico)
- [ ] **Windows**: gestire l'avviso SmartScreen (eventuale firma del codice)
- [ ] **macOS**: notarizzazione (Apple Developer ~99$/anno) **oppure** istruzioni "clic destro → Apri" se restiamo gratis
- [ ] (Opz.) **Auto-update** dell'app + tray con stato "🟢 Avviata / Esci"

---

## 🔭 Eventuali evoluzioni future (NON ora)

- [ ] "Sempre online" senza PC acceso → server + **proxy residenziale** a pagamento (pochi €/mese) o **PC + Cloudflare Tunnel**
- [ ] Mitigazioni anti-blocco YouTube se necessario: **cookie** (account usa-e-getta) o **PO token** (`bgutil-ytdlp-pot-provider`)
- [ ] Supporto anche **Linux** per l'helper
- [ ] Paginazione / ricerca nella libreria se cresce molto

---

## 👉 Dove eravamo / Prossimo passo

**Stato (fine sessione 2026-05-29 — seconda parte):**
- **Tutta la UI** (client Angular + mini pagina server) ora in **inglese** (era italiano per la UI).
- Server usa **`yarn`**; client usa `npm`.
- **Mini pagina di test** riscritta: dark theme, sezioni info+extract unite, placeholder visivo,
  preload MP3 al Test + preview istantanea con seek. Dettagli in `MEMO.md` §10.
- **Fase 7**: pianificato eseguibile unico client+server (Express serve la dist Angular). Vedi `MEMO.md` §10.
- Fase 1 resta quasi completa (mancano ancora i 2 punti di sicurezza).

**Prossimo passo — opzioni:**
1. Chiudere la Fase 1: header **Local Network Access** + **token di abbinamento** (vedi `MEMO.md` §10).
2. **Fase 2**: integrare l'helper nella webapp Angular (sezione "Estrai da YouTube", pallino 🟢/🔴 via `/health`,
   flusso incolla URL → `/info` → scegli intervallo → `/extract` → ascolta/scarica).

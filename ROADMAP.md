# 🗺️ Roadmap — Jingle Machine

Piano di lavoro dal progetto attuale al prodotto finito. Le decisioni architetturali e i "perché"
sono in [`MEMO.md`](MEMO.md) §8. Spunta gli item man mano (`[ ]` → `[x]`).

---

## 🎯 Visione

Webapp online (GitHub Pages) dove un gruppo di colleghi condivide una **libreria di jingle**:
ognuno può **caricare** un jingle (anche estraendolo da YouTube) e **tutti** possono ascoltarli.
Stack **100% gratuito e senza carta di credito**.

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

## 🔌 Fase 1 — Helper locale (`server/`)  ⬅️ SI PARTE DA QUI

> Piccola app sul PC di chi vuole estrarre da YouTube. Obiettivo della fase: **provarlo subito in locale**.

- [ ] Inizializzare progetto Node in `server/`
- [ ] Server Express minimo con endpoint `GET /health` → **primo test nel browser**
- [ ] Endpoint `POST /extract { url, start, end }` → yt-dlp scarica audio, ffmpeg taglia → restituisce MP3
- [ ] **Provarlo a mano** (es. con un client REST o curl) e verificare che YouTube risponda dal tuo IP di casa
- [ ] Bundle dei binari: **yt-dlp** + **ffmpeg** (+ **Deno**, richiesto da yt-dlp per YouTube)
- [ ] **Auto-aggiornamento di yt-dlp** (così non si rompe a ogni cambio di YouTube)
- [ ] **CORS** ristretto all'origine GitHub Pages + header **Local Network Access** (preflight)
- [ ] **Sicurezza**: ascolto solo su `127.0.0.1` + token di abbinamento
- [ ] Confezionamento in **eseguibile** (`.exe`) da doppio clic

---

## 🔗 Fase 2 — Integrazione webapp ↔ helper

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

## 🔭 Eventuali evoluzioni future (NON ora)

- [ ] "Sempre online" senza PC acceso → server + **proxy residenziale** a pagamento (pochi €/mese) o **PC + Cloudflare Tunnel**
- [ ] Mitigazioni anti-blocco YouTube se necessario: **cookie** (account usa-e-getta) o **PO token** (`bgutil-ytdlp-pot-provider`)
- [ ] Helper multipiattaforma (macOS/Linux) e firma del codice (per evitare avvisi di sicurezza)
- [ ] Paginazione / ricerca nella libreria se cresce molto

---

## 👉 Prossimo passo

**Fase 1, primo mattoncino**: inizializzare `server/` e creare il server Express con `GET /health`,
da aprire nel browser per vederlo rispondere. Poi subito l'endpoint `/extract` per provare l'estrazione reale.

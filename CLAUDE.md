# CLAUDE.md — istruzioni per l'assistente

Promemoria per lavorare bene su questo progetto. Leggi prima di iniziare un task.

## Cos'è il progetto
Webapp Angular per tagliare porzioni di audio ed esportarle in MP3, con **libreria condivisa**.
Deploy su GitHub Pages. Dettagli completi in `MEMO.md`.

**Architettura definitiva** (vedi `MEMO.md` §8 "Decisione finale"):
- **Firebase Auth + Firestore** (piano Spark, gratis, no carta) → login + metadati.
- **Cloudinary** (free, no carta) → file MP3 condivisi. ⚠️ NON usare Firebase Storage (ora richiede Blaze+carta).
- **Helper locale** Node + yt-dlp + ffmpeg (in `server/`) → estrazione YouTube via HTTP `localhost`.
- ⚠️ **Requisito**: ottimizzare il consumo di letture/banda Cloudinary (cache HTTP + IndexedDB). Vedi `MEMO.md` §8.

## Struttura del repo
Monorepo "semplice" con due cartelle sorelle indipendenti (ognuna col suo `package.json`):
- `client/` → app Angular (esistente). I comandi `npm` vanno lanciati **dentro `client/`**.
- `server/` → server Node per YouTube → audio (**non ancora creato**; piano in `MEMO.md` §8).
- `firebase/` → security rules. `.github/` → deploy. **Non c'è `package.json` in radice.**

## Documenti del progetto — quando consultarli

| File | Quando leggerlo |
|------|-----------------|
| **`MEMO.md`** | **Sempre, per primo.** Setup, comandi, struttura, decisioni architetturali, deploy, limiti. È la fonte di verità operativa. |
| **`ROADMAP.md`** | Per sapere a che punto siamo e cosa manca: piano a fasi con checklist. Aggiornarlo spuntando gli item completati. |
| `README.md` | Generato da Angular CLI: comandi base. Poco rilevante, preferisci `MEMO.md`. |
| `firebase/firestore.rules` | Quando tocchi lo schema dati Firestore o la sicurezza delle query. |
| `firebase/storage.rules` | Quando tocchi upload/download dei file o i loro path. |
| `CLAUDE.md` (questo) | All'inizio, per orientarti e per le convenzioni. |

> Se aggiungi un nuovo `.md`, **aggiungilo a questa tabella**.

## Convenzioni di codice
- Angular **standalone** (niente NgModule), **signals** per lo stato, `inject()` per la DI.
- Lingua dei testi UI e dei commenti: **italiano**.
- Service Firebase: iniettare i token `AUTH` / `FIRESTORE` / `STORAGE` da `client/src/app/core/firebase.providers.ts`
  (NON usare `@angular/fire`: incompatibile con Angular 21).
- UI con **ng-zorro-antd**; utility di layout con **Tailwind**. Nuove icone NgZorro → registrarle in `client/src/app/app.config.ts`.
- Stile globale in `client/src/styles.css` (Tailwind); stili dei componenti in `.scss`.

## Prima di consegnare una modifica
> Lancia i comandi **dentro `client/`** (`cd client`).
1. `npm run build` deve passare (è il check più affidabile: type-check + bundling).
2. Se tocchi i test: `npm test`.
3. Se cambi versioni di `@ffmpeg/*`: verifica il nome del worker e gli URL CDN in `client/src/app/core/ffmpeg.service.ts` (vedi `MEMO.md` §6).

## Punti delicati (vedi MEMO per il dettaglio)
- **YouTube**: non implementato, richiede un server. Analisi e opzioni in `MEMO.md` §8.
- **ffmpeg.wasm**: core single-thread + worker da CDN per compatibilità con GitHub Pages (no COOP/COEP).
- **Sicurezza**: la config Firebase è pubblica; la protezione reale sono le Security Rules.

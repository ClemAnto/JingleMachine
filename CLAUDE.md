# CLAUDE.md — istruzioni per l'assistente

Promemoria per lavorare bene su questo progetto. Leggi prima di iniziare un task.

## 🔚 Comando «chiudo» (rituale di fine sessione) — ISTRUZIONE PERMANENTE

Quando l'utente scrive **`chiudo`** (da solo o in una frase), PRIMA di rispondere:

1. **Analizza la chat corrente** ed estrai ciò che sarà utile al *me* futuro per **decidere meglio e più in fretta**:
   - decisioni prese **+ il perché**; opzioni **scartate** e il motivo (per non riproporle);
   - **preferenze e stile di lavoro** dell'utente emersi;
   - **fatti verificati** (con data, perché deperibili) e link/fonti;
   - trappole/insidie incontrate e come evitarle.
2. **Scrivi** queste indicazioni nel file giusto (senza duplicare ciò che c'è già):
   - **`MEMO.md`** → decisioni tecniche/architetturali, vincoli, fatti verificati, trucchi operativi;
   - **`ROADMAP.md`** → avanzamento (spunta gli item fatti) e prossimi passi;
   - **`CLAUDE.md`** (questo) → convenzioni di lavoro, preferenze dell'utente, come prendere le decisioni.
3. **Riassumi** in chat cosa hai scritto e dove.

> Obiettivo: ogni sessione lascia il progetto più "pronto" della precedente. Conciso e azionabile, niente muri di testo.

### Preferenze dell'utente (aggiornare qui col tempo)
- Vuole soluzioni **gratuite e senza carta di credito**; rifiuta i piani a pagamento se evitabili.
- Vuole **semplicità e leggibilità**, best practice dei framework; **niente over-engineering**.
- Si fida quando **verifico i fatti online** (specie cose che cambiano nel tempo) invece di andare a memoria.
- Fa **domande di pianificazione** prima di codare: meglio chiarire architettura/costi/rischi prima.
  Asseconda: sviscera alternative/costi/rischi **prima** di scrivere codice, senza fretta di codare.
- **Principiante sul backend** → spiegare i concetti in modo **elementare**, con analogie, e indicare il "perché" delle scelte.
- Segnalare sempre **refusi/errori** in italiano e inglese (anche fuori task) — vedi istruzioni globali.
- **Versioning delegato a Claude**: bumpa `server/package.json` → `version` autonomamente nello stesso commit della modifica.
  - **patch** (0.1.x) → qualsiasi commit che produce una nuova build (bugfix, CI fix, refactor, script)
  - **minor** (0.x.0) → completamento di una Fase o feature rilevante
  - **major** (x.0.0) → solo su indicazione esplicita dell'utente
  - ⚠️ Ogni volta che si triggera una nuova build (`yarn release` o tag), la versione deve essere già stata bumpata nel commit precedente.
  - Quando si crea un tag git, assicurarsi che corrisponda alla versione nel `package.json`.

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
- `client/` → app Angular (esistente). I comandi usano **`npm`**, lanciati **dentro `client/`**.
- `server/` → server Node per YouTube → audio. I comandi usano **`yarn`**, lanciati **dentro `server/`**.
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
| `server/README.md` | Quando lavori sull'**helper locale** (`server/`): come avviarlo, endpoint, comandi di test. |

> Se aggiungi un nuovo `.md`, **aggiungilo a questa tabella**.

## Convenzioni di codice
- Angular **standalone** (niente NgModule), **signals** per lo stato, `inject()` per la DI.
- **Usare sempre i pattern più recenti consigliati** del framework; se in dubbio, **consultare prima la documentazione ufficiale online** (l'utente preferisce questo a soluzioni a memoria/datate).
- **Nomi variabili "puliti"**: niente caratteri come `@` `_` `$`, solo camelCase. Per gli Observable **niente suffisso `$`** → usare nomi espliciti tipo `userStream` o `userQueue` (preferenza esplicita dell'utente).
- Codice **semplice e leggibile**, commenti solo dove servono davvero (senza esagerare).
- **LINGUA: codice, commenti, log, identificatori e testi UI SEMPRE in inglese.** La documentazione (`.md`) resta in italiano.
  > ⚠️ Il codice scritto nella Fase 0 ha commenti e testi UI in italiano: vanno tradotti in inglese quando si tocca quel file
  > (o in una passata dedicata).
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

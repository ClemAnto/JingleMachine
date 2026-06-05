# Helper locale + app desktop — Jingle Machine

Server Node locale che estrae audio da YouTube usando il tuo IP di casa (YouTube quasi non blocca, tutto gratis).
Ha **due modalità**:
- **Standalone (Electron)** — è impacchettato nell'app desktop: avvia il server e apre una finestra sulla webapp. È il prodotto finale.
- **Headless (dev)** — gira da solo (`yarn start`) e affianca il dev server Angular (`localhost:4200`).

> Su GitHub Pages l'helper **non c'è**: lì la funzione YouTube è disattivata.

## Endpoint HTTP (solo `localhost`)

| Endpoint | Cosa fa |
|---|---|
| `GET /health` | Dice se l'helper è vivo e pronto (binari installati). |
| `GET /info?url=...` | Metadati del video (titolo, durata, autore, anteprima), **senza scaricare**. |
| `POST /extract` `{ url, start?, end? }` | Scarica, **taglia** (start/end in secondi) e converte in **MP3**. |
| `POST /heartbeat` | La webapp lo pinga mentre è aperta; se i ping si fermano per ~150s l'helper si chiude. |
| `POST /shutdown` | Spegne l'helper. |

Al primo avvio scarica da solo i programmi che gli servono (`yt-dlp`, `ffmpeg`, `ffprobe`, `deno`) e aggiorna `yt-dlp`.
In Electron i binari/temp stanno in `%APPDATA%\JingleMachine` (mac: `~/Library/Application Support/JingleMachine`); in dev nella cartella `server/`.

## Avvio

```bash
cd server
yarn install

yarn start        # headless: server su http://127.0.0.1:4321 (yarn dev = riavvio automatico)
yarn electron     # app desktop Electron (finestra sulla webapp) — richiede prima server/app/ (build Angular)
yarn dist         # crea l'installer (NSIS su Win, dmg su mac) in dist-electron/
```

In headless apri **<http://127.0.0.1:4321/helper>**: c'è una **mini pagina di test** con i pulsanti per gli endpoint e i log.

> Il primo avvio impiega un po': sta scaricando i binari. Segui i log finché compare "All binaries ready.".

### Test locale completo (con modifica MP3 / YouTube)

Due terminali:
```bash
cd server && yarn start      # terminale 1 — helper
cd client && npm start       # terminale 2 — webapp
```
Apri **<http://localhost:4200>**: con l'helper attivo compare **"Carica da Youtube"** → URL → taglio → estrazione MP3.
> Il **salvataggio** del jingle richiede Cloudinary configurato in `client/src/environments/environment.ts`.
> Un **refresh non spegne** l'helper (resta solo l'auto-shutdown via heartbeat dopo ~150s di inattività).

## Test rapidi da terminale

### PowerShell (Windows)

```powershell
# Stato
Invoke-RestMethod http://127.0.0.1:4321/health

# Metadati di un video
Invoke-RestMethod "http://127.0.0.1:4321/info?url=https://www.youtube.com/watch?v=VIDEO_ID"

# Estrai i secondi 10-25 in un MP3
$body = @{ url = "https://www.youtube.com/watch?v=VIDEO_ID"; start = 10; end = 25 } | ConvertTo-Json
Invoke-WebRequest http://127.0.0.1:4321/extract -Method Post -ContentType "application/json" -Body $body -OutFile jingle.mp3
```

### curl (macOS / Linux / Git Bash)

```bash
# Stato
curl http://127.0.0.1:4321/health

# Metadati
curl "http://127.0.0.1:4321/info?url=https://www.youtube.com/watch?v=VIDEO_ID"

# Estrai i secondi 10-25 in un MP3
curl -X POST http://127.0.0.1:4321/extract \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.youtube.com/watch?v=VIDEO_ID","start":10,"end":25}' \
  --output jingle.mp3
```

## Note

- Ascolta **solo** su `127.0.0.1` (non raggiungibile dalla rete).
- I binari scaricati e i file temporanei (`bin/`, `tmp/`) sono ignorati da git.
- Porta predefinita `4321` (cambiala con la variabile d'ambiente `PORT`).

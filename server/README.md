# Helper locale — Jingle Machine

Piccolo server Node che gira **sul PC di chi vuole estrarre audio da YouTube**.
Usa il tuo IP di casa, così YouTube quasi non blocca, e resta tutto gratis.

## Cosa fa

Tre endpoint HTTP, solo su `localhost`:

| Endpoint | Cosa fa |
|---|---|
| `GET /health` | Dice se l'helper è vivo e pronto (binari installati). |
| `GET /info?url=...` | Metadati del video (titolo, durata, autore, anteprima), **senza scaricare**. |
| `POST /extract` `{ url, start?, end? }` | Scarica, **taglia** (se passi start/end in secondi) e converte in **MP3**. |

Al primo avvio scarica da solo i programmi che gli servono (`yt-dlp`, `ffmpeg`,
`ffprobe`, `deno`) nella cartella `bin/`, e poi aggiorna `yt-dlp`.

## Avvio

```bash
cd server
yarn install
yarn start        # oppure: yarn dev (riavvio automatico ad ogni modifica)
```

Poi apri **<http://127.0.0.1:4321>** nel browser: c'è una **mini pagina di test**
con pulsanti per i tre endpoint e una **textbox dei log**.

> Il primo avvio impiega un po': sta scaricando i binari. Segui i log
> (nel terminale o nella textbox della pagina) finché compare "All binaries ready.".

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

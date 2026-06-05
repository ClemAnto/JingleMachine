# Jingle Machine

Webapp per creare una **libreria di jingle privata per utente**: carichi un audio (o lo estrai da YouTube),
lo tagli in **MP3** e lo salvi nella tua libreria. Ogni utente, col proprio account, vede solo i propri jingle.

Frontend **Angular + NgZorro + Tailwind**. Servizi cloud (gratis, senza carta):
**Firebase Auth** (login) · **Firebase Firestore** (metadati) · **Cloudinary** (file MP3 — storage remoto).

## Due modi di usarla

- **App desktop (standalone, Electron)** — `server/` impacchetta un piccolo server locale che serve la
  webapp e fa l'**estrazione da YouTube** (yt-dlp + ffmpeg). Tutte le funzioni attive.
- **GitHub Pages** — la stessa webapp online, **senza** la funzione YouTube (nessun helper locale):
  resta login, libreria condivisa, upload di file audio.

## Struttura

```
client/    # app Angular (frontend)
server/    # app desktop Electron + server locale (estrazione YouTube → MP3)
firebase/  # security rules Firestore
```

## Avvio rapido (sviluppo)

```bash
# 1) Frontend
cd client
npm install
npm start          # http://localhost:4200

# 2) Helper locale (in un secondo terminale) — per testare anche la modifica MP3 / YouTube
cd server
yarn install
yarn start         # http://127.0.0.1:4321
```

Apri **http://localhost:4200**: con l'helper avviato compare anche il pulsante "Carica da Youtube".
Prima compila la config Firebase + Cloudinary in `client/src/environments/environment.ts`.

📖 **Tutto il resto (setup, deploy, scelte tecniche, roadmap) è in [`MEMO.md`](MEMO.md) e [`ROADMAP.md`](ROADMAP.md).**

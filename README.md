# Jingle Machine

Webapp per creare una **libreria di jingle privata per utente**: carichi un audio (o lo estrai da YouTube),
lo tagli in **MP3** e lo salvi nella tua libreria. Ogni utente, col proprio account, vede solo i propri jingle.

Frontend **Angular + NgZorro + Tailwind**. Servizi cloud (gratis, senza carta):
**Firebase Auth** (login) · **Firebase Firestore** (metadati) · **Cloudinary** (file MP3 — storage remoto).

## Due modi di usarla

- **App desktop (standalone, Electron)** — `server/` impacchetta il **Mixer** (server locale) che serve la
  webapp e fa l'**estrazione da YouTube** (yt-dlp + ffmpeg). Tutte le funzioni attive.
- **GitHub Pages** — la stessa webapp online, **senza** la funzione YouTube (nessun Mixer locale):
  resta login, libreria (privata per utente), upload di file audio.

## Struttura

```
client/    # app Angular (frontend)
server/    # app desktop Electron + Mixer locale (estrazione YouTube → MP3)
firebase/  # security rules Firestore
```

## Avvio rapido (sviluppo)

```bash
cd client && npm install          # dipendenze client
cd ../server && yarn install      # dipendenze Mixer
cd ../client && npm run start:all  # avvia client (:4200) + Mixer (:4321) insieme
```

Per testare **senza** configurare Firebase/Cloudinary (modalità userless): `npm run start:all:mock`.

Apri **http://localhost:4200**: con il Mixer avviato compare anche il pulsante "Carica da Youtube".
Per il salvataggio reale compila la config Firebase + Cloudinary in `client/src/environments/environment.ts`.

📖 **Tutto il resto (setup, deploy, scelte tecniche, roadmap) è in [`MEMO.md`](MEMO.md) e [`ROADMAP.md`](ROADMAP.md).**

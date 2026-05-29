# Jingle Machine

Webapp per tagliare porzioni di audio ed esportarle in **MP3**, con login e libreria personale.
Frontend **Angular + NgZorro + Tailwind**, backend-as-a-service **Firebase** (Auth, Firestore, Storage),
deploy su **GitHub Pages**.

## Struttura

```
client/    # app Angular (frontend)
server/    # server Node per YouTube → audio (in arrivo)
firebase/  # security rules Firestore + Storage
```

## Avvio rapido

```bash
cd client
npm install
npm start        # http://localhost:4200
```

Prima però compila la configurazione Firebase in `client/src/environments/environment.ts`.

📖 **Tutto il resto (setup Firebase, deploy, scelte tecniche, roadmap YouTube) è in [`MEMO.md`](MEMO.md).**

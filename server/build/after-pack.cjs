// electron-builder hook (macOS only): firma ad-hoc il bundle.
//
// Perché serve: la CI non ha un certificato Apple, quindi electron-builder salta
// del tutto la firma. Il bundle resta con la firma che il *linker* lascia sul
// binario Electron originale — verificato sul .dmg pubblicato:
//
//   Identifier=Electron   flags=adhoc,linker-signed   Info.plist=not bound
//   Sealed Resources=none
//
// Con un identificatore generico "Electron", l'Info.plist non legato alla firma e
// nessuna risorsa sigillata, macOS non riesce a fissare un'identità stabile per
// l'app: TCC non aggancia il consenso al microfono e `tccutil reset
// com.jinglemachine.app` agisce su un record che non è il nostro.
//
// La firma ad-hoc non richiede alcun account Apple e risolve l'identità. NON
// sostituisce un Developer ID: l'app resta non notarizzata (Gatekeeper chiede
// comunque "apri comunque" al primo avvio) e il cdhash cambia a ogni build, quindi
// il permesso microfono va riconcesso dopo ogni aggiornamento.
const { execFileSync } = require("node:child_process");
const path = require("node:path");

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;

  // Le build universal passano di qui tre volte: le due cartelle temporanee
  // per-architettura e poi il bundle unito. Il log serve a vederlo nel job macOS.
  console.log(`afterPack: appOutDir=${context.appOutDir}`);

  // Firmare le temporanee romperebbe il merge di @electron/universal (i file
  // CodeResources delle due architetture divergerebbero): firmiamo solo il
  // bundle finale, che è quello che finisce nel .dmg.
  if (!context.appOutDir.endsWith("mac-universal")) return;

  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  const id = context.packager.appInfo.id; // com.jinglemachine.app

  // --identifier è la parte che conta: senza, l'identificatore resterebbe quello
  // ereditato dal binario Electron.
  execFileSync("codesign", ["--force", "--deep", "--sign", "-", "--identifier", id, app], {
    stdio: "inherit",
  });
  console.log(`afterPack: firmato ad-hoc "${app}" come ${id}`);
};

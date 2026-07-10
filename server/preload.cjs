// Preload (CommonJS): exposes a tiny, safe bridge to the renderer. contextIsolation
// is ON, so the renderer can't reach Node/Electron directly — only this surface.
// Used by the voice trigger for OS-aware microphone permission handling; absent on
// the web build (dev / GitHub Pages), where the client falls back to pure web APIs.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("jingleMachine", {
  platform: process.platform, // 'darwin' | 'win32' | ...
  // Real OS mic status ('granted' | 'denied' | 'not-determined' | 'restricted' on
  // macOS; 'unknown' elsewhere — the web layer decides there).
  getMicStatus: () => ipcRenderer.invoke("mic:status"),
  // Resolve the OS gate; shows the system prompt once when undecided. Returns a boolean.
  requestMic: () => ipcRenderer.invoke("mic:request"),
  // Deep-link to the OS microphone privacy settings (for a hard denial that can't re-prompt).
  openMicSettings: () => ipcRenderer.invoke("mic:openSettings"),
});

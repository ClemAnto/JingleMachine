import { Injectable, signal } from '@angular/core';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

/**
 * Wrapper attorno a ffmpeg.wasm (core SINGLE-THREAD).
 *
 * Usiamo il core single-thread perché quello multi-thread richiede
 * `SharedArrayBuffer`, che a sua volta richiede gli header COOP/COEP
 * (cross-origin isolation) NON impostabili su GitHub Pages.
 * Single-thread è più lento ma funziona ovunque senza header speciali.
 *
 * I file del core vengono scaricati da CDN al primo utilizzo e messi in cache.
 */
@Injectable({ providedIn: 'root' })
export class FfmpegService {
  private readonly CORE_BASE = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd';
  // Worker della classe FFmpeg caricato da CDN: evita i problemi di bundling del
  // worker con esbuild. ATTENZIONE: se aggiorni @ffmpeg/ffmpeg, il nome del file
  // del worker (814.ffmpeg.js) può cambiare — vedi node_modules/@ffmpeg/ffmpeg/dist/umd.
  private readonly FFMPEG_BASE = 'https://unpkg.com/@ffmpeg/ffmpeg@0.12.15/dist/umd';

  private ffmpeg: FFmpeg | null = null;
  private loadPromise: Promise<void> | null = null;

  /** 0 → 1, progresso dell'operazione corrente (utile per una progress bar). */
  readonly progress = signal(0);
  readonly loading = signal(false);

  /** Carica il core ffmpeg una sola volta (idempotente). */
  private async ensureLoaded(): Promise<FFmpeg> {
    if (this.ffmpeg) {
      return this.ffmpeg;
    }
    if (!this.loadPromise) {
      this.loading.set(true);
      const ffmpeg = new FFmpeg();
      ffmpeg.on('progress', ({ progress }) => this.progress.set(Math.min(1, Math.max(0, progress))));
      this.loadPromise = ffmpeg
        .load({
          classWorkerURL: await toBlobURL(`${this.FFMPEG_BASE}/814.ffmpeg.js`, 'text/javascript'),
          coreURL: await toBlobURL(`${this.CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${this.CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
        })
        .then(() => {
          this.ffmpeg = ffmpeg;
          this.loading.set(false);
        });
    }
    await this.loadPromise;
    return this.ffmpeg!;
  }

  /**
   * Taglia la porzione [startSec, endSec] del file audio in input e la
   * codifica in MP3. Restituisce il Blob risultante.
   */
  async trimToMp3(file: File | Blob, startSec: number, endSec: number): Promise<Blob> {
    const ffmpeg = await this.ensureLoaded();
    const duration = Math.max(0, endSec - startSec);
    const inputName = 'input';
    const outputName = 'output.mp3';

    this.progress.set(0);
    await ffmpeg.writeFile(inputName, await fetchFile(file));

    // -ss prima di -i = seek veloce; -t = durata; -vn scarta eventuale video; lame a 192k.
    await ffmpeg.exec([
      '-ss', String(startSec),
      '-i', inputName,
      '-t', String(duration),
      '-vn',
      '-acodec', 'libmp3lame',
      '-b:a', '192k',
      outputName,
    ]);

    const data = (await ffmpeg.readFile(outputName)) as Uint8Array;

    // Pulizia del filesystem virtuale.
    await ffmpeg.deleteFile(inputName).catch(() => undefined);
    await ffmpeg.deleteFile(outputName).catch(() => undefined);

    this.progress.set(1);
    // Copia in un Uint8Array con ArrayBuffer "normale" (non Shared) per il tipo BlobPart.
    return new Blob([new Uint8Array(data)], { type: 'audio/mpeg' });
  }
}

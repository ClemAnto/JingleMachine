import { Injectable, signal } from '@angular/core';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

/**
 * Wrapper around ffmpeg.wasm (SINGLE-THREAD core).
 *
 * We use the single-thread core because the multi-thread one requires
 * `SharedArrayBuffer`, which in turn requires the COOP/COEP headers
 * (cross-origin isolation) that CANNOT be set on GitHub Pages.
 * Single-thread is slower but works everywhere without special headers.
 *
 * The core files are downloaded from a CDN on first use and cached by the browser.
 */
@Injectable({ providedIn: 'root' })
export class FfmpegService {
  private readonly CORE_BASE = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd';
  // FFmpeg class worker loaded from a CDN: avoids worker bundling issues with
  // esbuild. WARNING: if you bump @ffmpeg/ffmpeg, the worker file name
  // (814.ffmpeg.js) may change — see node_modules/@ffmpeg/ffmpeg/dist/umd.
  private readonly FFMPEG_BASE = 'https://unpkg.com/@ffmpeg/ffmpeg@0.12.15/dist/umd';

  private ffmpeg: FFmpeg | null = null;
  private loadPromise: Promise<void> | null = null;

  /** 0 → 1, progress of the current operation (useful for a progress bar). */
  readonly progress = signal(0);
  readonly loading = signal(false);

  /** Loads the ffmpeg core only once (idempotent). */
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
   * Trims the [startSec, endSec] portion of the input audio file and
   * encodes it to MP3. Returns the resulting Blob.
   */
  async trimToMp3(file: File | Blob, startSec: number, endSec: number): Promise<Blob> {
    const ffmpeg = await this.ensureLoaded();
    const duration = Math.max(0, endSec - startSec);
    const inputName = 'input';
    const outputName = 'output.mp3';

    this.progress.set(0);
    await ffmpeg.writeFile(inputName, await fetchFile(file));

    // -ss before -i = fast seek; -t = duration; -vn drops any video; lame at 192k.
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

    // Clean up the virtual filesystem.
    await ffmpeg.deleteFile(inputName).catch(() => undefined);
    await ffmpeg.deleteFile(outputName).catch(() => undefined);

    this.progress.set(1);
    // Copy into a Uint8Array backed by a "plain" (non-Shared) ArrayBuffer for the BlobPart type.
    return new Blob([new Uint8Array(data)], { type: 'audio/mpeg' });
  }
}

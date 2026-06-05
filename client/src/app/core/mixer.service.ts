import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../environments/environment';

/** /health response from the local Mixer (audio loader/editor). */
export interface MixerHealth {
  ok: boolean;
  ready: boolean; // true once yt-dlp + ffmpeg + deno are installed
  versions: Record<string, string | null>;
}

/** /info response: video metadata, fetched without downloading. */
export interface VideoInfo {
  id: string;
  title: string;
  uploader: string;
  durationSeconds: number;
  thumbnail: string;
  webpageUrl: string;
}

/**
 * Talks to the local Mixer (server/) that loads audio from YouTube and trims it to MP3.
 * The Mixer listens on 127.0.0.1; if it is not running, calls reject.
 */
@Injectable({ providedIn: 'root' })
export class MixerService {
  private readonly http = inject(HttpClient);

  /**
   * True in the standalone build, where the Mixer itself serves this page:
   * same origin → relative URLs, no CORS, and refresh-safe (no unload shutdown).
   * False on the Angular dev server (:4200) and on GitHub Pages, where the
   * Mixer is a separate loopback process reached via an absolute URL.
   */
  readonly isStandalone = this.detectStandalone();
  private readonly baseUrl = this.isStandalone ? '' : environment.mixer.baseUrl;

  private detectStandalone(): boolean {
    const loopback = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    const isAngularDevServer = window.location.port === '4200';
    return loopback && !isAngularDevServer;
  }

  /** Pings the Mixer. Returns its health, or null if it is unreachable. */
  async health(): Promise<MixerHealth | null> {
    try {
      return await firstValueFrom(this.http.get<MixerHealth>(`${this.baseUrl}/health`));
    } catch {
      return null;
    }
  }

  /** Fetches video metadata without downloading the audio. */
  info(url: string): Promise<VideoInfo> {
    return firstValueFrom(this.http.get<VideoInfo>(`${this.baseUrl}/info`, { params: { url } }));
  }

  /** Extracts (and trims to start..end seconds) the audio, returning the MP3 blob. */
  extract(url: string, start: number, end: number): Promise<Blob> {
    return firstValueFrom(
      this.http.post(`${this.baseUrl}/extract`, { url, start, end }, { responseType: 'blob' }),
    );
  }

  /** Extracts the FULL audio (no trimming) — used for instant in-browser preview. */
  extractFull(url: string): Promise<Blob> {
    return firstValueFrom(
      this.http.post(`${this.baseUrl}/extract`, { url }, { responseType: 'blob' }),
    );
  }

  /** Tells the Mixer the web app is still open. Silent if the Mixer is down. */
  async heartbeat(): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`${this.baseUrl}/heartbeat`, {}));
    } catch {
      // Mixer not running — nothing to keep alive.
    }
  }

  /** Fire-and-forget shutdown, reliable during page unload (uses sendBeacon). */
  shutdown(): void {
    navigator.sendBeacon?.(`${this.baseUrl}/shutdown`);
  }
}

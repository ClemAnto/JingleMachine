import { Component, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSpinModule } from 'ng-zorro-antd/spin';

import { MixerService, VideoInfo } from '../../../core/mixer.service';
import { UiButton } from '../../../ui/button/button';
import { UiTrimSlider } from '../../../ui/trim-slider/trim-slider';
import { PreparedAudio } from '../create-jingle-modal/create-jingle-modal';

/** Default clip length (seconds) pre-selected on the cut slider. */
const DEFAULT_CLIP_SECONDS = 30;

/**
 * YouTube import pipeline (two steps in one modal):
 *  1. 'url'  — paste a URL, validated via the Mixer's /info endpoint.
 *  2. 'cut'  — the FULL audio is extracted once (temporarily) so previewing any
 *             interval is instant (seek + play, stops at the end handle). On
 *             "Continua" only the selected range is extracted and handed to the
 *             create-jingle modal.
 */
@Component({
  selector: 'app-youtube-import-modal',
  imports: [
    FormsModule,
    NzIconModule,
    NzInputModule,
    NzModalModule,
    NzSpinModule,
    UiButton,
    UiTrimSlider,
  ],
  templateUrl: './youtube-import-modal.html',
})
export class YoutubeImportModal {
  private readonly mixer = inject(MixerService);
  private readonly message = inject(NzMessageService);

  readonly imported = output<PreparedAudio>();

  protected readonly visible = signal(false);
  protected readonly step = signal<'url' | 'cut'>('url');
  protected readonly busy = signal(false);

  protected url = signal('');
  protected info = signal<VideoInfo | null>(null);
  protected range = signal<[number, number]>([0, 0]);

  // Full-audio preview (loaded once when the cut step opens → instant seek).
  protected readonly previewLoading = signal(false);
  protected readonly previewReady = signal(false);
  protected readonly previewing = signal(false);
  private previewAudio: HTMLAudioElement | null = null;
  private previewObjectUrl: string | null = null;

  protected readonly clipDuration = computed(() => {
    const [start, end] = this.range();
    return Math.max(0, end - start);
  });

  open() {
    this.reset();
    this.visible.set(true);
  }

  protected close() {
    this.visible.set(false);
    this.disposeAudio();
  }

  /** Step 1 → 2: validate the URL, then preload the full audio for preview. */
  protected async checkUrl() {
    const url = this.url().trim();
    if (!url) {
      this.message.warning('Incolla un URL di YouTube.');
      return;
    }
    this.busy.set(true);
    try {
      const info = await this.mixer.info(url);
      const duration = Math.max(1, Math.floor(info.durationSeconds || 0));
      this.info.set(info);
      this.range.set([0, Math.min(duration, DEFAULT_CLIP_SECONDS)]);
      this.step.set('cut');
      this.loadPreview(info); // background: full audio for instant preview
    } catch (err) {
      console.error(err);
      this.message.error('Impossibile leggere il video. Controlla URL e Mixer.');
    } finally {
      this.busy.set(false);
    }
  }

  /** Extracts the FULL audio once and wires it up for instant seek-based preview. */
  private async loadPreview(info: VideoInfo) {
    this.previewLoading.set(true);
    try {
      const blob = await this.mixer.extractFull(info.webpageUrl);
      this.disposeAudio();
      this.previewObjectUrl = URL.createObjectURL(blob);
      const audio = new Audio(this.previewObjectUrl);
      audio.addEventListener('play', () => this.previewing.set(true));
      audio.addEventListener('pause', () => this.previewing.set(false));
      audio.addEventListener('timeupdate', this.onTimeUpdate);
      this.previewAudio = audio;
      this.previewReady.set(true);
    } catch (err) {
      console.error(err);
      this.message.error('Anteprima non disponibile (estrazione audio fallita).');
    } finally {
      this.previewLoading.set(false);
    }
  }

  /** Play/pause the selected interval (instant: seeks within the preloaded audio). */
  protected togglePreview() {
    const audio = this.previewAudio;
    if (!audio) return;
    if (this.previewing()) {
      audio.pause();
      return;
    }
    audio.currentTime = this.range()[0];
    audio.play();
  }

  /** Stop playback at the end handle and rewind to the start for the next play. */
  private readonly onTimeUpdate = () => {
    const audio = this.previewAudio;
    if (!audio) return;
    const [start, end] = this.range();
    if (audio.currentTime >= end) {
      audio.pause();
      audio.currentTime = start;
    }
  };

  /** nz-slider (range mode) emits number[]; keep the preview cursor in sync (instant,
   *  no re-extraction). Moving the START handle makes the cursor follow it; moving
   *  the END handle only rewinds if the cursor has passed it. */
  protected onRangeChange(value: number | number[] | null) {
    if (!Array.isArray(value)) return;
    const start = value[0] ?? 0;
    const end = value[1] ?? 0;
    const [prevStart] = this.range();
    this.range.set([start, end]);

    const audio = this.previewAudio;
    if (!audio) return;
    if (start !== prevStart) {
      audio.currentTime = start; // left handle moved → cursor follows it
    } else if (audio.currentTime > end) {
      audio.currentTime = start; // right handle moved past the cursor → rewind
    }
  }

  /** Step 2 → done: extract only the selected range and hand the blob to the
   *  create modal. The Cloudinary upload happens later, on "Crea". */
  protected async proceed() {
    const info = this.info();
    if (!info) return;
    const [start, end] = this.range();
    if (end <= start) {
      this.message.warning('Seleziona un intervallo valido.');
      return;
    }

    this.previewAudio?.pause();
    this.busy.set(true);
    try {
      const mp3 = await this.mixer.extract(info.webpageUrl, start, end);
      this.imported.emit({
        audioBlob: mp3,
        audioFilename: `${info.id}.mp3`,
        durationSec: end - start,
        suggestedName: info.title,
      });
      this.close();
    } catch (err) {
      console.error(err);
      this.message.error('Estrazione fallita. Riprova.');
    } finally {
      this.busy.set(false);
    }
  }

  /** Formats seconds as mm:ss (labels and slider tooltip). */
  protected readonly formatTime = (totalSeconds: number): string => {
    const seconds = Math.max(0, Math.floor(totalSeconds));
    const mm = Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0');
    const ss = (seconds % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
  };

  private disposeAudio() {
    if (this.previewAudio) {
      this.previewAudio.pause();
      this.previewAudio.removeEventListener('timeupdate', this.onTimeUpdate);
      this.previewAudio = null;
    }
    if (this.previewObjectUrl) {
      URL.revokeObjectURL(this.previewObjectUrl);
      this.previewObjectUrl = null;
    }
    this.previewReady.set(false);
    this.previewing.set(false);
  }

  private reset() {
    this.step.set('url');
    this.url.set('');
    this.info.set(null);
    this.range.set([0, 0]);
    this.busy.set(false);
    this.previewLoading.set(false);
    this.disposeAudio();
  }
}

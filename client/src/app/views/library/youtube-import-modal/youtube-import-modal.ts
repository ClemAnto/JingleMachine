import { Component, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSliderModule } from 'ng-zorro-antd/slider';
import { NzSpinModule } from 'ng-zorro-antd/spin';

import { HelperService, VideoInfo } from '../../../core/helper.service';
import { UiButton } from '../../../ui/button/button';
import { PreparedAudio } from '../create-jingle-modal/create-jingle-modal';

/** Default clip length (seconds) pre-selected on the cut slider. */
const DEFAULT_CLIP_SECONDS = 30;

/**
 * YouTube import pipeline (two steps in one modal):
 *  1. 'url'  — paste a URL, validated via the helper's /info endpoint.
 *  2. 'cut'  — pick a start/end interval, then extract + upload the MP3.
 * On success emits `imported` with the uploaded audio so the create-jingle
 * modal can open prefilled.
 */
@Component({
  selector: 'app-youtube-import-modal',
  imports: [
    FormsModule,
    NzIconModule,
    NzInputModule,
    NzModalModule,
    NzSliderModule,
    NzSpinModule,
    UiButton,
  ],
  templateUrl: './youtube-import-modal.html',
})
export class YoutubeImportModal {
  private readonly helper = inject(HelperService);
  private readonly message = inject(NzMessageService);

  readonly imported = output<PreparedAudio>();

  protected readonly visible = signal(false);
  protected readonly step = signal<'url' | 'cut'>('url');
  protected readonly busy = signal(false);

  protected url = signal('');
  protected info = signal<VideoInfo | null>(null);
  protected range = signal<[number, number]>([0, 0]);

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
  }

  /** Step 1 → 2: validate the URL through the helper. */
  protected async checkUrl() {
    const url = this.url().trim();
    if (!url) {
      this.message.warning('Incolla un URL di YouTube.');
      return;
    }
    this.busy.set(true);
    try {
      const info = await this.helper.info(url);
      const duration = Math.max(1, Math.floor(info.durationSeconds || 0));
      this.info.set(info);
      this.range.set([0, Math.min(duration, DEFAULT_CLIP_SECONDS)]);
      this.step.set('cut');
    } catch (err) {
      console.error(err);
      this.message.error('Impossibile leggere il video. Controlla URL ed helper.');
    } finally {
      this.busy.set(false);
    }
  }

  protected back() {
    this.step.set('url');
  }

  /** nz-slider (range mode) emits number[]; normalize it into our tuple signal. */
  protected onRangeChange(value: number | number[] | null) {
    if (Array.isArray(value)) {
      this.range.set([value[0] ?? 0, value[1] ?? 0]);
    }
  }

  /** Step 2 → done: extract the trimmed MP3 and hand it to the create modal.
   *  The Cloudinary upload happens later, on "Crea", to avoid wasting an upload
   *  if the user cancels the creation. */
  protected async proceed() {
    const info = this.info();
    if (!info) return;
    const [start, end] = this.range();
    if (end <= start) {
      this.message.warning('Seleziona un intervallo valido.');
      return;
    }

    this.busy.set(true);
    try {
      const mp3 = await this.helper.extract(info.webpageUrl, start, end);
      this.imported.emit({
        audioBlob: mp3,
        audioFilename: `${info.id}.mp3`,
        durationSec: end - start,
        suggestedName: info.title,
      });
      this.visible.set(false);
    } catch (err) {
      console.error(err);
      this.message.error('Estrazione fallita. Riprova.');
    } finally {
      this.busy.set(false);
    }
  }

  /** Formats seconds as mm:ss (used for labels and the slider tooltip). */
  protected readonly formatTime = (totalSeconds: number): string => {
    const seconds = Math.max(0, Math.floor(totalSeconds));
    const mm = Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0');
    const ss = (seconds % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
  };

  private reset() {
    this.step.set('url');
    this.url.set('');
    this.info.set(null);
    this.range.set([0, 0]);
    this.busy.set(false);
  }
}

import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzListModule } from 'ng-zorro-antd/list';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzSliderModule } from 'ng-zorro-antd/slider';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzUploadFile, NzUploadModule } from 'ng-zorro-antd/upload';

import { FfmpegService } from '../../core/ffmpeg.service';
import { Jingle, LibraryService } from '../../core/library.service';

@Component({
  selector: 'app-editor',
  imports: [
    DecimalPipe,
    FormsModule,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzIconModule,
    NzInputModule,
    NzListModule,
    NzProgressModule,
    NzSliderModule,
    NzSpinModule,
    NzUploadModule,
  ],
  templateUrl: './editor.html',
})
export class Editor implements OnDestroy {
  protected readonly ffmpeg = inject(FfmpegService);
  private readonly library = inject(LibraryService);
  private readonly message = inject(NzMessageService);

  // --- Source ---
  protected readonly file = signal<File | null>(null);
  protected readonly sourceUrl = signal<string | null>(null);
  protected readonly duration = signal(0);
  protected readonly range = signal<[number, number]>([0, 0]);
  protected readonly name = signal('');

  // --- Result ---
  protected readonly resultUrl = signal<string | null>(null);
  protected resultBlob: Blob | null = null;
  protected readonly processing = signal(false);

  // --- Library ---
  protected readonly jingles = signal<Jingle[]>([]);
  protected readonly loadingLibrary = signal(false);
  protected readonly saving = signal(false);

  protected readonly clipDuration = computed(() => {
    const [start, end] = this.range();
    return Math.max(0, end - start);
  });

  protected readonly progressPercent = computed(() => Math.round(this.ffmpeg.progress() * 100));

  constructor() {
    this.refreshLibrary();
  }

  /** Intercepts the file chosen by nz-upload without auto-uploading it. */
  protected readonly beforeUpload = (uploaded: NzUploadFile): boolean => {
    const file = uploaded as unknown as File;
    this.loadFile(file);
    return false;
  };

  private loadFile(file: File) {
    this.revokeUrls();
    this.resultBlob = null;
    this.resultUrl.set(null);

    this.file.set(file);
    this.sourceUrl.set(URL.createObjectURL(file));
    this.name.set(file.name.replace(/\.[^.]+$/, ''));
  }

  protected onMetadata(audio: HTMLAudioElement) {
    const dur = isFinite(audio.duration) ? audio.duration : 0;
    this.duration.set(dur);
    this.range.set([0, dur]);
  }

  async cut() {
    const file = this.file();
    if (!file) {
      return;
    }
    const [start, end] = this.range();
    if (end - start <= 0) {
      this.message.warning('Seleziona un intervallo valido.');
      return;
    }

    this.processing.set(true);
    try {
      const blob = await this.ffmpeg.trimToMp3(file, start, end);
      this.resultBlob = blob;
      this.revokeResultUrl();
      this.resultUrl.set(URL.createObjectURL(blob));
      this.message.success('Taglio completato!');
    } catch (err) {
      console.error(err);
      this.message.error('Errore durante il taglio audio.');
    } finally {
      this.processing.set(false);
    }
  }

  download() {
    if (!this.resultUrl()) {
      return;
    }
    const a = document.createElement('a');
    a.href = this.resultUrl()!;
    a.download = `${this.name() || 'jingle'}.mp3`;
    a.click();
  }

  async saveToLibrary() {
    if (!this.resultBlob) {
      return;
    }
    this.saving.set(true);
    try {
      await this.library.save(this.resultBlob, this.name() || 'jingle', this.clipDuration());
      this.message.success('Salvato nella libreria.');
      await this.refreshLibrary();
    } catch (err) {
      console.error(err);
      this.message.error('Salvataggio non riuscito. Controlla la configurazione Firebase.');
    } finally {
      this.saving.set(false);
    }
  }

  async refreshLibrary() {
    this.loadingLibrary.set(true);
    try {
      this.jingles.set(await this.library.list());
    } catch (err) {
      console.error(err);
    } finally {
      this.loadingLibrary.set(false);
    }
  }

  async deleteJingle(item: Jingle) {
    try {
      await this.library.remove(item);
      this.jingles.update((list) => list.filter((j) => j.id !== item.id));
      this.message.success('Eliminato.');
    } catch (err) {
      console.error(err);
      this.message.error('Eliminazione non riuscita.');
    }
  }

  /** mm:ss from a number of seconds. */
  protected format(seconds: number): string {
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    const m = Math.floor(seconds / 60).toString();
    return `${m}:${s}`;
  }

  private revokeResultUrl() {
    const url = this.resultUrl();
    if (url) {
      URL.revokeObjectURL(url);
    }
  }

  private revokeUrls() {
    const src = this.sourceUrl();
    if (src) {
      URL.revokeObjectURL(src);
    }
    this.revokeResultUrl();
  }

  ngOnDestroy() {
    this.revokeUrls();
  }
}

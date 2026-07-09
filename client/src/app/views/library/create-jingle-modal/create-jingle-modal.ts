import { Component, OnDestroy, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSliderModule } from 'ng-zorro-antd/slider';
import { NzSpinModule } from 'ng-zorro-antd/spin';

import { ImagePosition, JINGLE_COLORS, LibraryService } from '../../../core/library.service';
import { PlaybackService } from '../../../core/playback.service';
import { UiButton } from '../../../ui/button/button';
import { UiColorPicker } from '../../../ui/color-picker/color-picker';
import { UiImagePicker } from '../../../ui/image-picker/image-picker';
import { UiTagInput } from '../../../ui/tag-input/tag-input';
import { TriggerPhraseField } from '../trigger-phrase-field/trigger-phrase-field';

/** Audio extracted from YouTube, ready to upload on save (e.g. from the extract flow). */
export interface PreparedAudio {
  audioBlob: Blob;
  audioFilename: string;
  durationSec: number;
  suggestedName: string;
}

@Component({
  selector: 'app-create-jingle-modal',
  imports: [
    FormsModule,
    NzIconModule,
    NzInputModule,
    NzModalModule,
    NzSliderModule,
    NzSpinModule,
    UiButton,
    UiColorPicker,
    UiImagePicker,
    UiTagInput,
    TriggerPhraseField,
  ],
  templateUrl: './create-jingle-modal.html',
})
export class CreateJingleModal implements OnDestroy {
  private readonly library = inject(LibraryService);
  private readonly message = inject(NzMessageService);
  private readonly playback = inject(PlaybackService);

  // Detached element (not in the DOM): avoids querying across the modal overlay.
  private readonly previewAudio = new Audio();

  readonly saved = output<void>();

  constructor() {
    this.previewAudio.addEventListener('loadedmetadata', () => {
      if (isFinite(this.previewAudio.duration)) this.audioDuration.set(this.previewAudio.duration);
    });
    this.previewAudio.addEventListener('play', () => {
      this.previewPlaying.set(true);
      this.playback.begin(this);
    });
    this.previewAudio.addEventListener('pause', () => {
      this.previewPlaying.set(false);
      this.playback.end(this);
    });
    this.previewAudio.addEventListener('ended', () => {
      this.previewPlaying.set(false);
      this.playback.end(this);
    });
  }

  protected readonly visible = signal(false);

  protected name = signal('');
  protected tags = signal<string[]>([]);
  protected color = signal<string>(JINGLE_COLORS[0]);
  /** Playback volume 0–100 applied when the jingle is played from its card. */
  protected volume = signal(100);
  /** Spoken word/phrase that fires this jingle when voice mode is on. Empty = none. */
  protected triggerPhrase = signal('');
  protected audioFile = signal<File | null>(null);
  protected imageFile = signal<File | null>(null);
  protected imagePreview = signal<string | null>(null);
  protected imagePosition = signal<ImagePosition>({ x: 50, y: 50 });
  /** Object URL for previewing the selected/prepared audio (play/stop button). */
  protected audioPreviewUrl = signal<string | null>(null);
  protected previewPlaying = signal(false);
  protected saving = signal(false);
  protected audioDuration = signal(0);
  // When set, the audio is already on Cloudinary (YouTube flow): no file upload step.
  protected preparedAudio = signal<PreparedAudio | null>(null);

  /** Opens the modal for a normal file upload. */
  open() {
    this.reset();
    this.visible.set(true);
  }

  /** Opens the modal with audio already uploaded (YouTube flow), name prefilled. */
  openWithAudio(audio: PreparedAudio) {
    this.reset();
    this.preparedAudio.set(audio);
    this.name.set(audio.suggestedName);
    this.audioDuration.set(audio.durationSec);
    this.setPreviewUrl(URL.createObjectURL(audio.audioBlob));
    this.visible.set(true);
  }

  protected close() {
    this.visible.set(false);
  }

  protected onAudioSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.audioFile.set(file);
    if (!this.name()) this.name.set(file.name.replace(/\.[^.]+$/, ''));
    this.setPreviewUrl(URL.createObjectURL(file));
  }

  /** Cover image picked (or replaced): reframe from centre. */
  protected onImageSelected(file: File) {
    const prev = this.imagePreview();
    if (prev) URL.revokeObjectURL(prev);
    this.imageFile.set(file);
    this.imagePreview.set(URL.createObjectURL(file));
    this.imagePosition.set({ x: 50, y: 50 });
  }

  // --- Audio preview (play/stop the selected sound before saving) ---

  protected togglePreview() {
    if (this.previewPlaying()) {
      this.previewAudio.pause();
      this.previewAudio.currentTime = 0;
    } else {
      this.previewAudio.currentTime = 0;
      void this.previewAudio.play();
    }
  }

  /** Swaps the preview source, revoking the previous object URL and stopping playback. */
  private setPreviewUrl(url: string | null) {
    const prev = this.audioPreviewUrl();
    this.previewAudio.pause();
    this.previewAudio.currentTime = 0;
    this.previewPlaying.set(false);
    this.playback.end(this);
    if (prev) URL.revokeObjectURL(prev);
    this.audioPreviewUrl.set(url);
    if (url) this.previewAudio.src = url;
    else this.previewAudio.removeAttribute('src');
  }

  async save() {
    const prepared = this.preparedAudio();
    if (!prepared && !this.audioFile()) {
      this.message.warning('Seleziona prima un file audio.');
      return;
    }
    if (!this.name().trim()) {
      this.message.warning('Inserisci un nome per il jingle.');
      return;
    }

    this.saving.set(true);
    try {
      await this.library.save({
        name: this.name().trim(),
        tags: this.tags(),
        color: this.color(),
        volume: this.volume(),
        triggerPhrase: this.triggerPhrase().trim(),
        durationSec: this.audioDuration(),
        imageFile: this.imageFile() ?? undefined,
        imagePosition: this.imageFile() ? this.imagePosition() : undefined,
        ...(prepared
          ? { audioBlob: prepared.audioBlob, audioFilename: prepared.audioFilename }
          : { audioBlob: this.audioFile()!, audioFilename: this.audioFile()!.name }),
      });
      this.message.success('Jingle salvato!');
      this.visible.set(false);
      this.saved.emit();
    } catch (err) {
      console.error(err);
      this.message.error('Salvataggio fallito. Controlla la configurazione Cloudinary.');
    } finally {
      this.saving.set(false);
    }
  }

  private reset() {
    this.name.set('');
    this.tags.set([]);
    this.color.set(JINGLE_COLORS[0]);
    this.volume.set(100);
    this.triggerPhrase.set('');
    this.audioFile.set(null);
    this.imageFile.set(null);
    const prevImg = this.imagePreview();
    if (prevImg) URL.revokeObjectURL(prevImg);
    this.imagePreview.set(null);
    this.imagePosition.set({ x: 50, y: 50 });
    this.setPreviewUrl(null);
    this.audioDuration.set(0);
    this.preparedAudio.set(null);
  }

  ngOnDestroy() {
    const prevImg = this.imagePreview();
    if (prevImg) URL.revokeObjectURL(prevImg);
    this.setPreviewUrl(null);
  }
}

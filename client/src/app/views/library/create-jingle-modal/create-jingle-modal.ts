import { Component, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSpinModule } from 'ng-zorro-antd/spin';

import { JINGLE_COLORS, LibraryService } from '../../../core/library.service';
import { UiButton } from '../../../ui/button/button';
import { UiColorPicker } from '../../../ui/color-picker/color-picker';
import { UiTagInput } from '../../../ui/tag-input/tag-input';

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
    NzSpinModule,
    UiButton,
    UiColorPicker,
    UiTagInput,
  ],
  templateUrl: './create-jingle-modal.html',
})
export class CreateJingleModal {
  private readonly library = inject(LibraryService);
  private readonly message = inject(NzMessageService);

  readonly saved = output<void>();

  protected readonly visible = signal(false);

  protected name = signal('');
  protected tags = signal<string[]>([]);
  protected color = signal<string>(JINGLE_COLORS[0]);
  protected audioFile = signal<File | null>(null);
  protected imageFile = signal<File | null>(null);
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

    const audio = new Audio(URL.createObjectURL(file));
    audio.addEventListener('loadedmetadata', () => {
      this.audioDuration.set(isFinite(audio.duration) ? audio.duration : 0);
      URL.revokeObjectURL(audio.src);
    });
  }

  protected onImageSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.imageFile.set(file);
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
        durationSec: this.audioDuration(),
        imageFile: this.imageFile() ?? undefined,
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
    this.audioFile.set(null);
    this.imageFile.set(null);
    this.audioDuration.set(0);
    this.preparedAudio.set(null);
  }
}

import { Component, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';

import { JINGLE_COLORS, LibraryService } from '../../../core/library.service';

@Component({
  selector: 'app-create-jingle-modal',
  imports: [FormsModule, NzIconModule, NzInputModule, NzModalModule, NzSpinModule, NzTagModule],
  templateUrl: './create-jingle-modal.html',
})
export class CreateJingleModal {
  private readonly library = inject(LibraryService);
  private readonly message = inject(NzMessageService);

  readonly saved = output<void>();

  protected readonly colors = JINGLE_COLORS;
  protected readonly visible = signal(false);

  protected name = signal('');
  protected tagInput = signal('');
  protected tags = signal<string[]>([]);
  protected color = signal<string>(JINGLE_COLORS[0]);
  protected audioFile = signal<File | null>(null);
  protected imageFile = signal<File | null>(null);
  protected saving = signal(false);
  protected audioDuration = signal(0);

  open() {
    this.reset();
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

  protected addTag() {
    const raw = this.tagInput().trim().toLowerCase();
    if (raw && !this.tags().includes(raw)) {
      this.tags.update((t) => [...t, raw]);
    }
    this.tagInput.set('');
  }

  protected removeTag(tag: string) {
    this.tags.update((t) => t.filter((x) => x !== tag));
  }

  protected onTagKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.addTag();
    }
  }

  protected selectColor(c: string) {
    this.color.set(c);
  }

  async save() {
    if (!this.audioFile()) {
      this.message.warning('Select an audio file first.');
      return;
    }
    if (!this.name().trim()) {
      this.message.warning('Enter a name for the jingle.');
      return;
    }

    this.saving.set(true);
    try {
      await this.library.save({
        name: this.name().trim(),
        tags: this.tags(),
        color: this.color(),
        audioBlob: this.audioFile()!,
        audioFilename: this.audioFile()!.name,
        durationSec: this.audioDuration(),
        imageFile: this.imageFile() ?? undefined,
      });
      this.message.success('Jingle saved!');
      this.visible.set(false);
      this.saved.emit();
    } catch (err) {
      console.error(err);
      this.message.error('Upload failed. Check your Cloudinary configuration.');
    } finally {
      this.saving.set(false);
    }
  }

  private reset() {
    this.name.set('');
    this.tagInput.set('');
    this.tags.set([]);
    this.color.set(JINGLE_COLORS[0]);
    this.audioFile.set(null);
    this.imageFile.set(null);
    this.audioDuration.set(0);
  }
}

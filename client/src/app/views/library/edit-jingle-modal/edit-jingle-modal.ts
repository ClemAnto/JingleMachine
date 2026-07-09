import { Component, OnDestroy, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzSliderModule } from 'ng-zorro-antd/slider';
import { NzSpinModule } from 'ng-zorro-antd/spin';

import { ImagePosition, Jingle, JINGLE_COLORS, LibraryService } from '../../../core/library.service';
import { UiButton } from '../../../ui/button/button';
import { UiColorPicker } from '../../../ui/color-picker/color-picker';
import { UiImagePicker } from '../../../ui/image-picker/image-picker';
import { UiTagInput } from '../../../ui/tag-input/tag-input';
import { TriggerPhraseField } from '../trigger-phrase-field/trigger-phrase-field';

@Component({
  selector: 'app-edit-jingle-modal',
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
  templateUrl: './edit-jingle-modal.html',
})
export class EditJingleModal implements OnDestroy {
  private readonly library = inject(LibraryService);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);

  readonly saved = output<void>();
  readonly deleted = output<void>();

  protected readonly visible = signal(false);
  private jingle: Jingle | null = null;

  protected name = signal('');
  protected tags = signal<string[]>([]);
  protected color = signal<string>(JINGLE_COLORS[0]);
  /** Playback volume 0–100 applied when the jingle is played from its card. */
  protected volume = signal(100);
  /** Spoken word/phrase that fires this jingle when voice mode is on. Empty = none. */
  protected triggerPhrase = signal('');
  protected imageFile = signal<File | null>(null);
  // Preview: the current cover on open, or the newly picked file once selected.
  protected imagePreview = signal<string | null>(null);
  protected imagePosition = signal<ImagePosition>({ x: 50, y: 50 });
  private objectUrl: string | null = null;
  protected saving = signal(false);

  open(jingle: Jingle) {
    this.jingle = jingle;
    this.name.set(jingle.name);
    this.tags.set([...jingle.tags]);
    this.color.set(jingle.color);
    this.volume.set(jingle.volume ?? 100);
    this.triggerPhrase.set(jingle.triggerPhrase ?? '');
    this.imageFile.set(null);
    this.revokeObjectUrl();
    this.imagePreview.set(jingle.imageUrl ?? null);
    this.imagePosition.set(jingle.imagePosition ?? { x: 50, y: 50 });
    this.visible.set(true);
  }

  protected close() {
    this.revokeObjectUrl();
    this.visible.set(false);
  }

  /** Cover image picked (or replaced): reframe from centre. */
  protected onImageSelected(file: File) {
    this.revokeObjectUrl();
    this.objectUrl = URL.createObjectURL(file);
    this.imageFile.set(file);
    this.imagePreview.set(this.objectUrl);
    this.imagePosition.set({ x: 50, y: 50 });
  }

  private revokeObjectUrl() {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }

  ngOnDestroy() {
    this.revokeObjectUrl();
  }

  protected confirmDelete() {
    const jingle = this.jingle;
    if (!jingle) return;
    this.modal.confirm({
      nzTitle: `Eliminare "${jingle.name}"?`,
      nzContent: 'Questa azione non può essere annullata.',
      nzOkText: 'Elimina',
      nzOkDanger: true,
      nzOnOk: () => this.delete(jingle),
    });
  }

  private async delete(jingle: Jingle) {
    this.saving.set(true);
    try {
      await this.library.remove(jingle);
      this.message.success('Eliminato.');
      this.visible.set(false);
      this.deleted.emit();
    } catch (err) {
      console.error(err);
      this.message.error('Eliminazione non riuscita.');
    } finally {
      this.saving.set(false);
    }
  }

  async save() {
    if (!this.jingle || !this.name().trim()) {
      this.message.warning('Inserisci un nome per il jingle.');
      return;
    }
    this.saving.set(true);
    try {
      await this.library.update(this.jingle, {
        name: this.name().trim(),
        tags: this.tags(),
        color: this.color(),
        volume: this.volume(),
        triggerPhrase: this.triggerPhrase().trim(),
        imageFile: this.imageFile() ?? undefined,
        imagePosition: this.imagePreview() ? this.imagePosition() : undefined,
      });
      this.message.success('Jingle aggiornato!');
      this.visible.set(false);
      this.saved.emit();
    } catch (err) {
      console.error(err);
      this.message.error('Aggiornamento non riuscito.');
    } finally {
      this.saving.set(false);
    }
  }
}

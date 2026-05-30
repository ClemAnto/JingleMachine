import { Component, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';

import { JINGLE_COLORS, Jingle, LibraryService } from '../../../core/library.service';

@Component({
  selector: 'app-edit-jingle-modal',
  imports: [FormsModule, NzIconModule, NzInputModule, NzModalModule, NzSpinModule, NzTagModule],
  templateUrl: './edit-jingle-modal.html',
})
export class EditJingleModal {
  private readonly library = inject(LibraryService);
  private readonly message = inject(NzMessageService);

  readonly saved = output<void>();

  protected readonly colors = JINGLE_COLORS;
  protected readonly visible = signal(false);
  private jingle: Jingle | null = null;

  protected name = signal('');
  protected tagInput = signal('');
  protected tags = signal<string[]>([]);
  protected color = signal<string>(JINGLE_COLORS[0]);
  protected imageFile = signal<File | null>(null);
  protected saving = signal(false);

  open(jingle: Jingle) {
    this.jingle = jingle;
    this.name.set(jingle.name);
    this.tags.set([...jingle.tags]);
    this.color.set(jingle.color);
    this.imageFile.set(null);
    this.tagInput.set('');
    this.visible.set(true);
  }

  protected close() {
    this.visible.set(false);
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
    if (!this.jingle || !this.name().trim()) {
      this.message.warning('Enter a name for the jingle.');
      return;
    }
    this.saving.set(true);
    try {
      await this.library.update(this.jingle, {
        name: this.name().trim(),
        tags: this.tags(),
        color: this.color(),
        imageFile: this.imageFile() ?? undefined,
      });
      this.message.success('Jingle updated!');
      this.visible.set(false);
      this.saved.emit();
    } catch (err) {
      console.error(err);
      this.message.error('Update failed.');
    } finally {
      this.saving.set(false);
    }
  }
}

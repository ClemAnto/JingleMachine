import { Component, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSpinModule } from 'ng-zorro-antd/spin';

import { Jingle, JINGLE_COLORS, LibraryService } from '../../../core/library.service';
import { UiButton } from '../../../ui/button/button';
import { UiColorPicker } from '../../../ui/color-picker/color-picker';
import { UiTagInput } from '../../../ui/tag-input/tag-input';

@Component({
  selector: 'app-edit-jingle-modal',
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
  templateUrl: './edit-jingle-modal.html',
})
export class EditJingleModal {
  private readonly library = inject(LibraryService);
  private readonly message = inject(NzMessageService);

  readonly saved = output<void>();

  protected readonly visible = signal(false);
  private jingle: Jingle | null = null;

  protected name = signal('');
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
    this.visible.set(true);
  }

  protected close() {
    this.visible.set(false);
  }

  protected onImageSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.imageFile.set(file);
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

import { Component, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzTagModule } from 'ng-zorro-antd/tag';

/**
 * Reusable tag editor: type + Enter (or comma) to add, click to remove.
 * Usage: <ui-tag-input [(tags)]="tags" />
 */
@Component({
  selector: 'ui-tag-input',
  imports: [FormsModule, NzIconModule, NzInputModule, NzTagModule],
  template: `
    <div class="space-y-2">
      <nz-input-group [nzSuffix]="suffix">
        <input
          nz-input
          placeholder="Aggiungi tag (invio per confermare)"
          [ngModel]="draft()"
          (ngModelChange)="draft.set($event)"
          (keydown)="onKeydown($event)"
        />
      </nz-input-group>
      <ng-template #suffix>
        <span nz-icon nzType="tag" class="text-white/45 cursor-pointer" (click)="add()"></span>
      </ng-template>

      @if (tags().length) {
        <div class="flex flex-wrap gap-2">
          @for (tag of tags(); track tag) {
            <nz-tag nzMode="closeable" (nzOnClose)="remove(tag)">{{ tag }}</nz-tag>
          }
        </div>
      }
    </div>
  `,
})
export class UiTagInput {
  readonly tags = model<string[]>([]);
  protected readonly draft = signal('');

  protected add() {
    const raw = this.draft().trim().toLowerCase();
    if (raw && !this.tags().includes(raw)) {
      this.tags.update((t) => [...t, raw]);
    }
    this.draft.set('');
  }

  protected remove(tag: string) {
    this.tags.update((t) => t.filter((x) => x !== tag));
  }

  protected onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.add();
    }
  }
}

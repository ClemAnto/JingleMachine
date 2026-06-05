import { Component, input, model } from '@angular/core';

import { JINGLE_COLORS } from '../../core/library.service';

/**
 * Reusable colour swatch picker (Figma card-accent palette).
 * Usage: <ui-color-picker [(value)]="color" />
 */
@Component({
  selector: 'ui-color-picker',
  template: `
    <div class="flex gap-3 flex-wrap">
      @for (c of colors(); track c) {
        <button
          type="button"
          class="w-8 h-8 rounded-full border-2 transition-all cursor-pointer"
          [style.background]="c"
          [class.border-white]="value() === c"
          [class.border-transparent]="value() !== c"
          (click)="value.set(c)"
        ></button>
      }
    </div>
  `,
})
export class UiColorPicker {
  readonly colors = input<readonly string[]>(JINGLE_COLORS);
  readonly value = model<string>(JINGLE_COLORS[0]);
}

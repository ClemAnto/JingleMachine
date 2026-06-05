import { Component, input } from '@angular/core';

/** Figma-styled button variants (defined as global classes in styles.css). */
export type UiButtonVariant = 'primary' | 'youtube' | 'neutral' | 'alert';

/**
 * Reusable Figma-styled button.
 * Attribute selector (like ng-zorro's `[nz-button]`) so the host stays a native
 * <button>, keeping click/disabled/type/routerLink behaviour for free.
 *
 * Usage: <button ui-button variant="youtube" (click)="...">Label</button>
 * Extra utility classes on the element are preserved (e.g. class="w-full justify-center").
 */
@Component({
  selector: 'button[ui-button]',
  template: '<ng-content />',
  host: {
    '[class.jm-btn-primary]': "variant() === 'primary'",
    '[class.jm-btn-youtube]': "variant() === 'youtube'",
    '[class.jm-btn-neutral]': "variant() === 'neutral'",
    '[class.jm-btn-alert]': "variant() === 'alert'",
  },
})
export class UiButton {
  readonly variant = input<UiButtonVariant>('primary');
}

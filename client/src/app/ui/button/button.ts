import { Component, computed, input } from '@angular/core';

/** Figma-styled button variants, driven by theme tokens (no custom CSS classes). */
export type UiButtonVariant = 'primary' | 'youtube' | 'neutral' | 'alert';

/** Shared shape: pill, comfortable height, large label. */
const BASE =
  'inline-flex items-center justify-center gap-2 h-(--control-height) px-5 ' +
  'rounded-full text-xl font-semibold cursor-pointer border-0 transition ' +
  'active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed';

/** Per-variant colours, all from theme tokens. */
const VARIANTS: Record<UiButtonVariant, string> = {
  primary: 'bg-primary text-on-primary hover:opacity-90',
  youtube: 'bg-danger text-on-danger hover:opacity-90',
  neutral: 'bg-control text-fg hover:opacity-90',
  alert: 'bg-transparent text-danger border border-danger/40 hover:bg-danger/10',
};

/**
 * Reusable themed button. Attribute selector (like `[nz-button]`) so the host
 * stays a native <button>, keeping click/disabled/type/routerLink for free.
 * Usage: <button ui-button variant="youtube">Label</button>
 * Extra utility classes on the element are preserved (Angular merges them).
 */
@Component({
  selector: 'button[ui-button]',
  template: '<ng-content />',
  host: { '[class]': 'classes()' },
})
export class UiButton {
  readonly variant = input<UiButtonVariant>('primary');
  protected readonly classes = computed(() => `${BASE} ${VARIANTS[this.variant()]}`);
}

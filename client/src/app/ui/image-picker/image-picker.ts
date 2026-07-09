import { Component, computed, input, model, output } from '@angular/core';

import { NzIconModule } from 'ng-zorro-antd/icon';

import { ImagePosition } from '../../core/library.service';

/**
 * Cover-image picker: pick a file, then drag the preview to reframe it.
 *
 * The framing is stored as `object-position` percentages (two-way `position`);
 * the same values drive `background-position` on the jingle card so the crop
 * the user sees here is exactly what the card shows. When an image is present a
 * small button (top-right) replaces it; the rest of the area is the drag surface.
 * Sizing comes from the parent via `heightClass` (min-height) + flex stretch.
 */
@Component({
  selector: 'ui-image-picker',
  imports: [NzIconModule],
  templateUrl: './image-picker.html',
  host: { class: 'block' },
})
export class UiImagePicker {
  /** Preview URL: the existing cover or an object URL of the picked file. */
  readonly src = input<string | null>(null);
  /** Framing as object-position percentages (0–100), two-way. */
  readonly position = model<ImagePosition>({ x: 50, y: 50 });
  /** Placeholder label shown in the empty state. */
  readonly emptyLabel = input('Carica immagine');
  /** Tailwind min-height utility for the box (e.g. "min-h-24", "min-h-32"). */
  readonly heightClass = input('min-h-32');

  /** Emitted when the user picks (or replaces) the image file. */
  readonly fileSelected = output<File>();

  protected readonly objectPosition = computed(() => `${this.position().x}% ${this.position().y}%`);
  protected readonly rootClass = computed(
    () =>
      `relative w-full h-full overflow-hidden rounded-lg select-none ${this.heightClass()} ` +
      (this.src() ? 'border border-primary/40' : ''),
  );

  // Pointer offset + starting position captured on drag start.
  private dragFrom: { px: number; py: number; x: number; y: number } | null = null;

  protected onFile(event: Event) {
    const el = event.target as HTMLInputElement;
    const file = el.files?.[0];
    el.value = ''; // allow re-selecting the same file later
    if (file) this.fileSelected.emit(file);
  }

  protected onPointerDown(event: PointerEvent) {
    event.preventDefault();
    try {
      (event.target as HTMLElement).setPointerCapture(event.pointerId);
    } catch {
      // no active pointer (e.g. synthetic event) — drag still works via events
    }
    const p = this.position();
    this.dragFrom = { px: event.clientX, py: event.clientY, x: p.x, y: p.y };
  }

  protected onPointerMove(event: PointerEvent) {
    if (!this.dragFrom) return;
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    // Dragging the image right reveals its left part → object-position x decreases.
    const x = clamp(this.dragFrom.x - ((event.clientX - this.dragFrom.px) / box.width) * 100);
    const y = clamp(this.dragFrom.y - ((event.clientY - this.dragFrom.py) / box.height) * 100);
    this.position.set({ x: Math.round(x), y: Math.round(y) });
  }

  protected onPointerUp() {
    this.dragFrom = null;
  }
}

function clamp(value: number): number {
  return Math.min(100, Math.max(0, value));
}

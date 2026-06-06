import {
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  afterNextRender,
  effect,
  inject,
  input,
  model,
  viewChild,
} from '@angular/core';

/** Default label: seconds → m:ss (e.g. 345 → "5:45"). */
const TO_MMSS = (total: number): string => {
  const minutes = Math.floor(total / 60);
  const seconds = Math.floor(total % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

/**
 * Dual-handle trim slider (YouTube import) — matches the Figma video-trimmer:
 * a thick rail, a brighter selected fill that wraps both handles, and a time pill
 * under each handle.
 *
 * Positioning is data-driven: JS only sets two CSS custom properties (`--s`/`--e`,
 * the handle centres in px) on the root; the template's static CSS does the clamp +
 * translateX. While dragging, those vars are written OUTSIDE Angular's zone for a
 * jank-free drag; `value` (which feeds the pill text + the parent) is committed only
 * when the displayed second changes, so the labels stay declarative. On release the
 * value snaps to `step`.
 *
 * Usage: <ui-trim-slider [max]="405" [step]="0.1" [(value)]="trim" [format]="formatSeconds" />
 */
@Component({
  selector: 'ui-trim-slider',
  templateUrl: './trim-slider.html',
})
export class UiTrimSlider {
  /** Clip length in seconds — the slider spans 0…max. */
  readonly max = input(100);
  /** Two-way [start, end] in seconds. */
  readonly value = model<[number, number]>([0, 0]);
  /** Formatter for the time pills. */
  readonly format = input<(seconds: number) => string>(TO_MMSS);
  /** Snap granularity (seconds) applied on release — e.g. 0.1 for tenths, 1 for whole seconds. */
  readonly step = input(1);

  private readonly zone = inject(NgZone);
  private readonly root = viewChild.required<ElementRef<HTMLElement>>('root');
  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');
  private readonly startHandle = viewChild.required<ElementRef<HTMLElement>>('startHandle');
  private readonly endHandle = viewChild.required<ElementRef<HTMLElement>>('endHandle');
  private readonly startPill = viewChild.required<ElementRef<HTMLElement>>('startPill');
  private readonly endPill = viewChild.required<ElementRef<HTMLElement>>('endPill');

  private trackWidth = 0;
  private dragging: number | null = null;
  private trackRect: DOMRect | null = null;
  // Live working copy during a drag (Angular's value() is only synced on release).
  private dragStart = 0;
  private dragEnd = 0;

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      const trackEl = this.track().nativeElement;
      this.setTrackWidth(trackEl.getBoundingClientRect().width);

      const resize = new ResizeObserver(() => this.setTrackWidth(trackEl.getBoundingClientRect().width));
      resize.observe(trackEl);

      // Bind once, outside the zone → no change detection per pointermove, no per-drag churn.
      const handles = [this.startHandle().nativeElement, this.endHandle().nativeElement];
      this.zone.runOutsideAngular(() => {
        for (const el of handles) {
          el.addEventListener('pointermove', this.onMove);
          el.addEventListener('pointerup', this.onEnd);
          el.addEventListener('pointercancel', this.onEnd);
        }
      });

      destroyRef.onDestroy(() => {
        resize.disconnect();
        for (const el of handles) {
          el.removeEventListener('pointermove', this.onMove);
          el.removeEventListener('pointerup', this.onEnd);
          el.removeEventListener('pointercancel', this.onEnd);
        }
      });
    });

    // Reposition when the value (or max) changes outside a drag.
    effect(() => {
      const [start, end] = this.value();
      this.positionTo(start, end);
    });
  }

  protected startDrag(handle: number, event: PointerEvent): void {
    event.preventDefault();
    this.dragging = handle;
    [this.dragStart, this.dragEnd] = this.value();
    this.trackRect = this.track().nativeElement.getBoundingClientRect();
    // Capture so move/up keep firing on this handle even if the pointer leaves it.
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  private readonly onMove = (event: PointerEvent): void => {
    if (this.dragging === null || !this.trackRect) return;
    const ratio = Math.min(1, Math.max(0, (event.clientX - this.trackRect.left) / this.trackRect.width));
    const seconds = ratio * this.max();
    // Each handle is clamped by the other so the range never inverts.
    if (this.dragging === 0) this.dragStart = Math.min(seconds, this.dragEnd);
    else this.dragEnd = Math.max(seconds, this.dragStart);

    // Fully outside the zone: move the handles (CSS vars) and update the pill labels
    // directly. No signal write → no app-wide change detection → fluid on any page.
    this.positionTo(this.dragStart, this.dragEnd);
    const fmt = this.format();
    this.startPill().nativeElement.textContent = fmt(this.dragStart);
    this.endPill().nativeElement.textContent = fmt(this.dragEnd);
  };

  private readonly onEnd = (): void => {
    if (this.dragging === null) return;
    this.dragging = null;
    this.trackRect = null;
    // Snap to the step granularity and sync the signal once, back inside the zone.
    this.zone.run(() => this.value.set([this.snap(this.dragStart), this.snap(this.dragEnd)]));
  };

  /** Writes the two handle centres (px) as CSS vars on the root; CSS clamps + translates. */
  private positionTo(startSeconds: number, endSeconds: number): void {
    if (!this.trackWidth) return;
    const max = this.max() || 1;
    const style = this.root().nativeElement.style;
    style.setProperty('--s', (startSeconds / max) * this.trackWidth + 'px');
    style.setProperty('--e', (endSeconds / max) * this.trackWidth + 'px');
  }

  private setTrackWidth(width: number): void {
    this.trackWidth = width;
    this.root().nativeElement.style.setProperty('--tw', width + 'px');
    const [start, end] = this.value();
    this.positionTo(start, end);
  }

  /** Round to the configured step, clearing float noise (e.g. 5.300000001 → 5.3). */
  private snap(seconds: number): number {
    const step = this.step();
    if (step <= 0) return seconds;
    return Math.round(Math.round(seconds / step) * step * 1000) / 1000;
  }
}

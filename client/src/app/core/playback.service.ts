import { Injectable, computed, signal } from '@angular/core';

/**
 * Single source of truth for "is any jingle currently playing?".
 *
 * Playback is spread across independent <audio> elements — each library card
 * (JingleItem), the SchedulerService, and the VoiceTriggerService each own one —
 * so no single element knows about the others. Every source reports begin/end
 * here (keyed by its own object token), and the voice trigger reads `isPlaying`
 * to inhibit recognition while a jingle sounds: this prevents the microphone
 * from re-hearing the jingle and firing itself (echo / self-trigger).
 */
@Injectable({ providedIn: 'root' })
export class PlaybackService {
  private readonly active = new Set<object>();
  private readonly activeCount = signal(0);

  /** True while at least one jingle is playing (any source). */
  readonly isPlaying = computed(() => this.activeCount() > 0);

  /** Report that `source` started playing. */
  begin(source: object): void {
    this.active.add(source);
    this.activeCount.set(this.active.size);
  }

  /** Report that `source` stopped or ended. */
  end(source: object): void {
    if (this.active.delete(source)) this.activeCount.set(this.active.size);
  }
}

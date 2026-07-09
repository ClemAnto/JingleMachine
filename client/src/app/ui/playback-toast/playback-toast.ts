import { Component, computed, inject } from '@angular/core';

import { NzIconModule } from 'ng-zorro-antd/icon';

import { SchedulerService } from '../../core/scheduler.service';
import { VoiceTriggerService } from '../../core/voice-trigger.service';

/**
 * Bottom-right "now playing" toast, shown for a scheduled fire (10s countdown →
 * playback, with "Blocca") and a voice-recognized fire (playback only, with
 * "Interrompi") — the same alert for both. Scheduler wins if both fire at once.
 *
 * Rendered in the app shell (a sibling of <router-outlet>), NOT inside a routed
 * view: the view hosts carry a `route-enter` transform animation, and a
 * transformed ancestor turns `position: fixed` into "fixed relative to that
 * ancestor" (the toast would scroll off-screen). Living at the shell root keeps
 * it truly anchored to the viewport.
 */
@Component({
  selector: 'ui-playback-toast',
  imports: [NzIconModule],
  templateUrl: './playback-toast.html',
})
export class PlaybackToast {
  private readonly scheduler = inject(SchedulerService);
  private readonly voice = inject(VoiceTriggerService);

  protected readonly fire = computed(() => this.scheduler.pending() ?? this.voice.pending());
  protected readonly fromVoice = computed(
    () => !this.scheduler.pending() && !!this.voice.pending(),
  );

  protected cancel() {
    if (this.scheduler.pending()) this.scheduler.cancel();
    else this.voice.stopPlayback();
  }
}

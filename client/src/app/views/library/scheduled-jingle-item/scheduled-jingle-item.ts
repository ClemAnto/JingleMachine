import {
  Component,
  ElementRef,
  OnDestroy,
  computed,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { NgStyle } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { NzDropdownModule } from 'ng-zorro-antd/dropdown';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzSwitchModule } from 'ng-zorro-antd/switch';

import { cloudinaryImageThumb } from '../../../core/cloudinary.service';
import { Jingle } from '../../../core/library.service';
import { ScheduledJingle } from '../../../core/schedule.service';

/** One card in the "Programmati" list: looks exactly like a normal jingle card,
 *  plus the scheduled time, an "Ogni giorno" badge and an on/off toggle. Editing
 *  here changes the schedule (time + repeat flag), not the jingle itself. */
@Component({
  selector: 'app-scheduled-jingle-item',
  imports: [FormsModule, NgStyle, NzDropdownModule, NzIconModule, NzSwitchModule],
  templateUrl: './scheduled-jingle-item.html',
  host: { class: 'block w-full' },
})
export class ScheduledJingleItem implements OnDestroy {
  readonly entry = input.required<ScheduledJingle>();
  // The referenced jingle, resolved by the parent (undefined if it was deleted).
  readonly jingle = input<Jingle | undefined>(undefined);

  readonly editRequest = output<ScheduledJingle>();
  readonly deleteRequest = output<ScheduledJingle>();
  readonly toggleRequest = output<ScheduledJingle>();

  private readonly audioEl = viewChild<ElementRef<HTMLAudioElement>>('audioEl');

  protected readonly playing = signal(false);
  protected readonly progress = signal(0); // 0–100

  protected readonly name = computed(() => this.jingle()?.name ?? 'Jingle non disponibile');
  // Missing `enabled` (older docs) counts as active.
  protected readonly enabled = computed(() => this.entry().enabled !== false);

  protected readonly cardStyle = computed(() => {
    const j = this.jingle();
    const c = j?.color ?? '#444444';
    const base = j?.imageUrl ? `url(${cloudinaryImageThumb(j.imageUrl)})` : 'none';
    return {
      'background-image': base,
      'background-size': 'cover',
      'background-position': 'center',
      'border-color': c,
      '--card-color': c,
    };
  });

  protected readonly overlayStyle = computed(() => {
    const c = this.jingle()?.color ?? '#444444';
    return {
      background: `linear-gradient(226deg, ${c}00 0%, ${c} 100%)`,
    };
  });

  togglePlay() {
    const el = this.audioEl()?.nativeElement;
    if (!el || !this.jingle()?.audioUrl) return;

    if (this.playing()) {
      // Jingles are never paused: a click on a playing jingle stops it.
      el.pause();
      el.currentTime = 0;
      this.progress.set(0);
    } else {
      el.volume = (this.jingle()?.volume ?? 100) / 100;
      el.currentTime = 0;
      el.play();
    }
  }

  protected onPlay() {
    this.playing.set(true);
  }

  protected onPause() {
    this.playing.set(false);
  }

  protected onEnded() {
    this.playing.set(false);
    this.progress.set(0);
    const el = this.audioEl()?.nativeElement;
    if (el) el.currentTime = 0;
  }

  protected onTimeUpdate(event: Event) {
    const el = event.target as HTMLAudioElement;
    if (el.duration) {
      this.progress.set((el.currentTime / el.duration) * 100);
    }
  }

  ngOnDestroy() {
    this.audioEl()?.nativeElement.pause();
  }
}

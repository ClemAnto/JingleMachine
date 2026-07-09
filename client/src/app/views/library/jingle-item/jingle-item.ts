import {
  Component,
  ElementRef,
  OnDestroy,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { NgStyle } from '@angular/common';

import { NzDropdownModule } from 'ng-zorro-antd/dropdown';
import { NzIconModule } from 'ng-zorro-antd/icon';

import { cloudinaryImageThumb } from '../../../core/cloudinary.service';
import { Jingle } from '../../../core/library.service';
import { PlaybackService } from '../../../core/playback.service';

@Component({
  selector: 'app-jingle-item',
  imports: [NgStyle, NzDropdownModule, NzIconModule],
  templateUrl: './jingle-item.html',
  host: { class: 'block w-full' },
})
export class JingleItem implements OnDestroy {
  readonly jingle = input.required<Jingle>();

  readonly editRequest = output<Jingle>();
  readonly scheduleRequest = output<Jingle>();

  private readonly playback = inject(PlaybackService);
  private readonly audioEl = viewChild<ElementRef<HTMLAudioElement>>('audioEl');

  protected readonly playing = signal(false);
  protected readonly progress = signal(0); // 0–100

  protected readonly cardStyle = computed(() => {
    const j = this.jingle();
    const c = j.color;
    const base = j.imageUrl
      ? `url(${cloudinaryImageThumb(j.imageUrl)})`
      : 'none';
    const pos = j.imagePosition;
    return {
      'background-image': base,
      'background-size': 'cover',
      'background-position': pos ? `${pos.x}% ${pos.y}%` : 'center',
      'border-color': c,
      '--card-color': c,
    };
  });

  protected readonly overlayStyle = computed(() => {
    const c = this.jingle().color;
    return {
      background: `linear-gradient(226deg, ${c}00 0%, ${c} 100%)`,
    };
  });

  togglePlay() {
    const el = this.audioEl()?.nativeElement;
    if (!el) return;

    if (this.playing()) {
      // Jingles are never paused: a click on a playing jingle stops it.
      el.pause();
      el.currentTime = 0;
      this.progress.set(0);
    } else {
      // Per-jingle playback volume (0–100, set in the create/edit form; default full).
      el.volume = (this.jingle().volume ?? 100) / 100;
      // Always (re)start from the beginning.
      el.currentTime = 0;
      el.play();
    }
  }

  protected onPlay() {
    this.playing.set(true);
    this.playback.begin(this);
  }

  protected onPause() {
    this.playing.set(false);
    this.playback.end(this);
  }

  protected onEnded() {
    this.playing.set(false);
    this.progress.set(0);
    this.playback.end(this);
    // Rewind so the next listen always starts from the beginning.
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
    this.playback.end(this);
  }
}

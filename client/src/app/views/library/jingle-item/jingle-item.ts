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

import { NzIconModule } from 'ng-zorro-antd/icon';

import { cloudinaryImageThumb } from '../../../core/cloudinary.service';
import { Jingle } from '../../../core/library.service';

@Component({
  selector: 'app-jingle-item',
  imports: [NgStyle, NzIconModule],
  templateUrl: './jingle-item.html',
  host: { class: 'block w-full' },
})
export class JingleItem implements OnDestroy {
  readonly jingle = input.required<Jingle>();

  readonly editRequest = output<Jingle>();
  readonly deleteRequest = output<Jingle>();

  private readonly audioEl = viewChild<ElementRef<HTMLAudioElement>>('audioEl');

  protected readonly playing = signal(false);
  protected readonly progress = signal(0); // 0–100

  protected readonly cardStyle = computed(() => {
    const j = this.jingle();
    const c = j.color;
    const base = j.imageUrl
      ? `url(${cloudinaryImageThumb(j.imageUrl)})`
      : 'none';
    return {
      'background-image': base,
      'background-size': 'cover',
      'background-position': 'center',
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
  }

  protected onPause() {
    this.playing.set(false);
  }

  protected onEnded() {
    this.playing.set(false);
    this.progress.set(0);
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
  }
}

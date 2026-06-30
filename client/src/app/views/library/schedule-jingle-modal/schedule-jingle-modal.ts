import { Component, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTimePickerModule } from 'ng-zorro-antd/time-picker';

import { Jingle } from '../../../core/library.service';
import { ScheduledJingle, ScheduleService } from '../../../core/schedule.service';
import { UiButton } from '../../../ui/button/button';

@Component({
  selector: 'app-schedule-jingle-modal',
  imports: [
    FormsModule,
    NzIconModule,
    NzModalModule,
    NzSwitchModule,
    NzTimePickerModule,
    UiButton,
  ],
  templateUrl: './schedule-jingle-modal.html',
})
export class ScheduleJingleModal {
  private readonly schedule = inject(ScheduleService);
  private readonly message = inject(NzMessageService);

  readonly saved = output<void>();

  protected readonly visible = signal(false);
  protected readonly editing = signal(false);
  // Create mode: the jingle to schedule. Edit mode: the entry being changed.
  private jingleId: string | null = null;
  private entryId: string | null = null;
  protected readonly jingleName = signal('');

  // nz-time-picker works with a Date; only HH:mm is kept on save.
  protected readonly time = signal<Date | null>(null);
  protected readonly repeatDaily = signal(false);
  protected readonly saving = signal(false);

  /** Create mode: schedule a brand-new play for this jingle. */
  open(jingle: Jingle) {
    this.editing.set(false);
    this.entryId = null;
    this.jingleId = jingle.id;
    this.jingleName.set(jingle.name);
    this.time.set(new Date());
    this.repeatDaily.set(false);
    this.visible.set(true);
  }

  /** Edit mode: change only the time + repeat flag of an existing entry. */
  openForEdit(entry: ScheduledJingle, jingleName: string) {
    this.editing.set(true);
    this.entryId = entry.id;
    this.jingleId = entry.jingleId;
    this.jingleName.set(jingleName);
    this.time.set(parseTime(entry.time));
    this.repeatDaily.set(entry.repeatDaily);
    this.visible.set(true);
  }

  protected close() {
    this.visible.set(false);
  }

  async save() {
    const time = this.time();
    if (!time) {
      this.message.warning('Scegli un orario.');
      return;
    }

    const hh = String(time.getHours()).padStart(2, '0');
    const mm = String(time.getMinutes()).padStart(2, '0');
    const ss = String(time.getSeconds()).padStart(2, '0');
    const value = `${hh}:${mm}:${ss}`;

    this.saving.set(true);
    try {
      if (this.editing() && this.entryId) {
        await this.schedule.update(this.entryId, value, this.repeatDaily());
        this.message.success('Programmazione aggiornata!');
      } else if (this.jingleId) {
        await this.schedule.add(this.jingleId, value, this.repeatDaily());
        this.message.success('Jingle programmato!');
      }
      this.visible.set(false);
      this.saved.emit();
    } catch (err) {
      console.error(err);
      this.message.error('Programmazione non riuscita.');
    } finally {
      this.saving.set(false);
    }
  }
}

/** Builds a Date for today at the given "HH:mm:ss" (for the time picker). */
function parseTime(time: string): Date {
  const [hh, mm, ss] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(hh ?? 0, mm ?? 0, ss ?? 0, 0);
  return date;
}

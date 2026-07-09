import { Component, DestroyRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';

import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzDropdownModule } from 'ng-zorro-antd/dropdown';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';

import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth.service';
import { MixerService } from '../../core/mixer.service';
import { LeaderService } from '../../core/leader.service';
import { Jingle, LibraryService } from '../../core/library.service';
import { ScheduledJingle, ScheduleService } from '../../core/schedule.service';
import { SchedulerService } from '../../core/scheduler.service';
import { VoiceTriggerService } from '../../core/voice-trigger.service';
import { LATEST_RELEASE_PAGE, UpdateService } from '../../core/update.service';
import { UiButton } from '../../ui/button/button';
import { CreateJingleModal, PreparedAudio } from './create-jingle-modal/create-jingle-modal';
import { EditJingleModal } from './edit-jingle-modal/edit-jingle-modal';
import { JingleItem } from './jingle-item/jingle-item';
import { ScheduledJingleItem } from './scheduled-jingle-item/scheduled-jingle-item';
import { ScheduleJingleModal } from './schedule-jingle-modal/schedule-jingle-modal';
import { YoutubeImportModal } from './youtube-import-modal/youtube-import-modal';

/** A scheduled entry joined with the jingle it refers to (for the list view). */
export interface ScheduledView {
  entry: ScheduledJingle;
  jingle: Jingle | undefined;
}

@Component({
  selector: 'app-library',
  imports: [
    CdkDrag,
    CdkDropList,
    FormsModule,
    NzAlertModule,
    NzAvatarModule,
    NzBadgeModule,
    NzDropdownModule,
    NzIconModule,
    NzSpinModule,
    NzTabsModule,
    NzTooltipModule,
    UiButton,
    JingleItem,
    ScheduledJingleItem,
    CreateJingleModal,
    EditJingleModal,
    ScheduleJingleModal,
    YoutubeImportModal,
  ],
  templateUrl: './library.html',
})
export class Library implements OnInit {
  private readonly libraryService = inject(LibraryService);
  private readonly scheduleService = inject(ScheduleService);
  protected readonly scheduler = inject(SchedulerService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);
  private readonly mixer = inject(MixerService);
  private readonly updates = inject(UpdateService);
  protected readonly leader = inject(LeaderService);
  protected readonly voice = inject(VoiceTriggerService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly createModal = viewChild.required(CreateJingleModal);
  private readonly editModal = viewChild.required(EditJingleModal);
  private readonly scheduleModal = viewChild.required(ScheduleJingleModal);
  private readonly youtubeModal = viewChild.required(YoutubeImportModal);

  protected readonly jingles = signal<Jingle[]>([]);
  protected readonly loading = signal(false);
  protected readonly search = signal('');
  /** Active tab (0 = Tutti, 1 = Programmati). The search box on the tab bar shows
   *  only on Tutti, where it actually filters the grid. */
  protected readonly tabIndex = signal(0);

  // Scheduled plays live in ScheduleService as a signal (source of truth). Here
  // we just join each entry with its jingle for display; the list reacts to any
  // add/update/remove automatically (no manual reload).
  protected readonly schedulesLoading = signal(false);
  protected readonly scheduledView = computed<ScheduledView[]>(() => {
    const byId = new Map(this.jingles().map((j) => [j.id, j]));
    // scheduleService.schedules() is already sorted by time of day.
    return this.scheduleService.schedules().map((entry) => ({ entry, jingle: byId.get(entry.jingleId) }));
  });
  // YouTube import needs the local Mixer. On GitHub Pages there is none, so the
  // button stays hidden; in the standalone (Electron) app the embedded Mixer
  // answers and it shows.
  protected readonly youtubeAvailable = signal(false);
  /** Voice trigger is a desktop feature: shown everywhere except the public Pages site. */
  protected readonly voiceAvailable = !location.hostname.endsWith('github.io');
  /** Newer desktop version available on GitHub Releases (null = up to date / not standalone). */
  protected readonly updateVersion = signal<string | null>(null);
  protected readonly releasesUrl = LATEST_RELEASE_PAGE;
  protected readonly appVersion = environment.version;

  /** Account avatar + dropdown labels. */
  protected readonly userLabel = computed(() => {
    const user = this.auth.user();
    const name = user?.displayName || user?.email || '';
    return name.split('@')[0] || 'Utente';
  });
  protected readonly userInitial = computed(() => this.userLabel().charAt(0).toUpperCase() || 'U');

  protected readonly filtered = () => {
    const q = this.search().toLowerCase().trim();
    if (!q) return this.jingles();
    return this.jingles().filter(
      (j) => j.name.toLowerCase().includes(q) || j.tags.some((t) => t.includes(q)),
    );
  };

  /** Reordering is index-based: it only works when the grid shows the full list. */
  protected readonly reorderDisabled = () => this.search().trim().length > 0;

  async ngOnInit() {
    await Promise.all([this.loadJingles(), this.loadSchedules()]);

    // Fire scheduled jingles while this view is open. Reads scheduledView() live,
    // so add/edit/delete (and the one-shot self-removal) are picked up automatically.
    this.scheduler.start(this.scheduledView);
    this.destroyRef.onDestroy(() => this.scheduler.stop());

    // Voice trigger (desktop): one machine (the "capo") listens and fires jingles
    // by voice. Coordinated via LeaderService so a shared account never double-fires.
    if (this.voiceAvailable) {
      this.voice.start(this.jingles);
      this.leader.start();
      this.destroyRef.onDestroy(() => {
        this.voice.stop();
        this.leader.stop();
      });
    }

    const health = await this.mixer.health();
    this.youtubeAvailable.set(health !== null);
    // Update check only in the desktop app: the web app is always up to date.
    if (this.mixer.isStandalone && health?.version) {
      this.updateVersion.set(await this.updates.checkForUpdate(health.version));
    }
  }

  protected openCreate() {
    this.createModal().open();
  }

  /** YouTube flow: open the modal immediately, then sanity-check the Mixer in the
   *  background (non-blocking) so the modal never waits on a network round-trip. */
  protected openYoutube() {
    this.youtubeModal().open();
    this.mixer.health().then((health) => {
      if (!health) {
        this.message.error('Mixer non raggiungibile. Avvia il Mixer e riprova.');
      } else if (!health.ready) {
        this.message.warning('Mixer in preparazione (download binari). Riprova tra poco.');
      }
    });
  }

  /** Audio extracted + uploaded: open the create modal prefilled. */
  protected onYoutubeImported(audio: PreparedAudio) {
    this.createModal().openWithAudio(audio);
  }

  protected openEdit(jingle: Jingle) {
    this.editModal().open(jingle);
  }

  protected openSchedule(jingle: Jingle) {
    this.scheduleModal().open(jingle);
  }

  /** From the "Programmati" list: edit only the schedule (time + repeat flag). */
  protected openScheduleEdit(entry: ScheduledJingle) {
    const jingle = this.jingles().find((j) => j.id === entry.jingleId);
    this.scheduleModal().openForEdit(entry, jingle?.name ?? 'Jingle non disponibile');
  }

  /** Toggle from the scheduled card: pause/resume without deleting. */
  protected toggleSchedule(entry: ScheduledJingle) {
    void this.scheduleService.setEnabled(entry.id, entry.enabled === false);
  }

  protected removeSchedule(entry: ScheduledJingle) {
    this.modal.confirm({
      nzTitle: 'Rimuovere questa programmazione?',
      nzContent: 'Il jingle non verrà più riprodotto a quell\'orario.',
      nzOkText: 'Rimuovi',
      nzOkDanger: true,
      nzOnOk: async () => {
        try {
          await this.scheduleService.remove(entry.id);
        } catch (err) {
          console.error(err);
          this.message.error('Rimozione non riuscita.');
        }
      },
    });
  }

  protected async onSaved() {
    await this.loadJingles();
  }

  /** A jingle was deleted: its schedules are cascaded away in the service (signal
   *  updates the list on its own), so we only need to refresh the jingles here. */
  protected async onDeleted() {
    await this.loadJingles();
  }

  /** Drag & drop reorder: updates the list and persists the order on this device. */
  protected onReorder(event: CdkDragDrop<Jingle[]>) {
    this.jingles.update((list) => {
      const next = [...list];
      moveItemInArray(next, event.previousIndex, event.currentIndex);
      return next;
    });
    this.saveOrder();
  }

  /** Take the voice command on this device (the "Diventa capo" button). */
  protected claimCapo() {
    void this.leader.claim();
  }

  async logout() {
    await this.auth.logout();
    this.router.navigate(['/login']);
  }

  private async loadJingles() {
    this.loading.set(true);
    try {
      this.jingles.set(this.applySavedOrder(await this.libraryService.list()));
    } catch (err) {
      console.error(err);
      this.message.error('Caricamento dei jingle non riuscito.');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadSchedules() {
    this.schedulesLoading.set(true);
    try {
      await this.scheduleService.load();
    } catch (err) {
      console.error(err);
      this.message.error('Caricamento delle programmazioni non riuscito.');
    } finally {
      this.schedulesLoading.set(false);
    }
  }

  // --- Per-device ordering (localStorage only, NOT shared between devices) ---

  /** Applies the locally saved order; jingles not in it (new ones) stay first. */
  private applySavedOrder(list: Jingle[]): Jingle[] {
    const position = new Map(this.readOrder().map((id, index) => [id, index]));
    if (position.size === 0) return list;
    const known = list
      .filter((j) => position.has(j.id))
      .sort((a, b) => position.get(a.id)! - position.get(b.id)!);
    const unknown = list.filter((j) => !position.has(j.id));
    return [...unknown, ...known];
  }

  private readOrder(): string[] {
    try {
      const raw = localStorage.getItem(this.orderKey());
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private saveOrder() {
    localStorage.setItem(this.orderKey(), JSON.stringify(this.jingles().map((j) => j.id)));
  }

  /** Keyed per user so two accounts on the same device keep separate orders. */
  private orderKey(): string {
    return `jingle-machine:order:${this.auth.user()?.uid ?? 'anonymous'}`;
  }

}

import { Component, OnInit, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';

import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzSpinModule } from 'ng-zorro-antd/spin';

import { AuthService } from '../../core/auth.service';
import { MixerService } from '../../core/mixer.service';
import { Jingle, LibraryService } from '../../core/library.service';
import { UiButton } from '../../ui/button/button';
import { CreateJingleModal, PreparedAudio } from './create-jingle-modal/create-jingle-modal';
import { EditJingleModal } from './edit-jingle-modal/edit-jingle-modal';
import { JingleItem } from './jingle-item/jingle-item';
import { YoutubeImportModal } from './youtube-import-modal/youtube-import-modal';

@Component({
  selector: 'app-library',
  imports: [
    CdkDrag,
    CdkDropList,
    FormsModule,
    NzIconModule,
    NzSpinModule,
    UiButton,
    JingleItem,
    CreateJingleModal,
    EditJingleModal,
    YoutubeImportModal,
  ],
  templateUrl: './library.html',
})
export class Library implements OnInit {
  private readonly libraryService = inject(LibraryService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);
  private readonly mixer = inject(MixerService);

  private readonly createModal = viewChild.required(CreateJingleModal);
  private readonly editModal = viewChild.required(EditJingleModal);
  private readonly youtubeModal = viewChild.required(YoutubeImportModal);

  protected readonly jingles = signal<Jingle[]>([]);
  protected readonly loading = signal(false);
  protected readonly search = signal('');
  // YouTube import needs the local Mixer. On GitHub Pages there is none, so the
  // button stays hidden; in the standalone (Electron) app the embedded Mixer
  // answers and it shows.
  protected readonly youtubeAvailable = signal(false);

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
    await this.loadJingles();
    this.youtubeAvailable.set((await this.mixer.health()) !== null);
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

  protected confirmDelete(jingle: Jingle) {
    this.modal.confirm({
      nzTitle: `Eliminare "${jingle.name}"?`,
      nzContent: 'Questa azione non può essere annullata.',
      nzOkText: 'Elimina',
      nzOkDanger: true,
      nzOnOk: () => this.deleteJingle(jingle),
    });
  }

  protected async onSaved() {
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

  private async deleteJingle(jingle: Jingle) {
    try {
      await this.libraryService.remove(jingle);
      this.jingles.update((list) => list.filter((j) => j.id !== jingle.id));
      this.message.success('Eliminato.');
    } catch (err) {
      console.error(err);
      this.message.error('Eliminazione non riuscita.');
    }
  }
}

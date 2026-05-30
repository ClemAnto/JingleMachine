import { Component, OnInit, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzSpinModule } from 'ng-zorro-antd/spin';

import { AuthService } from '../../core/auth.service';
import { Jingle, LibraryService } from '../../core/library.service';
import { CreateJingleModal } from './create-jingle-modal/create-jingle-modal';
import { EditJingleModal } from './edit-jingle-modal/edit-jingle-modal';
import { JingleItem } from './jingle-item/jingle-item';

@Component({
  selector: 'app-library',
  imports: [
    FormsModule,
    NzIconModule,
    NzSpinModule,
    JingleItem,
    CreateJingleModal,
    EditJingleModal,
  ],
  templateUrl: './library.html',
  styleUrl: './library.scss',
})
export class Library implements OnInit {
  private readonly libraryService = inject(LibraryService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);

  private readonly createModal = viewChild.required(CreateJingleModal);
  private readonly editModal = viewChild.required(EditJingleModal);

  protected readonly jingles = signal<Jingle[]>([]);
  protected readonly loading = signal(false);
  protected readonly search = signal('');

  protected readonly filtered = () => {
    const q = this.search().toLowerCase().trim();
    if (!q) return this.jingles();
    return this.jingles().filter(
      (j) => j.name.toLowerCase().includes(q) || j.tags.some((t) => t.includes(q)),
    );
  };

  async ngOnInit() {
    await this.loadJingles();
  }

  protected openCreate() {
    this.createModal().open();
  }

  protected openEdit(jingle: Jingle) {
    this.editModal().open(jingle);
  }

  protected confirmDelete(jingle: Jingle) {
    this.modal.confirm({
      nzTitle: `Delete "${jingle.name}"?`,
      nzContent: 'This action cannot be undone.',
      nzOkText: 'Delete',
      nzOkDanger: true,
      nzOnOk: () => this.deleteJingle(jingle),
    });
  }

  protected async onSaved() {
    await this.loadJingles();
  }

  async logout() {
    await this.auth.logout();
    this.router.navigate(['/login']);
  }

  private async loadJingles() {
    this.loading.set(true);
    try {
      this.jingles.set(await this.libraryService.list());
    } catch (err) {
      console.error(err);
      this.message.error('Failed to load jingles.');
    } finally {
      this.loading.set(false);
    }
  }

  private async deleteJingle(jingle: Jingle) {
    try {
      await this.libraryService.remove(jingle);
      this.jingles.update((list) => list.filter((j) => j.id !== jingle.id));
      this.message.success('Deleted.');
    } catch (err) {
      console.error(err);
      this.message.error('Delete failed.');
    }
  }
}

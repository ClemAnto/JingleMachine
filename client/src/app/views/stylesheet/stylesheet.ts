import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';

import { UiButton } from '../../ui/button/button';

/** Developer-only page at /stylesheet — no auth guard.
 *  Shows all themed UI components in every variant. */
@Component({
  selector: 'app-stylesheet',
  imports: [
    FormsModule,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    NzTagModule,
    NzSpinModule,
    NzModalModule,
    NzSelectModule,
    UiButton,
  ],
  templateUrl: './stylesheet.html',
})
export class Stylesheet {
  protected modalVisible = signal(false);
  protected searchValue = signal('');
  protected selectValue = signal<string | null>(null);

  // Jingle card accent colours — values from the Figma mockup SVG.
  protected readonly jingleColors = [
    '#D60F00', '#F97000', '#FFD500', '#56E42E',
    '#3AE9CF', '#007EF4', '#AA00FF', '#FF24A7',
  ];

  // Theme tokens for the palette section: bg utility + the matching on-* text.
  protected readonly paletteTokens = [
    { cls: 'bg-page', on: 'text-fg', name: 'page', onName: 'fg' },
    { cls: 'bg-surface', on: 'text-fg', name: 'surface', onName: 'fg' },
    { cls: 'bg-control', on: 'text-fg', name: 'control', onName: 'fg' },
    { cls: 'bg-primary', on: 'text-on-primary', name: 'primary', onName: 'on-primary' },
    { cls: 'bg-danger', on: 'text-on-danger', name: 'danger', onName: 'on-danger' },
    { cls: 'bg-success', on: 'text-on-success', name: 'success', onName: 'on-success' },
    { cls: 'bg-warning', on: 'text-on-warning', name: 'warning', onName: 'on-warning' },
    { cls: 'bg-info', on: 'text-on-info', name: 'info', onName: 'on-info' },
  ];

  protected readonly mockTags = ['jingle', 'intro', 'musica', 'effetto', 'voce'];
}

import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';

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
  ],
  templateUrl: './stylesheet.html',
})
export class Stylesheet {
  protected modalVisible = signal(false);
  protected searchValue = signal('');
  protected selectValue = signal<string | null>(null);

  protected readonly jingleColors = [
    '#ff4548', '#ff7a00', '#ffb700', '#52c41a',
    '#45fff3', '#1890ff', '#9000ff', '#ff45e5',
  ];

  protected readonly mockTags = ['jingle', 'intro', 'musica', 'effetto', 'voce'];
}

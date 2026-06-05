import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { HelperService } from './core/helper.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class App implements OnInit, OnDestroy {
  private readonly helper = inject(HelperService);
  private heartbeatTimer?: ReturnType<typeof setInterval>;

  ngOnInit() {
    this.helper.heartbeat();
    this.heartbeatTimer = setInterval(() => this.helper.heartbeat(), 60000);
    // Standalone build: the helper serves this very page, so a refresh must not
    // beacon-shut it down — rely on the heartbeat timeout instead. Only beacon
    // on unload when the helper is a separate process (dev server / GitHub Pages).
    if (!this.helper.isStandalone) {
      window.addEventListener('pagehide', this.onPageHide);
    }
  }

  ngOnDestroy() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    window.removeEventListener('pagehide', this.onPageHide);
  }

  private readonly onPageHide = () => this.helper.shutdown();
}

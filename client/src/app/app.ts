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
    // Keep the helper alive while the app is open. If heartbeats stop (tab/window
    // closed) the helper auto-shuts down after its timeout. We intentionally do
    // NOT shut it down on unload: in dev the helper is a separate process and a
    // refresh would kill it. In the Electron app, closing the window quits the
    // process (and the embedded server) directly.
    this.helper.heartbeat();
    this.heartbeatTimer = setInterval(() => this.helper.heartbeat(), 60000);
  }

  ngOnDestroy() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
  }
}

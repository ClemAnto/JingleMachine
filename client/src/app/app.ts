import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { MixerService } from './core/mixer.service';
import { routeTransition } from './route-animations';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  animations: [routeTransition],
  template: `
    <div [@routeTransition]="routeKey(outlet)">
      <router-outlet #outlet="outlet" />
    </div>
  `,
})
export class App implements OnInit, OnDestroy {
  private readonly mixer = inject(MixerService);
  private heartbeatTimer?: ReturnType<typeof setInterval>;

  /** Per-route key so the route transition fires on every navigation. */
  protected routeKey(outlet: RouterOutlet): string {
    return outlet?.isActivated ? (outlet.activatedRoute.snapshot.routeConfig?.path ?? 'root') : '';
  }

  ngOnInit() {
    // Keep the Mixer alive while the app is open. If heartbeats stop (tab/window
    // closed) the Mixer auto-shuts down after its timeout. We intentionally do
    // NOT shut it down on unload: in dev the Mixer is a separate process and a
    // refresh would kill it. In the Electron app, closing the window quits the
    // process (and the embedded server) directly.
    this.mixer.heartbeat();
    this.heartbeatTimer = setInterval(() => this.mixer.heartbeat(), 60000);
  }

  ngOnDestroy() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
  }
}

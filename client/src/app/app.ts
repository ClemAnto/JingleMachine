import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { MixerService } from './core/mixer.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  // Screen transitions are pure CSS (see styles/tokens.css `route-enter`): each
  // routed view host is recreated on navigation and animates in. Angular's
  // animations DSL is deprecated in v20+ in favour of native CSS.
  template: `<router-outlet />`,
})
export class App implements OnInit, OnDestroy {
  private readonly mixer = inject(MixerService);
  private heartbeatTimer?: ReturnType<typeof setInterval>;

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

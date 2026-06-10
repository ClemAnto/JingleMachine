import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

/** Latest published desktop release (GitHub API, public repo → no auth needed). */
const LATEST_RELEASE_API = 'https://api.github.com/repos/ClemAnto/JingleMachine/releases/latest';

/** Stable page URL of the latest release — where the user downloads the installer. */
export const LATEST_RELEASE_PAGE = 'https://github.com/ClemAnto/JingleMachine/releases/latest';

/**
 * Update check for the desktop (Electron) app: compares the running Mixer
 * version with the latest GitHub Release. The web app on GitHub Pages never
 * needs this (it is redeployed on every push).
 */
@Injectable({ providedIn: 'root' })
export class UpdateService {
  private readonly http = inject(HttpClient);

  /** Returns the newer available version (e.g. '0.9.0'), or null if up to date.
   *  Fails silently (offline, rate limit, no releases yet) — never blocks the app. */
  async checkForUpdate(currentVersion: string): Promise<string | null> {
    try {
      const release = await firstValueFrom(
        this.http.get<{ tag_name?: string }>(LATEST_RELEASE_API),
      );
      const latest = (release.tag_name ?? '').replace(/^v/, '');
      return this.isNewer(latest, currentVersion) ? latest : null;
    } catch {
      return null;
    }
  }

  /** Numeric semver comparison: '0.10.0' > '0.9.1'. */
  private isNewer(latest: string, current: string): boolean {
    if (!latest) return false;
    const a = latest.split('.').map(Number);
    const b = current.split('.').map(Number);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const diff = (a[i] ?? 0) - (b[i] ?? 0);
      if (diff !== 0) return diff > 0;
    }
    return false;
  }
}

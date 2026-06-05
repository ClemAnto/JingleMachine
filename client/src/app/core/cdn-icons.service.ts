import { Injectable, SecurityContext } from '@angular/core';
import {
  getIconDefinitionFromAbbr,
  getNameAndNamespace,
  IconDefinition,
  UrlNotSafeError,
} from '@ant-design/icons-angular';
import { NzIconService } from 'ng-zorro-antd/icon';
import { catchError, concat, finalize, map, Observable, of, share, tap } from 'rxjs';

/**
 * Transparent 24×24 SVG used as a placeholder while a CDN icon loads.
 * Reserves the same layout space as the real icon (1em × 1em), preventing
 * layout shifts, but stays invisible.
 */
const PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em"><rect width="24" height="24" fill="none"/></svg>`;

/** jsDelivr CDN base for standard Ant Design icons (no namespace, e.g. "play-circle"). */
const ANTD_CDN = 'https://cdn.jsdelivr.net/npm/@ant-design/icons-angular/src/inline-svg/';

/**
 * Drop-in replacement for NzIconService that loads icons dynamically from a CDN
 * instead of requiring every icon to be pre-registered. Supports:
 *
 * 1. Standard Ant Design icons (no namespace) → loaded from jsDelivr.
 *    Pre-registered icons (provideNzIcons) still resolve instantly; the dynamic
 *    loader only runs for icons that are NOT already registered.
 *
 * 2. Per-namespace CDN base URLs via addNamespaceRoot — e.g. Material Icons:
 *      addNamespaceRoot('mi-outlined', '.../@material-design-icons/svg/outlined/')
 *      → <nz-icon nzType="mi-outlined:home" />  ⇒  ".../outlined/home.svg"
 *    URL = namespaceRoot + name + '.svg'. For unregistered namespaces, falls back
 *    to _assetsUrlRoot + namespace + '/'.
 *
 * 3. Anti-layout-shift placeholder: for namespace icons, a transparent SVG is
 *    emitted synchronously before the HTTP request resolves, so the element
 *    always reserves space immediately.
 *
 *    Two subtle rules keep the placeholder correct:
 *    a) addIcon() is NOT called for the placeholder (only the real icon), otherwise
 *       the placeholder would be cached and returned forever.
 *    b) the rendered-SVG cache (_svgRenderedDefinitions) is invalidated for this type
 *       before the real icon is added, so the placeholder element is not reused.
 */
@Injectable({ providedIn: 'root' })
export class CdnIconsService extends NzIconService {
  /** Maps namespace → base URL for custom CDN icon sets. */
  private namespaceRoots = new Map<string, string>();

  /**
   * Registers a CDN base URL for a namespace. A trailing slash is added if missing.
   * @example addNamespaceRoot('mi-filled', 'https://cdn.example.com/material/filled/')
   */
  addNamespaceRoot(namespace: string, baseUrl: string): void {
    this.namespaceRoots.set(namespace, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  }

  override _loadIconDynamically(type: string): Observable<IconDefinition | null> {
    let inProgress = this._inProgressFetches.get(type);
    if (inProgress) {
      return inProgress;
    }

    const [name, namespace] = getNameAndNamespace(type);
    const icon = namespace ? { name: type, icon: '' } : getIconDefinitionFromAbbr(name);

    // Namespace icons: use the registered root, else fall back to assets root.
    // Standard icons (no namespace): jsDelivr + theme/name.
    const namespaceRoot = namespace
      ? this.namespaceRoots.get(namespace) ?? `${this._assetsUrlRoot}${namespace}/`
      : null;
    const url =
      (namespace ? `${namespaceRoot}${name}` : `${ANTD_CDN}${icon.theme}/${icon.name}`) + '.svg';

    const safeUrl = this.sanitizer.sanitize(SecurityContext.URL, url);
    if (!safeUrl) {
      throw UrlNotSafeError(url);
    }

    const hasPlaceholder = !!(namespace && this.namespaceRoots.has(namespace));

    const httpSource = this._http
      .get(safeUrl, { responseType: 'text' })
      .pipe(map((literal) => ({ ...icon, icon: literal })));

    // Register the real icon. For namespace icons, first invalidate the rendered SVG
    // cache so the placeholder element is not reused (rule b).
    const realIconStream = hasPlaceholder
      ? httpSource.pipe(
          tap(() => (this as any)._svgRenderedDefinitions?.delete(type)),
          tap((definition) => this.addIcon(definition)),
        )
      : httpSource.pipe(tap((definition) => this.addIcon(definition)));

    // Emit a transparent placeholder synchronously first for namespace icons (rule a:
    // addIcon is intentionally NOT called for it).
    const source = hasPlaceholder
      ? concat(of({ ...icon, icon: PLACEHOLDER_SVG }), realIconStream)
      : realIconStream;

    inProgress = source.pipe(
      finalize(() => this._inProgressFetches.delete(type)),
      catchError(() => of(null)),
      share(),
    );
    this._inProgressFetches.set(type, inProgress);
    return inProgress;
  }
}

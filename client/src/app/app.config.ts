import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import it from '@angular/common/locales/it';
import { provideAnimations } from '@angular/platform-browser/animations';

import { it_IT, provideNzI18n } from 'ng-zorro-antd/i18n';
import { NzIconService, provideNzIcons } from 'ng-zorro-antd/icon';
import {
  AudioOutline,
  DeleteOutline,
  EditOutline,
  GoogleOutline,
  LoadingOutline,
  LogoutOutline,
  PauseCircleOutline,
  PictureOutline,
  PlayCircleOutline,
  PlusOutline,
  SaveOutline,
  ScissorOutline,
  SearchOutline,
  SoundOutline,
  TagOutline,
  UploadOutline,
  YoutubeOutline,
} from '@ant-design/icons-angular/icons';

import { routes } from './app.routes';
import { CdnIconsService } from './core/cdn-icons.service';
import { provideFirebase } from './core/firebase.providers';

registerLocaleData(it);

/** Material Icons styles, served from jsDelivr (no own CDN needed).
 *  Usage: <nz-icon nzType="mi-outlined:home" /> (or mi: / mi-filled: / mi-round: / mi-sharp: / mi-two-tone:). */
const MATERIAL_ICONS_CDN = 'https://cdn.jsdelivr.net/npm/@material-design-icons/svg@latest/';

const icons = [
  AudioOutline,
  DeleteOutline,
  EditOutline,
  GoogleOutline,
  LoadingOutline,
  LogoutOutline,
  PauseCircleOutline,
  PictureOutline,
  PlayCircleOutline,
  PlusOutline,
  SaveOutline,
  ScissorOutline,
  SearchOutline,
  SoundOutline,
  TagOutline,
  UploadOutline,
  YoutubeOutline,
];

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(),
    provideAnimations(),
    provideNzI18n(it_IT),
    provideNzIcons(icons),
    // Load any non-registered icon dynamically from a CDN (+ Material Icons namespaces).
    { provide: NzIconService, useExisting: CdnIconsService },
    provideAppInitializer(() => {
      const iconService = inject(CdnIconsService);
      iconService.addNamespaceRoot('mi', `${MATERIAL_ICONS_CDN}filled/`);
      iconService.addNamespaceRoot('mi-filled', `${MATERIAL_ICONS_CDN}filled/`);
      iconService.addNamespaceRoot('mi-outlined', `${MATERIAL_ICONS_CDN}outlined/`);
      iconService.addNamespaceRoot('mi-round', `${MATERIAL_ICONS_CDN}round/`);
      iconService.addNamespaceRoot('mi-sharp', `${MATERIAL_ICONS_CDN}sharp/`);
      iconService.addNamespaceRoot('mi-two-tone', `${MATERIAL_ICONS_CDN}two-tone/`);
    }),
    provideFirebase(),
  ],
};

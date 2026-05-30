import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { registerLocaleData } from '@angular/common';
import it from '@angular/common/locales/it';
import { provideAnimations } from '@angular/platform-browser/animations';

import { it_IT, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
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
import { provideFirebase } from './core/firebase.providers';

registerLocaleData(it);

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
    provideAnimations(),
    provideNzI18n(it_IT),
    provideNzIcons(icons),
    provideFirebase(),
  ],
};

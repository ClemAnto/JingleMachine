import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { LogoutOutline, SoundOutline } from '@ant-design/icons-angular/icons';

import { App } from './app';
import { AuthService } from './core/auth.service';

class AuthServiceStub {
  isLoggedIn = signal(false);
  user = signal(null);
  logout = () => Promise.resolve();
}

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        provideNzIcons([SoundOutline, LogoutOutline]),
        { provide: AuthService, useClass: AuthServiceStub },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the app title', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Jingle Machine');
  });
});

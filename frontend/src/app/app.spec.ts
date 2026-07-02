import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect } from 'vitest';
import { App } from './app';
import { AuthService } from './core/auth.service';

describe('App', () => {
  it('affiche la barre de navigation quand connecté', () => {
    TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            isLoggedIn: () => true,
            isAdmin: () => true,
            currentUser: () => ({ id: 1, username: 'admin', role: 'admin' }),
            logout: () => {},
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.app-shell')).toBeTruthy();
    expect(compiled.querySelector('.username')?.textContent).toContain('admin');
    expect(compiled.querySelector('a[routerLink="/tickets"]')).toBeTruthy();
    expect(compiled.querySelector('a[routerLink="/admin/users"]')).toBeTruthy();
    expect(compiled.querySelector('a[routerLink="/board/settings"]')).toBeTruthy();
  });

  it('masque la barre de navigation quand déconnecté', () => {
    TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { isLoggedIn: () => false, isAdmin: () => false, currentUser: () => null, logout: () => {} },
        },
      ],
    });

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.app-shell')).toBeFalsy();
  });

  it("masque le lien Utilisateurs pour un non-admin", () => {
    TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            isLoggedIn: () => true,
            isAdmin: () => false,
            currentUser: () => ({ id: 2, username: 'alice', role: 'user' }),
            logout: () => {},
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('a[routerLink="/tickets"]')).toBeTruthy();
    expect(compiled.querySelector('a[routerLink="/admin/users"]')).toBeFalsy();
    expect(compiled.querySelector('a[routerLink="/board/settings"]')).toBeFalsy();
  });
});

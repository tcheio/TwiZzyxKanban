import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Component } from '@angular/core';
import { describe, it, expect, vi } from 'vitest';
import { App } from './app';
import { AuthService } from './core/auth.service';
import { KanbansService } from './services/kanbans.service';
import { EpicsService } from './services/epics.service';

@Component({ selector: 'app-stub', template: '' })
class StubComponent {}

const kanbans = [{ id: 3, name: 'Chaîne Test', code: 'TK-TEST', is_moderator: true }];
const epics = [{ id: 1, name: 'TwiZzyx', color: 'red' }];

function configure(authValue: {
  isLoggedIn: () => boolean;
  isAdmin: () => boolean;
  currentUser: () => unknown;
  logout: () => void;
}) {
  TestBed.configureTestingModule({
    imports: [App],
    providers: [
      provideRouter([
        { path: 'kanbans/:kanbanCode', component: StubComponent, data: { kanban: kanbans[0] } },
        { path: 'kanbans', component: StubComponent },
      ]),
      { provide: AuthService, useValue: authValue },
      { provide: KanbansService, useValue: { list: vi.fn().mockResolvedValue(kanbans) } },
      { provide: EpicsService, useValue: { list: vi.fn().mockResolvedValue(epics) } },
    ],
  });
}

describe('App', () => {
  it('affiche la barre de navigation quand connecté', () => {
    configure({
      isLoggedIn: () => true,
      isAdmin: () => true,
      currentUser: () => ({ id: 1, username: 'admin', role: 'admin' }),
      logout: () => {},
    });

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.app-shell')).toBeTruthy();
    expect(compiled.querySelector('.username')?.textContent).toContain('admin');
    expect(compiled.querySelector('a[routerLink="/admin/users"]')).toBeTruthy();
  });

  it('masque la barre de navigation quand déconnecté', () => {
    configure({ isLoggedIn: () => false, isAdmin: () => false, currentUser: () => null, logout: () => {} });

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.app-shell')).toBeFalsy();
  });

  it('masque le lien Utilisateurs pour un non-admin', () => {
    configure({
      isLoggedIn: () => true,
      isAdmin: () => false,
      currentUser: () => ({ id: 2, username: 'alice', role: 'user' }),
      logout: () => {},
    });

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('a[routerLink="/admin/users"]')).toBeFalsy();
  });

  it('le bouton du logo navigue vers /kanbans', () => {
    configure({
      isLoggedIn: () => true,
      isAdmin: () => true,
      currentUser: () => ({ id: 1, username: 'admin', role: 'admin' }),
      logout: () => {},
    });

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    const button = fixture.nativeElement.querySelector('button[title="Mes Kanbans"]') as HTMLButtonElement;
    button.click();

    expect(navigateSpy).toHaveBeenCalledWith(['/kanbans']);
  });

  it('affiche la navigation propre au kanban une fois à l\'intérieur, avec son nom et ses EPICs', async () => {
    configure({
      isLoggedIn: () => true,
      isAdmin: () => false,
      currentUser: () => ({ id: 2, username: 'alice', role: 'user' }),
      logout: () => {},
    });

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/kanbans/TK-TEST');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Chaîne Test');
    expect(compiled.querySelector('a[href="/kanbans/TK-TEST"]')?.textContent).toContain('Tableau');
    expect(compiled.querySelector('a[href="/kanbans/TK-TEST/tickets"]')?.textContent).toContain('Tickets');
    expect(compiled.querySelector('a[href="/kanbans/TK-TEST/tags"]')?.textContent).toContain('Tags');
    expect(compiled.textContent).toContain('TwiZzyx');
  });
});

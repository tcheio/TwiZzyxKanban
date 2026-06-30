import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('démarre déconnecté quand le localStorage est vide', () => {
    expect(service.isLoggedIn()).toBe(false);
    expect(service.currentUser()).toBeNull();
  });

  it('login() stocke le token/utilisateur et met à jour les signaux', async () => {
    const loginPromise = service.login('admin', 'admin123');

    const req = httpMock.expectOne('/api/auth/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ username: 'admin', password: 'admin123' });
    req.flush({ token: 'fake-token', user: { id: 1, username: 'admin', role: 'admin' } });

    await loginPromise;

    expect(service.isLoggedIn()).toBe(true);
    expect(service.isAdmin()).toBe(true);
    expect(service.getToken()).toBe('fake-token');
    expect(localStorage.getItem('kanban_token')).toBe('fake-token');
  });

  it('logout() efface le token et le signal utilisateur', async () => {
    const loginPromise = service.login('admin', 'admin123');
    httpMock.expectOne('/api/auth/login').flush({ token: 't', user: { id: 1, username: 'admin', role: 'admin' } });
    await loginPromise;

    service.logout();

    expect(service.isLoggedIn()).toBe(false);
    expect(service.getToken()).toBeNull();
    expect(localStorage.getItem('kanban_token')).toBeNull();
  });

  it('restaure la session depuis un localStorage déjà rempli', () => {
    localStorage.setItem('kanban_token', 'stored-token');
    localStorage.setItem('kanban_user', JSON.stringify({ id: 2, username: 'bob', role: 'user' }));

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const freshService = TestBed.inject(AuthService);

    expect(freshService.isLoggedIn()).toBe(true);
    expect(freshService.currentUser()?.username).toBe('bob');
    expect(freshService.isAdmin()).toBe(false);
  });
});

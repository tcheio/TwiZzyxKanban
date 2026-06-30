import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let getToken: ReturnType<typeof vi.fn>;
  let logout: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getToken = vi.fn().mockReturnValue('my-token');
    logout = vi.fn();
    navigate = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { getToken, logout } },
        { provide: Router, useValue: { navigate } },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('ajoute le header Authorization quand un token existe', () => {
    http.get('/api/cards').subscribe();

    const req = httpMock.expectOne('/api/cards');
    expect(req.request.headers.get('Authorization')).toBe('Bearer my-token');
    req.flush([]);
  });

  it("n'ajoute pas le header quand il n'y a pas de token", () => {
    getToken.mockReturnValue(null);

    http.get('/api/cards').subscribe();

    const req = httpMock.expectOne('/api/cards');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush([]);
  });

  it('sur une réponse 401, déconnecte et redirige vers /login', () => {
    http.get('/api/cards').subscribe({ error: () => {} });

    const req = httpMock.expectOne('/api/cards');
    req.flush({ error: 'unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    expect(logout).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it("ne déconnecte pas sur une erreur différente de 401", () => {
    http.get('/api/cards').subscribe({ error: () => {} });

    const req = httpMock.expectOne('/api/cards');
    req.flush({ error: 'server error' }, { status: 500, statusText: 'Server Error' });

    expect(logout).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});

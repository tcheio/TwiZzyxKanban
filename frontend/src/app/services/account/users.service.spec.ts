import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(UsersService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('list() effectue un GET /api/users', async () => {
    const promise = service.list();
    const req = httpMock.expectOne('/api/users');
    expect(req.request.method).toBe('GET');
    req.flush([]);
    await promise;
  });

  it('lite() effectue un GET /api/users/lite', async () => {
    const promise = service.lite();
    const req = httpMock.expectOne('/api/users/lite');
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 1, username: 'admin' }]);
    await expect(promise).resolves.toEqual([{ id: 1, username: 'admin' }]);
  });

  it('create() effectue un POST /api/users', async () => {
    const input = { username: 'alice', password: 'alice123', role: 'user' as const };
    const promise = service.create(input);
    const req = httpMock.expectOne('/api/users');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(input);
    req.flush({ id: 2, username: 'alice', role: 'user' });
    await promise;
  });

  it('update() effectue un PATCH /api/users/:id', async () => {
    const promise = service.update(2, { role: 'admin' });
    const req = httpMock.expectOne('/api/users/2');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ role: 'admin' });
    req.flush({});
    await promise;
  });

  it('remove() effectue un DELETE /api/users/:id', async () => {
    const promise = service.remove(2);
    const req = httpMock.expectOne('/api/users/2');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    await promise;
  });
});

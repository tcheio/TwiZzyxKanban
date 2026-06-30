import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CardsService } from './cards.service';

describe('CardsService', () => {
  let service: CardsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CardsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('list() effectue un GET /api/cards', async () => {
    const promise = service.list();
    const req = httpMock.expectOne('/api/cards');
    expect(req.request.method).toBe('GET');
    req.flush([]);
    await promise;
  });

  it('create() effectue un POST /api/cards avec les bons champs', async () => {
    const input = {
      title: 'Vidéo',
      channel: 'MaChaine',
      assigned_user_id: null,
      priority: 'high' as const,
      column_id: 1,
    };
    const promise = service.create(input);
    const req = httpMock.expectOne('/api/cards');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(input);
    req.flush({ id: 1, ...input, position: 0 });
    await promise;
  });

  it('update() effectue un PATCH /api/cards/:id', async () => {
    const promise = service.update(7, { title: 'Nouveau titre' });
    const req = httpMock.expectOne('/api/cards/7');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ title: 'Nouveau titre' });
    req.flush({});
    await promise;
  });

  it('remove() effectue un DELETE /api/cards/:id', async () => {
    const promise = service.remove(7);
    const req = httpMock.expectOne('/api/cards/7');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    await promise;
  });

  it('move() effectue un PATCH /api/cards/:id/move avec columnId/position', async () => {
    const promise = service.move(7, 2, 3);
    const req = httpMock.expectOne('/api/cards/7/move');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ columnId: 2, position: 3 });
    req.flush({});
    await promise;
  });
});

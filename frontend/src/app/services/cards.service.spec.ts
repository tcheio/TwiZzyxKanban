import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CardsService } from './cards.service';

describe('CardsService', () => {
  let service: CardsService;
  let httpMock: HttpTestingController;
  const kanbanId = 1;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CardsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('list() effectue un GET /api/kanbans/:kanbanId/cards', async () => {
    const promise = service.list(kanbanId);
    const req = httpMock.expectOne('/api/kanbans/1/cards');
    expect(req.request.method).toBe('GET');
    req.flush([]);
    await promise;
  });

  it('get() effectue un GET /api/kanbans/:kanbanId/cards/:id', async () => {
    const promise = service.get(kanbanId, 7);
    const req = httpMock.expectOne('/api/kanbans/1/cards/7');
    expect(req.request.method).toBe('GET');
    req.flush({});
    await promise;
  });

  it('create() effectue un POST /api/kanbans/:kanbanId/cards avec les bons champs', async () => {
    const input = {
      title: 'Vidéo',
      assigned_user_id: null,
      priority: 'high' as const,
      column_id: 1,
    };
    const promise = service.create(kanbanId, input);
    const req = httpMock.expectOne('/api/kanbans/1/cards');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(input);
    req.flush({ id: 1, ...input, position: 0 });
    await promise;
  });

  it('update() effectue un PATCH /api/kanbans/:kanbanId/cards/:id', async () => {
    const promise = service.update(kanbanId, 7, { title: 'Nouveau titre' });
    const req = httpMock.expectOne('/api/kanbans/1/cards/7');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ title: 'Nouveau titre' });
    req.flush({});
    await promise;
  });

  it('remove() effectue un DELETE /api/kanbans/:kanbanId/cards/:id', async () => {
    const promise = service.remove(kanbanId, 7);
    const req = httpMock.expectOne('/api/kanbans/1/cards/7');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    await promise;
  });

  it('move() effectue un PATCH /api/kanbans/:kanbanId/cards/:id/move avec columnId/position', async () => {
    const promise = service.move(kanbanId, 7, 2, 3);
    const req = httpMock.expectOne('/api/kanbans/1/cards/7/move');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ columnId: 2, position: 3 });
    req.flush({});
    await promise;
  });

  it('move() omet position quand non fournie', async () => {
    const promise = service.move(kanbanId, 7, 2);
    const req = httpMock.expectOne('/api/kanbans/1/cards/7/move');
    expect(req.request.body).toEqual({ columnId: 2 });
    req.flush({});
    await promise;
  });
});

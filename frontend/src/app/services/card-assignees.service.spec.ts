import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CardAssigneesService } from './card-assignees.service';

describe('CardAssigneesService', () => {
  let service: CardAssigneesService;
  let httpMock: HttpTestingController;
  const kanbanId = 1;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CardAssigneesService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('list() effectue un GET /api/kanbans/:kanbanId/cards/:cardId/assignees', async () => {
    const promise = service.list(kanbanId, 5);
    const req = httpMock.expectOne('/api/kanbans/1/cards/5/assignees');
    expect(req.request.method).toBe('GET');
    req.flush([]);
    await promise;
  });

  it('history() effectue un GET /api/kanbans/:kanbanId/cards/:cardId/assignment-history', async () => {
    const promise = service.history(kanbanId, 5);
    const req = httpMock.expectOne('/api/kanbans/1/cards/5/assignment-history');
    expect(req.request.method).toBe('GET');
    req.flush([]);
    await promise;
  });

  it('upsert() effectue un POST avec le body', async () => {
    const promise = service.upsert(kanbanId, 5, { action: 'add', user_id: 3, reason: 'Renfort' });
    const req = httpMock.expectOne('/api/kanbans/1/cards/5/assignees');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ action: 'add', user_id: 3, reason: 'Renfort' });
    req.flush({});
    await promise;
  });

  it('remove() effectue un DELETE /api/kanbans/:kanbanId/cards/:cardId/assignees/:userId', async () => {
    const promise = service.remove(kanbanId, 5, 3);
    const req = httpMock.expectOne('/api/kanbans/1/cards/5/assignees/3');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    await promise;
  });
});

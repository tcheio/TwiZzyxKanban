import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ColumnsService } from './columns.service';

describe('ColumnsService', () => {
  let service: ColumnsService;
  let httpMock: HttpTestingController;
  const kanbanId = 1;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ColumnsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('list() effectue un GET /api/kanbans/:kanbanId/columns', async () => {
    const promise = service.list(kanbanId);
    const req = httpMock.expectOne('/api/kanbans/1/columns');
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 1, name: 'Idée', position: 0 }]);
    await expect(promise).resolves.toEqual([{ id: 1, name: 'Idée', position: 0 }]);
  });

  it('create() effectue un POST /api/kanbans/:kanbanId/columns avec le nom', async () => {
    const promise = service.create(kanbanId, 'Archivé');
    const req = httpMock.expectOne('/api/kanbans/1/columns');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'Archivé' });
    req.flush({ id: 6, name: 'Archivé', position: 5 });
    await promise;
  });

  it('rename() effectue un PATCH /api/kanbans/:kanbanId/columns/:id', async () => {
    const promise = service.rename(kanbanId, 3, 'Nouveau nom');
    const req = httpMock.expectOne('/api/kanbans/1/columns/3');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ name: 'Nouveau nom' });
    req.flush({ id: 3, name: 'Nouveau nom', position: 1 });
    await promise;
  });

  it('remove() effectue un DELETE /api/kanbans/:kanbanId/columns/:id', async () => {
    const promise = service.remove(kanbanId, 3);
    const req = httpMock.expectOne('/api/kanbans/1/columns/3');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    await promise;
  });

  it('reorder() effectue un PATCH /api/kanbans/:kanbanId/columns/reorder avec orderedIds', async () => {
    const promise = service.reorder(kanbanId, [3, 1, 2]);
    const req = httpMock.expectOne('/api/kanbans/1/columns/reorder');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ orderedIds: [3, 1, 2] });
    req.flush([]);
    await promise;
  });
});

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TagsService } from './tags.service';

describe('TagsService', () => {
  let service: TagsService;
  let httpMock: HttpTestingController;
  const kanbanId = 1;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TagsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('list() effectue un GET /api/kanbans/:kanbanId/tags', async () => {
    const promise = service.list(kanbanId);
    const req = httpMock.expectOne('/api/kanbans/1/tags');
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 1, name: 'Minecraft', color: 'emerald' }]);
    await expect(promise).resolves.toEqual([{ id: 1, name: 'Minecraft', color: 'emerald' }]);
  });

  it('create() effectue un POST /api/kanbans/:kanbanId/tags avec le nom et la couleur', async () => {
    const promise = service.create(kanbanId, 'One Piece', 'rose');
    const req = httpMock.expectOne('/api/kanbans/1/tags');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'One Piece', color: 'rose' });
    req.flush({ id: 5, name: 'One Piece', color: 'rose' });
    await promise;
  });

  it('update() effectue un PATCH /api/kanbans/:kanbanId/tags/:id', async () => {
    const promise = service.update(kanbanId, 3, { name: 'Nouveau nom', color: 'violet' });
    const req = httpMock.expectOne('/api/kanbans/1/tags/3');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ name: 'Nouveau nom', color: 'violet' });
    req.flush({ id: 3, name: 'Nouveau nom', color: 'violet' });
    await promise;
  });

  it('remove() effectue un DELETE /api/kanbans/:kanbanId/tags/:id', async () => {
    const promise = service.remove(kanbanId, 3);
    const req = httpMock.expectOne('/api/kanbans/1/tags/3');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    await promise;
  });
});

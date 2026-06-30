import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TagsService } from './tags.service';

describe('TagsService', () => {
  let service: TagsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TagsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('list() effectue un GET /api/tags', async () => {
    const promise = service.list();
    const req = httpMock.expectOne('/api/tags');
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 1, name: 'Minecraft' }]);
    await expect(promise).resolves.toEqual([{ id: 1, name: 'Minecraft' }]);
  });

  it('create() effectue un POST /api/tags avec le nom', async () => {
    const promise = service.create('One Piece');
    const req = httpMock.expectOne('/api/tags');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'One Piece' });
    req.flush({ id: 5, name: 'One Piece' });
    await promise;
  });

  it('rename() effectue un PATCH /api/tags/:id', async () => {
    const promise = service.rename(3, 'Nouveau nom');
    const req = httpMock.expectOne('/api/tags/3');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ name: 'Nouveau nom' });
    req.flush({ id: 3, name: 'Nouveau nom' });
    await promise;
  });

  it('remove() effectue un DELETE /api/tags/:id', async () => {
    const promise = service.remove(3);
    const req = httpMock.expectOne('/api/tags/3');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    await promise;
  });
});

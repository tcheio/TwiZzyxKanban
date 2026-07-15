import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CommentsService } from './comments.service';

describe('CommentsService', () => {
  let service: CommentsService;
  let httpMock: HttpTestingController;
  const kanbanId = 1;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CommentsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('list() effectue un GET /api/kanbans/:kanbanId/cards/:cardId/comments', async () => {
    const promise = service.list(kanbanId, 5);
    const req = httpMock.expectOne('/api/kanbans/1/cards/5/comments');
    expect(req.request.method).toBe('GET');
    req.flush([]);
    await promise;
  });

  it('create() effectue un POST avec le body', async () => {
    const promise = service.create(kanbanId, 5, 'Bonjour');
    const req = httpMock.expectOne('/api/kanbans/1/cards/5/comments');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ body: 'Bonjour' });
    req.flush({});
    await promise;
  });

  it('remove() effectue un DELETE /api/kanbans/:kanbanId/cards/:cardId/comments/:commentId', async () => {
    const promise = service.remove(kanbanId, 5, 9);
    const req = httpMock.expectOne('/api/kanbans/1/cards/5/comments/9');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    await promise;
  });
});

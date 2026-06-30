import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CommentsService } from './comments.service';

describe('CommentsService', () => {
  let service: CommentsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CommentsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('list() effectue un GET /api/cards/:cardId/comments', async () => {
    const promise = service.list(5);
    const req = httpMock.expectOne('/api/cards/5/comments');
    expect(req.request.method).toBe('GET');
    req.flush([]);
    await promise;
  });

  it('create() effectue un POST avec le body', async () => {
    const promise = service.create(5, 'Bonjour');
    const req = httpMock.expectOne('/api/cards/5/comments');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ body: 'Bonjour' });
    req.flush({});
    await promise;
  });

  it('remove() effectue un DELETE /api/cards/:cardId/comments/:commentId', async () => {
    const promise = service.remove(5, 9);
    const req = httpMock.expectOne('/api/cards/5/comments/9');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    await promise;
  });
});

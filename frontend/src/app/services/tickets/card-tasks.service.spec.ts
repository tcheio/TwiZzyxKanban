import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CardTasksService } from './card-tasks.service';

describe('CardTasksService', () => {
  let service: CardTasksService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CardTasksService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('list() effectue un GET /api/kanbans/:kanbanId/cards/:cardId/tasks', async () => {
    const promise = service.list(1, 5);
    const req = httpMock.expectOne('/api/kanbans/1/cards/5/tasks');
    expect(req.request.method).toBe('GET');
    req.flush([]);
    await promise;
  });

  it('create() effectue un POST avec le body', async () => {
    const promise = service.create(1, 5, { title: 'Écrire', assigned_user_id: 3 });
    const req = httpMock.expectOne('/api/kanbans/1/cards/5/tasks');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ title: 'Écrire', assigned_user_id: 3 });
    req.flush({});
    await promise;
  });

  it('update() effectue un PATCH sur la tâche', async () => {
    const promise = service.update(1, 5, 9, { done: true });
    const req = httpMock.expectOne('/api/kanbans/1/cards/5/tasks/9');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ done: true });
    req.flush({});
    await promise;
  });

  it('remove() effectue un DELETE sur la tâche', async () => {
    const promise = service.remove(1, 5, 9);
    const req = httpMock.expectOne('/api/kanbans/1/cards/5/tasks/9');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    await promise;
  });
});

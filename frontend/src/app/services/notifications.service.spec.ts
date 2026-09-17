import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(NotificationsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('list() effectue un GET /api/notifications', async () => {
    const promise = service.list();
    const req = httpMock.expectOne('/api/notifications');
    expect(req.request.method).toBe('GET');
    req.flush([]);
    await promise;
  });

  it('markRead() effectue un PATCH /api/notifications/:id/read', async () => {
    const promise = service.markRead(7);
    const req = httpMock.expectOne('/api/notifications/7/read');
    expect(req.request.method).toBe('PATCH');
    req.flush(null);
    await promise;
  });

  it('markAllRead() effectue un POST /api/notifications/read-all', async () => {
    const promise = service.markAllRead();
    const req = httpMock.expectOne('/api/notifications/read-all');
    expect(req.request.method).toBe('POST');
    req.flush(null);
    await promise;
  });
});

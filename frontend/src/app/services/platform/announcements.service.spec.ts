import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AnnouncementsService } from './announcements.service';

describe('AnnouncementsService', () => {
  let service: AnnouncementsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AnnouncementsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('list() effectue un GET /api/announcements', async () => {
    const promise = service.list();
    const req = httpMock.expectOne('/api/announcements');
    expect(req.request.method).toBe('GET');
    req.flush([]);
    await promise;
  });

  it('create() envoie le message et kanban_id (null si global)', async () => {
    const promise = service.create('Maintenance ce soir', null);
    const req = httpMock.expectOne('/api/announcements');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ message: 'Maintenance ce soir', kanban_id: null });
    req.flush({});
    await promise;
  });

  it('update() effectue un PATCH avec les champs modifiés', async () => {
    const promise = service.update(3, { message: 'Modifiée' });
    const req = httpMock.expectOne('/api/announcements/3');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ message: 'Modifiée' });
    req.flush({});
    await promise;
  });

  it('remove() effectue un DELETE /api/announcements/:id', async () => {
    const promise = service.remove(3);
    const req = httpMock.expectOne('/api/announcements/3');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    await promise;
  });
});

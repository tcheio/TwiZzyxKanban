import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MeService } from './me.service';

describe('MeService', () => {
  let service: MeService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(MeService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('tickets() effectue un GET /api/me/tickets', async () => {
    const promise = service.tickets();
    const req = httpMock.expectOne('/api/me/tickets');
    expect(req.request.method).toBe('GET');
    req.flush([]);
    await promise;
  });
});

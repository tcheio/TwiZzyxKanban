import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StatsService } from './stats.service';

describe('StatsService', () => {
  let service: StatsService;
  let httpMock: HttpTestingController;
  const kanbanId = 1;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(StatsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('columnDurations() effectue un GET sans paramètre si from/to sont omis', async () => {
    const promise = service.columnDurations(kanbanId);
    const req = httpMock.expectOne((r) => r.url === '/api/kanbans/1/stats/column-durations');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);
    req.flush([]);
    await promise;
  });

  it('columnDurations() transmet from/to en paramètres de requête', async () => {
    const promise = service.columnDurations(kanbanId, '2026-01-01', '2026-01-31');
    const req = httpMock.expectOne(
      (r) => r.url === '/api/kanbans/1/stats/column-durations' && r.params.get('from') === '2026-01-01' && r.params.get('to') === '2026-01-31'
    );
    req.flush([]);
    await promise;
  });

  it('userStats() effectue un GET /api/kanbans/:kanbanId/stats/users', async () => {
    const promise = service.userStats(kanbanId, '2026-01-01', '2026-01-31');
    const req = httpMock.expectOne(
      (r) => r.url === '/api/kanbans/1/stats/users' && r.params.get('from') === '2026-01-01' && r.params.get('to') === '2026-01-31'
    );
    expect(req.request.method).toBe('GET');
    req.flush([]);
    await promise;
  });
});

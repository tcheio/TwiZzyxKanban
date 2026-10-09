import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SearchService } from './search.service';

describe('SearchService', () => {
  let service: SearchService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SearchService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('searchTickets() effectue un GET /api/search/tickets avec le paramètre q', async () => {
    const promise = service.searchTickets('geoguessr');
    const req = httpMock.expectOne((r) => r.url === '/api/search/tickets' && r.params.get('q') === 'geoguessr');
    expect(req.request.method).toBe('GET');
    req.flush([
      {
        id: 6,
        title: 'GEOGUESSR INAZUMA 3',
        key: 'TK-TWIZZYX-6',
        kanban_code: 'TK-TWIZZYX',
        kanban_name: 'TwiZzyxKanban',
        column_name: 'Idées',
        cancelled: false,
      },
    ]);
    await expect(promise).resolves.toEqual([
      {
        id: 6,
        title: 'GEOGUESSR INAZUMA 3',
        key: 'TK-TWIZZYX-6',
        kanban_code: 'TK-TWIZZYX',
        kanban_name: 'TwiZzyxKanban',
        column_name: 'Idées',
        cancelled: false,
      },
    ]);
  });
});

import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GlobalSearch } from './global-search';
import { SearchService } from '../../services/search.service';
import { TicketSearchResult } from '../../models/search-result.model';

describe('GlobalSearch', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<GlobalSearch>>;
  let component: GlobalSearch;
  let searchTickets: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.fn>;

  const results: TicketSearchResult[] = [
    {
      id: 6,
      title: 'GEOGUESSR INAZUMA 3',
      key: 'TK-TWIZZYX-6',
      kanban_code: 'TK-TWIZZYX',
      kanban_name: 'TwiZzyxKanban',
      column_name: 'Idées',
      cancelled: false,
    },
  ];

  beforeEach(() => {
    searchTickets = vi.fn().mockResolvedValue(results);
    navigate = vi.fn();

    TestBed.configureTestingModule({
      imports: [GlobalSearch],
      providers: [
        { provide: SearchService, useValue: { searchTickets } },
        { provide: Router, useValue: { navigate } },
      ],
    });
    fixture = TestBed.createComponent(GlobalSearch);
    component = fixture.componentInstance;
  });

  it("onQueryChange() n'appelle pas le service en dessous de 2 caractères", () => {
    vi.useFakeTimers();
    component.onQueryChange('a');
    vi.runAllTimers();
    vi.useRealTimers();

    expect(searchTickets).not.toHaveBeenCalled();
    expect(component.results()).toEqual([]);
    expect(component.loading()).toBe(false);
  });

  it('onQueryChange() attend le debounce puis appelle le service', async () => {
    vi.useFakeTimers();
    component.onQueryChange('geoguessr');
    expect(component.loading()).toBe(true);
    expect(component.open()).toBe(true);

    vi.advanceTimersByTime(300);
    vi.useRealTimers();
    await Promise.resolve();
    await Promise.resolve();

    expect(searchTickets).toHaveBeenCalledWith('geoguessr');
    expect(component.results()).toEqual(results);
    expect(component.loading()).toBe(false);
  });

  it("onQueryChange() ne relance pas de recherche superflue si la requête change avant l'expiration du debounce", () => {
    vi.useFakeTimers();
    component.onQueryChange('geo');
    vi.advanceTimersByTime(100);
    component.onQueryChange('geogu');
    vi.advanceTimersByTime(300);
    vi.useRealTimers();

    expect(searchTickets).toHaveBeenCalledTimes(1);
    expect(searchTickets).toHaveBeenCalledWith('geogu');
  });

  it('select() navigue vers le ticket, ferme le panneau et vide la recherche', () => {
    component.query.set('geoguessr');
    component.results.set(results);
    component.open.set(true);

    component.select(results[0]);

    expect(navigate).toHaveBeenCalledWith(['/kanbans', 'TK-TWIZZYX-6']);
    expect(component.open()).toBe(false);
    expect(component.query()).toBe('');
    expect(component.results()).toEqual([]);
  });

  it('onFocus() rouvre le panneau si la requête courante est assez longue', () => {
    component.query.set('geo');
    component.open.set(false);
    component.onFocus();
    expect(component.open()).toBe(true);
  });

  it("onFocus() ne rouvre pas le panneau si la requête est trop courte", () => {
    component.query.set('g');
    component.open.set(false);
    component.onFocus();
    expect(component.open()).toBe(false);
  });

  it('onEscape() ferme le panneau', () => {
    component.open.set(true);
    component.onEscape();
    expect(component.open()).toBe(false);
  });

  it('onDocumentClick() ferme le panneau pour un clic en dehors du composant', () => {
    component.open.set(true);
    const outsideTarget = document.createElement('div');
    document.body.appendChild(outsideTarget);

    component.onDocumentClick({ target: outsideTarget } as unknown as MouseEvent);

    expect(component.open()).toBe(false);
    outsideTarget.remove();
  });

  it('onDocumentClick() ne ferme pas le panneau pour un clic à l\'intérieur du composant', () => {
    fixture.detectChanges();
    component.open.set(true);
    const insideTarget = fixture.nativeElement.querySelector('input') as HTMLElement;

    component.onDocumentClick({ target: insideTarget } as unknown as MouseEvent);

    expect(component.open()).toBe(true);
  });
});

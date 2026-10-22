import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PeriodFilter } from './period-filter';

describe('PeriodFilter', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<PeriodFilter>>;
  let component: PeriodFilter;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [PeriodFilter] });
    fixture = TestBed.createComponent(PeriodFilter);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('setFrom()/setTo() émettent la date saisie, ou null si vide', () => {
    let from: string | null | undefined;
    let to: string | null | undefined;
    component.fromChange.subscribe((v) => (from = v));
    component.toChange.subscribe((v) => (to = v));

    component.setFrom('2026-01-15');
    expect(from).toBe('2026-01-15');

    component.setTo('');
    expect(to).toBeNull();
  });

  it('applyPreset(7) émet une période de 7 jours se terminant aujourd\'hui', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00.000Z'));
    let from: string | null = null;
    let to: string | null = null;
    component.fromChange.subscribe((v) => (from = v));
    component.toChange.subscribe((v) => (to = v));

    component.applyPreset(7);

    expect(to).toBe('2026-01-15');
    expect(from).toBe('2026-01-08');
    vi.useRealTimers();
  });

  it('applyPreset(null) efface la période (émet null des deux côtés)', () => {
    let from: string | null = 'x';
    let to: string | null = 'x';
    component.fromChange.subscribe((v) => (from = v));
    component.toChange.subscribe((v) => (to = v));

    component.applyPreset(null);

    expect(from).toBeNull();
    expect(to).toBeNull();
  });

  it("applyCurrentYear() émet l'année civile en cours entière (1er janvier → 31 décembre), pas les 365 derniers jours", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T12:00:00.000Z'));
    let from: string | null = null;
    let to: string | null = null;
    component.fromChange.subscribe((v) => (from = v));
    component.toChange.subscribe((v) => (to = v));

    component.applyCurrentYear();

    expect(from).toBe('2026-01-01');
    expect(to).toBe('2026-12-31');
    vi.useRealTimers();
  });
});

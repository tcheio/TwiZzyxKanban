import { describe, it, expect } from 'vitest';
import { inPeriod } from './period';

describe('inPeriod', () => {
  it('retourne true sans borne', () => {
    expect(inPeriod('2026-01-15 10:00:00', null, null)).toBe(true);
  });

  it('respecte la borne from (incluse)', () => {
    expect(inPeriod('2026-01-15 10:00:00', '2026-01-15', null)).toBe(true);
    expect(inPeriod('2026-01-14 23:59:59', '2026-01-15', null)).toBe(false);
  });

  it('respecte la borne to (incluse)', () => {
    expect(inPeriod('2026-01-15 10:00:00', null, '2026-01-15')).toBe(true);
    expect(inPeriod('2026-01-16 00:00:01', null, '2026-01-15')).toBe(false);
  });

  it('fonctionne avec un horodatage ISO ("T")', () => {
    expect(inPeriod('2026-01-15T10:00:00.000Z', '2026-01-01', '2026-01-31')).toBe(true);
  });

  it('retourne false si la date est absente', () => {
    expect(inPeriod(null, null, null)).toBe(false);
    expect(inPeriod(undefined, null, null)).toBe(false);
  });
});

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { parseUtcDateTime, formatDateTime, formatShortDateTime } from './datetime';

declare const process: { env: Record<string, string | undefined> };

describe('datetime', () => {
  let originalTz: string | undefined;

  beforeAll(() => {
    originalTz = process.env['TZ'];
    process.env['TZ'] = 'Europe/Paris';
  });

  afterAll(() => {
    if (originalTz === undefined) delete process.env['TZ'];
    else process.env['TZ'] = originalTz;
  });

  describe('parseUtcDateTime', () => {
    it('interprète un datetime SQLite ("espace", sans fuseau) comme de l\'UTC', () => {
      const date = parseUtcDateTime('2026-01-15 14:30:00');
      expect(date.toISOString()).toBe('2026-01-15T14:30:00.000Z');
    });

    it('accepte aussi un ISO déjà au format "T...Z" sans le modifier', () => {
      const date = parseUtcDateTime('2026-01-15T14:30:00.000Z');
      expect(date.toISOString()).toBe('2026-01-15T14:30:00.000Z');
    });
  });

  describe('formatDateTime', () => {
    it('ajoute +1h (heure d\'hiver, CET) pour convertir un datetime UTC en heure de Paris', () => {
      // 14:30 UTC en janvier (hiver, pas d'heure d'été) = 15:30 à Paris.
      expect(formatDateTime('2026-01-15 14:30:00')).toBe('15-01-2026 à 15:30');
    });

    it("ajoute +2h (heure d'été, CEST) pour convertir un datetime UTC en heure de Paris", () => {
      // 14:30 UTC en juillet (heure d'été) = 16:30 à Paris.
      expect(formatDateTime('2026-07-15 14:30:00')).toBe('15-07-2026 à 16:30');
    });

    it('fait basculer le jour affiché si la conversion passe minuit', () => {
      // 23:30 UTC en hiver = 00:30 le lendemain à Paris.
      expect(formatDateTime('2026-01-15 23:30:00')).toBe('16-01-2026 à 00:30');
    });

    it('retourne la chaîne telle quelle si elle est invalide', () => {
      expect(formatDateTime('pas une date')).toBe('pas une date');
    });
  });

  describe('formatShortDateTime', () => {
    it('affiche "JJ/MM à HH:MM" converti en heure de Paris', () => {
      expect(formatShortDateTime('2026-07-15 14:30:00')).toBe('15/07 à 16:30');
    });
  });
});

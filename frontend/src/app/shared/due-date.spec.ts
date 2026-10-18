import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { daysUntilDue, dueDateLabel, isDueSoon, dueDateClass, formatDate } from './due-date';

describe('due-date', () => {
  afterEach(() => vi.useRealTimers());

  describe('daysUntilDue', () => {
    it('retourne null sans échéance', () => {
      expect(daysUntilDue(null)).toBeNull();
    });

    it("compte en jours entiers, indépendamment de l'heure du jour", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-15T23:50:00'));
      expect(daysUntilDue('2026-01-16')).toBe(1);
      expect(daysUntilDue('2026-01-15')).toBe(0);
      expect(daysUntilDue('2026-01-14')).toBe(-1);
    });
  });

  describe('dueDateLabel', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-15T10:00:00'));
    });

    it("affiche 'Aucune échéance' sans date", () => {
      expect(dueDateLabel(null)).toBe('Aucune échéance');
    });

    it("affiche 'Aujourd'hui' / 'Demain' pour J et J+1", () => {
      expect(dueDateLabel('2026-01-15')).toBe("Aujourd'hui");
      expect(dueDateLabel('2026-01-16')).toBe('Demain');
    });

    it('affiche "Dans N j" pour une échéance future au-delà de demain', () => {
      expect(dueDateLabel('2026-01-20')).toBe('Dans 5 j');
    });

    it('affiche "En retard de N j" pour une échéance dépassée', () => {
      expect(dueDateLabel('2026-01-10')).toBe('En retard de 5 j');
    });
  });

  describe('isDueSoon / dueDateClass', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-15T10:00:00'));
    });

    it('est "due soon" en retard ou dans les 7 jours, pas au-delà', () => {
      expect(isDueSoon('2026-01-10')).toBe(true);
      expect(isDueSoon('2026-01-22')).toBe(true);
      expect(isDueSoon('2026-01-23')).toBe(false);
      expect(isDueSoon(null)).toBe(false);
    });

    it('dueDateClass() distingue urgent / normal / sans échéance', () => {
      expect(dueDateClass('2026-01-16')).toBe('font-semibold text-danger');
      expect(dueDateClass('2026-02-15')).toBe('text-text-muted');
      expect(dueDateClass(null)).toBe('text-text-faint');
    });
  });

  describe('formatDate', () => {
    it('convertit YYYY-MM-DD en DD-MM-YYYY', () => {
      expect(formatDate('2026-01-15')).toBe('15-01-2026');
    });
  });
});

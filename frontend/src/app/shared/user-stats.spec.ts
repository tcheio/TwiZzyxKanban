import { describe, it, expect } from 'vitest';
import { computeUserStats, onTimeRateLabel, leadLabel } from './user-stats';
import { Card } from '../models/card.model';
import { UserStat } from '../models/stats.model';

function card(overrides: Partial<Card>): Card {
  return {
    id: 1,
    title: 'X',
    description: null,
    tag_id: null,
    epic_id: null,
    cloned_from_id: null,
    assigned_user_id: null,
    priority: 'medium',
    column_id: 1,
    position: 0,
    due_date: null,
    ...overrides,
  };
}

const users = [
  { id: 1, username: 'alice' },
  { id: 2, username: 'bob' },
];

// Colonne 1 = "En cours" (pas la dernière), colonne 2 = "Fait" (dernière par position,
// sans notion de publication) — sert à tester l'exclusion de current_workload.
const columns = [
  { id: 1, name: 'En cours', position: 0 },
  { id: 2, name: 'Fait', position: 1 },
];

describe('computeUserStats', () => {
  it("n'inclut que les utilisateurs apparaissant sur au moins une carte", () => {
    const tickets = [card({ id: 1, assigned_user_id: 1 })];
    expect(computeUserStats(tickets, users, columns).map((s) => s.user_id)).toEqual([1]);
  });

  it('inclut un responsable additionnel (assignee_ids), pas seulement le principal', () => {
    const tickets = [card({ id: 1, assigned_user_id: null, assignee_ids: [2] })];
    expect(computeUserStats(tickets, users, columns).map((s) => s.user_id)).toEqual([2]);
  });

  it('compte completed_count, on_time_count, with_due_date_count et avg_lead_days', () => {
    const tickets = [
      card({ id: 1, assigned_user_id: 1, due_date: '2026-01-10', published_at: '2026-01-08T10:00:00.000Z' }), // +2j
      card({ id: 2, assigned_user_id: 1, due_date: '2026-01-10', published_at: '2026-01-12T10:00:00.000Z' }), // -2j
    ];
    const [stat] = computeUserStats(tickets, users, columns);
    expect(stat.completed_count).toBe(2);
    expect(stat.with_due_date_count).toBe(2);
    expect(stat.on_time_count).toBe(1);
    expect(stat.avg_lead_days).toBe(0);
  });

  it('current_workload compte les cartes ni publiées ni annulées parmi celles passées en entrée', () => {
    const tickets = [
      card({ id: 1, assigned_user_id: 1, published_at: null, cancelled_at: null }),
      card({ id: 2, assigned_user_id: 1, published_at: '2026-01-08T10:00:00.000Z' }),
      card({ id: 3, assigned_user_id: 1, published_at: null, cancelled_at: '2026-01-09T10:00:00.000Z' }),
    ];
    expect(computeUserStats(tickets, users, columns)[0].current_workload).toBe(1);
  });

  it('current_workload exclut les cartes dans la dernière colonne par position (ex: "Fait"), même sans published_at', () => {
    const tickets = [
      card({ id: 1, assigned_user_id: 1, column_id: 1, published_at: null, cancelled_at: null }), // En cours
      card({ id: 2, assigned_user_id: 1, column_id: 2, published_at: null, cancelled_at: null }), // Fait
    ];
    expect(computeUserStats(tickets, users, columns)[0].current_workload).toBe(1);
  });

  it('avg_lead_days vaut null sans aucun ticket terminé avec échéance', () => {
    const tickets = [card({ id: 1, assigned_user_id: 1 })];
    expect(computeUserStats(tickets, users, columns)[0].avg_lead_days).toBeNull();
  });

  it('trie les résultats par nom', () => {
    const tickets = [card({ id: 1, assigned_user_id: 2 }), card({ id: 2, assigned_user_id: 1 })];
    expect(computeUserStats(tickets, users, columns).map((s) => s.username)).toEqual(['alice', 'bob']);
  });
});

describe('onTimeRateLabel', () => {
  const base: UserStat = {
    user_id: 1,
    username: 'alice',
    completed_count: 2,
    with_due_date_count: 2,
    on_time_count: 1,
    avg_lead_days: 0,
    current_workload: 0,
  };

  it('calcule le pourcentage arrondi', () => {
    expect(onTimeRateLabel(base)).toBe('50 %');
  });

  it("retourne '—' sans aucun ticket avec échéance", () => {
    expect(onTimeRateLabel({ ...base, with_due_date_count: 0 })).toBe('—');
  });
});

describe('leadLabel', () => {
  const base: UserStat = {
    user_id: 1,
    username: 'alice',
    completed_count: 1,
    with_due_date_count: 1,
    on_time_count: 1,
    avg_lead_days: 0,
    current_workload: 0,
  };

  it('affiche "avance" si positif', () => {
    expect(leadLabel({ ...base, avg_lead_days: 2 })).toBe('+2 j (avance)');
  });

  it('affiche "retard" si négatif', () => {
    expect(leadLabel({ ...base, avg_lead_days: -2 })).toBe('-2 j (retard)');
  });

  it("retourne '—' si null", () => {
    expect(leadLabel({ ...base, avg_lead_days: null })).toBe('—');
  });
});

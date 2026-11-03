import { describe, it, expect } from 'vitest';
import { kanbanInitials } from './kanban-initials';

describe('kanbanInitials', () => {
  it.each([
    ['TwiZzyx Kanban', 'TK'],
    ['TwiZzyxKanban', 'TK'],
    ['Dev & Co', 'DC'],
    ['DEV & CO', 'DC'],
    ['Mon super projet', 'MP'],
    ['Minecraft', 'MI'],
    ['équipe vidéo', 'ÉV'],
    ['  Projet 2026 ', 'P2'],
    ['X', 'X'],
  ])('"%s" → "%s"', (name, expected) => {
    expect(kanbanInitials(name)).toBe(expected);
  });

  it("retourne '?' pour un nom vide ou sans lettre", () => {
    expect(kanbanInitials('')).toBe('?');
    expect(kanbanInitials(null)).toBe('?');
    expect(kanbanInitials(' & ')).toBe('?');
  });
});

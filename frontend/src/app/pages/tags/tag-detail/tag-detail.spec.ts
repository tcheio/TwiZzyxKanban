import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TagDetail } from './tag-detail';
import { TagsService } from '../../../services/tags.service';
import { CardsService } from '../../../services/cards.service';
import { ColumnsService } from '../../../services/columns.service';
import { UsersService } from '../../../services/users.service';
import { Card } from '../../../models/card.model';

describe('TagDetail', () => {
  let component: TagDetail;
  let navigate: ReturnType<typeof vi.fn>;

  const tags = [
    { id: 1, name: 'Minecraft' },
    { id: 2, name: 'Pokémon' },
  ];
  const columns = [
    { id: 1, name: 'Idée', position: 0 },
    { id: 2, name: 'Publié', position: 1 },
  ];
  const users = [{ id: 1, username: 'alice' }];
  const cards: Card[] = [
    {
      id: 10,
      title: 'Dans Publié',
      channel: null,
      description: null,
      tag_id: 1,
      assigned_user_id: 1,
      priority: 'low',
      column_id: 2,
      position: 0,
    },
    {
      id: 11,
      title: 'Dans Idée',
      channel: null,
      description: null,
      tag_id: 1,
      assigned_user_id: null,
      priority: 'high',
      column_id: 1,
      position: 0,
    },
    {
      id: 12,
      title: 'Autre tag',
      channel: null,
      description: null,
      tag_id: 2,
      assigned_user_id: null,
      priority: 'medium',
      column_id: 1,
      position: 1,
    },
  ];

  function configure(id: string) {
    navigate = vi.fn();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: TagsService, useValue: { list: vi.fn().mockResolvedValue(tags) } },
        { provide: CardsService, useValue: { list: vi.fn().mockResolvedValue(cards) } },
        { provide: ColumnsService, useValue: { list: vi.fn().mockResolvedValue(columns) } },
        { provide: UsersService, useValue: { lite: vi.fn().mockResolvedValue(users) } },
        { provide: Router, useValue: { navigate } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => id } } } },
      ],
    });
    component = TestBed.createComponent(TagDetail).componentInstance;
  }

  beforeEach(() => configure('1'));

  it('reload() charge le tag et trie ses tickets par position de colonne', async () => {
    await component.reload();

    expect(component.tag()).toEqual(tags[0]);
    expect(component.tickets().map((t) => t.title)).toEqual(['Dans Idée', 'Dans Publié']);
    expect(component.error()).toBeNull();
  });

  it('reload() définit une erreur si le tag est introuvable', async () => {
    configure('999');
    await component.reload();

    expect(component.tag()).toBeNull();
    expect(component.error()).toBe('Tag introuvable.');
  });

  it('statusChart() compte les tickets par colonne', async () => {
    await component.reload();

    expect(component.statusChart()).toEqual({
      labels: ['Idée', 'Publié'],
      data: [1, 1],
    });
  });

  it('priorityChart() compte les tickets par priorité', async () => {
    await component.reload();

    expect(component.priorityChart()).toEqual({
      labels: ['Basse', 'Moyenne', 'Haute'],
      data: [1, 0, 1],
    });
  });

  it('columnName()/userName() résolvent les libellés', async () => {
    await component.reload();

    expect(component.columnName(1)).toBe('Idée');
    expect(component.userName(1)).toBe('alice');
    expect(component.userName(null)).toBe('—');
  });

  it('openTicket() navigue vers la page du ticket', async () => {
    await component.reload();

    component.openTicket(cards[0]);

    expect(navigate).toHaveBeenCalledWith(['/tickets', cards[0].id]);
  });
});

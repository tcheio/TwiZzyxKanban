import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TicketsList } from './tickets-list';
import { ColumnsService } from '../../../services/columns.service';
import { CardsService } from '../../../services/cards.service';
import { UsersService } from '../../../services/users.service';
import { Card } from '../../../models/card.model';

describe('TicketsList', () => {
  let component: TicketsList;
  let cardsService: { list: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  let navigate: ReturnType<typeof vi.fn>;

  const columns = [
    { id: 1, name: 'Idée', position: 0 },
    { id: 2, name: 'Script', position: 1 },
    { id: 3, name: 'Publié', position: 2 },
  ];
  const users = [{ id: 1, username: 'alice' }];
  const cards: Card[] = [
    {
      id: 10,
      title: 'Dans Publié',
      channel: null,
      description: null,
      assigned_user_id: null,
      priority: 'low',
      column_id: 3,
      position: 0,
    },
    {
      id: 11,
      title: 'Dans Idée',
      channel: null,
      description: null,
      assigned_user_id: 1,
      priority: 'high',
      column_id: 1,
      position: 0,
    },
    {
      id: 12,
      title: 'Dans Script',
      channel: null,
      description: null,
      assigned_user_id: null,
      priority: 'medium',
      column_id: 2,
      position: 0,
    },
  ];

  beforeEach(() => {
    navigate = vi.fn();
    cardsService = {
      list: vi.fn().mockResolvedValue(cards),
      create: vi.fn().mockResolvedValue({ id: 99 }),
    };

    TestBed.configureTestingModule({
      imports: [TicketsList],
      providers: [
        { provide: ColumnsService, useValue: { list: vi.fn().mockResolvedValue(columns) } },
        { provide: CardsService, useValue: cardsService },
        { provide: UsersService, useValue: { lite: vi.fn().mockResolvedValue(users) } },
        { provide: Router, useValue: { navigate } },
      ],
    });
    component = TestBed.createComponent(TicketsList).componentInstance;
  });

  it('reload() trie les tickets par position de colonne (les tickets de la dernière colonne en dernier)', async () => {
    await component.reload();

    expect(component.tickets().map((t) => t.title)).toEqual(['Dans Idée', 'Dans Script', 'Dans Publié']);
  });

  it('columnName()/userName() résolvent les libellés', async () => {
    await component.reload();

    expect(component.columnName(2)).toBe('Script');
    expect(component.userName(1)).toBe('alice');
    expect(component.userName(null)).toBe('—');
  });

  it('openTicket() navigue vers la page dédiée', async () => {
    await component.reload();

    component.openTicket(cards[0]);

    expect(navigate).toHaveBeenCalledWith(['/tickets', cards[0].id]);
  });

  it('createTicket() crée le ticket puis navigue vers sa page dédiée', async () => {
    await component.reload();
    component.dialogOpen.set(true);

    await component.createTicket({
      title: 'Nouveau',
      channel: null,
      column_id: 1,
      assigned_user_id: null,
      priority: 'medium',
    });

    expect(cardsService.create).toHaveBeenCalled();
    expect(component.dialogOpen()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/tickets', 99]);
  });
});

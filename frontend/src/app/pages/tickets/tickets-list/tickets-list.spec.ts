import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TicketsList } from './tickets-list';
import { ColumnsService } from '../../../services/columns.service';
import { CardsService } from '../../../services/cards.service';
import { UsersService } from '../../../services/users.service';
import { TagsService } from '../../../services/tags.service';
import { EpicsService } from '../../../services/epics.service';
import { AuthService } from '../../../core/auth.service';
import { Card } from '../../../models/card.model';

describe('TicketsList', () => {
  let component: TicketsList;
  let fixture: ReturnType<typeof TestBed.createComponent<TicketsList>>;
  let cardsService: { list: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  let tagsService: { list: ReturnType<typeof vi.fn> };
  let navigate: ReturnType<typeof vi.fn>;
  let isAdmin: ReturnType<typeof vi.fn>;

  const columns = [
    { id: 1, name: 'Idée', position: 0 },
    { id: 2, name: 'Script', position: 1 },
    { id: 3, name: 'Publié', position: 2 },
  ];
  const users = [
    { id: 1, username: 'alice' },
    { id: 2, username: 'bob' },
  ];
  const tags = [
    { id: 1, name: 'Minecraft' },
    { id: 2, name: 'Pokémon' },
  ];
  const cards: Card[] = [
    {
      id: 10,
      title: 'Dans Publié',
      description: null,
      tag_id: 2,
      epic_id: null,
      assigned_user_id: null,
      priority: 'low',
      column_id: 3,
      position: 0,
      due_date: null,
    },
    {
      id: 11,
      title: 'Dans Idée',
      description: null,
      tag_id: 1,
      epic_id: null,
      assigned_user_id: 1,
      priority: 'high',
      column_id: 1,
      position: 0,
      due_date: null,
    },
    {
      id: 12,
      title: 'Dans Script',
      description: null,
      tag_id: null,
      epic_id: null,
      assigned_user_id: 2,
      priority: 'medium',
      column_id: 2,
      position: 0,
      due_date: null,
    },
  ];

  beforeEach(() => {
    navigate = vi.fn();
    isAdmin = vi.fn().mockReturnValue(true);
    cardsService = {
      list: vi.fn().mockResolvedValue(cards),
      create: vi.fn().mockResolvedValue({ id: 99 }),
    };
    tagsService = {
      list: vi.fn().mockResolvedValue(tags),
    };

    TestBed.configureTestingModule({
      imports: [TicketsList],
      providers: [
        { provide: ColumnsService, useValue: { list: vi.fn().mockResolvedValue(columns) } },
        { provide: CardsService, useValue: cardsService },
        { provide: UsersService, useValue: { lite: vi.fn().mockResolvedValue(users) } },
        { provide: TagsService, useValue: tagsService },
        { provide: EpicsService, useValue: { list: vi.fn().mockResolvedValue([]) } },
        { provide: AuthService, useValue: { isAdmin } },
        { provide: Router, useValue: { navigate } },
      ],
    });
    fixture = TestBed.createComponent(TicketsList);
    component = fixture.componentInstance;
  });

  it('affiche le bouton "+ Nouveau ticket" pour un admin', async () => {
    await component.reload();
    fixture.detectChanges();

    const button = (fixture.nativeElement as HTMLElement).querySelector('.header button');
    expect(button).toBeTruthy();
  });

  it('masque le bouton "+ Nouveau ticket" pour un non-admin', async () => {
    isAdmin.mockReturnValue(false);
    await component.reload();
    fixture.detectChanges();

    const button = (fixture.nativeElement as HTMLElement).querySelector('.header button');
    expect(button).toBeFalsy();
  });

  it('reload() trie les tickets par position de colonne (les tickets de la dernière colonne en dernier)', async () => {
    await component.reload();

    expect(component.tickets().map((t) => t.title)).toEqual(['Dans Idée', 'Dans Script', 'Dans Publié']);
  });

  it('columnName()/userName()/tagName() résolvent les libellés', async () => {
    await component.reload();

    expect(component.columnName(2)).toBe('Script');
    expect(component.userName(1)).toBe('alice');
    expect(component.userName(null)).toBe('—');
    expect(component.tagName(1)).toBe('Minecraft');
    expect(component.tagName(null)).toBe('—');
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
      column_id: 1,
      tag_id: null,
      epic_id: null,
      assigned_user_id: null,
      priority: 'medium',
    });

    expect(cardsService.create).toHaveBeenCalled();
    expect(component.dialogOpen()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/tickets', 99]);
  });

  it('filteredTickets() sans filtre retourne tous les tickets', async () => {
    await component.reload();

    expect(component.filteredTickets().length).toBe(3);
    expect(component.hasActiveFilters()).toBe(false);
  });

  it('filteredTickets() filtre par tag', async () => {
    await component.reload();
    component.filterTagId.set(1);

    expect(component.filteredTickets().map((t) => t.title)).toEqual(['Dans Idée']);
    expect(component.hasActiveFilters()).toBe(true);
  });

  it('filteredTickets() filtre par assigné', async () => {
    await component.reload();
    component.filterAssigneeId.set(2);

    expect(component.filteredTickets().map((t) => t.title)).toEqual(['Dans Script']);
  });

  it('filteredTickets() filtre par statut (colonne)', async () => {
    await component.reload();
    component.filterColumnId.set(3);

    expect(component.filteredTickets().map((t) => t.title)).toEqual(['Dans Publié']);
  });

  it('filteredTickets() combine les filtres', async () => {
    await component.reload();
    component.filterTagId.set(1);
    component.filterAssigneeId.set(1);

    expect(component.filteredTickets().map((t) => t.title)).toEqual(['Dans Idée']);

    component.filterColumnId.set(2);
    expect(component.filteredTickets()).toEqual([]);
  });

  it('resetFilters() réinitialise tous les filtres', async () => {
    await component.reload();
    component.filterTagId.set(1);
    component.filterAssigneeId.set(1);
    component.filterColumnId.set(2);

    component.resetFilters();

    expect(component.filterTagId()).toBeNull();
    expect(component.filterAssigneeId()).toBeNull();
    expect(component.filterColumnId()).toBeNull();
    expect(component.hasActiveFilters()).toBe(false);
  });
});

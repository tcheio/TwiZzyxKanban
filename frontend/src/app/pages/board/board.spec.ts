import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Board } from './board';
import { ColumnsService } from '../../services/columns.service';
import { CardsService } from '../../services/cards.service';
import { UsersService } from '../../services/users.service';
import { TagsService } from '../../services/tags.service';
import { EpicsService } from '../../services/epics.service';
import { Card } from '../../models/card.model';
import { Column } from '../../models/column.model';

describe('Board', () => {
  let component: Board;
  let columnsService: {
    list: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    rename: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    reorder: ReturnType<typeof vi.fn>;
  };
  let cardsService: {
    list: ReturnType<typeof vi.fn>;
    move: ReturnType<typeof vi.fn>;
  };
  let usersService: { liteForKanban: ReturnType<typeof vi.fn> };
  let navigate: ReturnType<typeof vi.fn>;

  const columns: Column[] = [
    { id: 1, name: 'Idée', position: 0 },
    { id: 2, name: 'Script', position: 1 },
  ];
  const baseCards: Card[] = [
    {
      id: 10,
      title: 'A',
      description: null,
      tag_id: 1,
      epic_id: null,
      cloned_from_id: null,
      assigned_user_id: null,
      priority: 'medium',
      column_id: 1,
      position: 0,
      due_date: null,
    },
    {
      id: 11,
      title: 'B',
      description: null,
      tag_id: null,
      epic_id: null,
      cloned_from_id: null,
      assigned_user_id: null,
      priority: 'medium',
      column_id: 1,
      position: 1,
      due_date: null,
    },
    {
      id: 12,
      title: 'C',
      description: null,
      tag_id: null,
      epic_id: null,
      cloned_from_id: null,
      assigned_user_id: 1,
      priority: 'medium',
      column_id: 2,
      position: 0,
      due_date: null,
    },
  ];
  const users = [{ id: 1, username: 'alice', avatar_url: 'data:image/jpeg;base64,abc' }];
  const tags = [{ id: 1, name: 'Minecraft' }];

  beforeEach(() => {
    columnsService = {
      list: vi.fn().mockResolvedValue(columns),
      create: vi.fn().mockResolvedValue({}),
      rename: vi.fn().mockResolvedValue({}),
      remove: vi.fn().mockResolvedValue(undefined),
      reorder: vi.fn().mockResolvedValue([]),
    };
    cardsService = {
      list: vi.fn().mockResolvedValue([...baseCards]),
      move: vi.fn().mockResolvedValue({}),
    };
    usersService = { liteForKanban: vi.fn().mockResolvedValue(users) };
    navigate = vi.fn();

    TestBed.configureTestingModule({
      imports: [Board],
      providers: [
        { provide: ColumnsService, useValue: columnsService },
        { provide: CardsService, useValue: cardsService },
        { provide: UsersService, useValue: usersService },
        { provide: TagsService, useValue: { list: vi.fn().mockResolvedValue(tags) } },
        { provide: EpicsService, useValue: { list: vi.fn().mockResolvedValue([]) } },
        { provide: Router, useValue: { navigate } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => '1' } } } },
      ],
    });
    component = TestBed.createComponent(Board).componentInstance;
  });

  it('reload() regroupe les cartes par colonne, triées par position', async () => {
    await component.reload();

    const groups = component.groups();
    expect(groups.length).toBe(2);
    expect(groups[0].cards.map((c) => c.title)).toEqual(['A', 'B']);
    expect(groups[1].cards.map((c) => c.title)).toEqual(['C']);
    expect(component.loading()).toBe(false);
    expect(component.error()).toBeNull();
  });

  it('userName() retourne le username ou un tiret', async () => {
    await component.reload();

    expect(component.userName(1)).toBe('alice');
    expect(component.userName(null)).toBe('—');
    expect(component.userName(999)).toBe('—');
  });

  it('tagName() retourne le nom du tag ou null', async () => {
    await component.reload();

    expect(component.tagName(1)).toBe('Minecraft');
    expect(component.tagName(null)).toBeNull();
    expect(component.tagName(999)).toBeNull();
  });

  it('openTicket() navigue vers la page dédiée du ticket', async () => {
    await component.reload();

    component.openTicket(baseCards[0]);

    expect(navigate).toHaveBeenCalledWith(['/kanbans', `1-${baseCards[0].id}`]);
  });

  it('drop() réordonne dans la même colonne et appelle move() avec le bon index', async () => {
    await component.reload();
    const containerData = component.groups()[0].cards;
    const container = { data: containerData, id: 'col-1' };
    const event = {
      previousContainer: container,
      container,
      previousIndex: 0,
      currentIndex: 1,
    } as unknown as CdkDragDrop<Card[]>;

    await component.drop(event);

    expect(cardsService.move).toHaveBeenCalledWith(1, 10, 1, 1);
  });

  it("drop() déplace vers une autre colonne et appelle move() avec le columnId cible", async () => {
    await component.reload();
    const groups = component.groups();
    const event = {
      previousContainer: { data: groups[0].cards, id: 'col-1' },
      container: { data: groups[1].cards, id: 'col-2' },
      previousIndex: 0,
      currentIndex: 1,
    } as unknown as CdkDragDrop<Card[]>;

    await component.drop(event);

    expect(cardsService.move).toHaveBeenCalledWith(1, 10, 2, 1);
  });

  it('userInitial() retourne la première lettre du username ou "?"', async () => {
    await component.reload();

    expect(component.userInitial(1)).toBe('A');
    expect(component.userInitial(null)).toBe('?');
    expect(component.userInitial(999)).toBe('?');
  });

  it('userAvatar() retourne la photo de profil ou null', async () => {
    await component.reload();

    expect(component.userAvatar(1)).toBe('data:image/jpeg;base64,abc');
    expect(component.userAvatar(null)).toBeNull();
    expect(component.userAvatar(999)).toBeNull();
  });

  it('visibleCards() retourne toutes les cartes sans filtre, puis seulement celles du destinataire choisi', async () => {
    await component.reload();
    const group = component.groups()[0];

    expect(component.visibleCards(group).map((c) => c.title)).toEqual(['A', 'B']);

    component.toggleAssigneeFilter(1);
    const assignedGroup = component.groups()[1];
    expect(component.visibleCards(group)).toEqual([]);
    expect(component.visibleCards(assignedGroup).map((c) => c.title)).toEqual(['C']);
  });

  it('toggleAssigneeFilter() active puis désactive le filtre sur un second clic', () => {
    expect(component.selectedAssigneeId()).toBeNull();

    component.toggleAssigneeFilter(1);
    expect(component.selectedAssigneeId()).toBe(1);

    component.toggleAssigneeFilter(1);
    expect(component.selectedAssigneeId()).toBeNull();
  });

  it('clearAssigneeFilter() réinitialise le filtre', () => {
    component.toggleAssigneeFilter(1);
    component.clearAssigneeFilter();

    expect(component.selectedAssigneeId()).toBeNull();
  });

  it('priorityClass() retourne la classe Tailwind associée à la priorité', () => {
    expect(component.priorityClass('low')).toBe('bg-gray-400');
    expect(component.priorityClass('medium')).toBe('bg-amber-500');
    expect(component.priorityClass('high')).toBe('bg-red-600');
  });

  it('tagClass() retourne une classe Tailwind stable pour un tag et vide sinon', () => {
    expect(component.tagClass(null)).toBe('');
    expect(component.tagClass(1)).toBe(component.tagClass(1));
    expect(component.tagClass(1)).not.toBe('');
  });

  it('formatDate() convertit AAAA-MM-JJ en JJ-MM-AAAA', () => {
    expect(component.formatDate('2026-07-03')).toBe('03-07-2026');
    expect(component.formatDate('2026-01-15')).toBe('15-01-2026');
  });

  it('isDueSoon() retourne true à 7 jours ou moins et false au-delà', () => {
    const soon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const far = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString();

    expect(component.isDueSoon(soon)).toBe(true);
    expect(component.isDueSoon(far)).toBe(false);
    expect(component.isDueSoon(null)).toBe(false);
  });

  it('reload() masque un ticket publié depuis plus de 14 jours', async () => {
    const publishedColumns: Column[] = [...columns, { id: 3, name: '✅Publié', position: 2 }];
    const oldPublishedAt = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
    const recentPublishedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const publishedCards: Card[] = [
      { ...baseCards[0], id: 20, title: 'Ancien', column_id: 3, published_at: oldPublishedAt },
      { ...baseCards[0], id: 21, title: 'Récent', column_id: 3, published_at: recentPublishedAt },
    ];
    columnsService.list.mockResolvedValue(publishedColumns);
    cardsService.list.mockResolvedValue([...baseCards, ...publishedCards]);

    await component.reload();

    const publishedGroup = component.groups().find((g) => g.column.id === 3);
    expect(publishedGroup?.cards.map((c) => c.title)).toEqual(['Récent']);
  });

  it("canEnter() empêche un ticket publié d'entrer dans une autre colonne mais autorise le réordonnancement", async () => {
    const publishedColumns: Column[] = [...columns, { id: 3, name: '✅Publié', position: 2 }];
    const publishedCard: Card = { ...baseCards[0], id: 20, title: 'Publié A', column_id: 3, published_at: new Date().toISOString() };
    columnsService.list.mockResolvedValue(publishedColumns);
    cardsService.list.mockResolvedValue([...baseCards, publishedCard]);
    await component.reload();

    const drag = { data: publishedCard } as unknown as Parameters<typeof component.canEnter>[0];
    const otherList = { id: 'col-1' } as unknown as Parameters<typeof component.canEnter>[1];
    const sameList = { id: 'col-3' } as unknown as Parameters<typeof component.canEnter>[1];

    expect(component.canEnter(drag, otherList)).toBe(false);
    expect(component.canEnter(drag, sameList)).toBe(true);
  });

  it('drop() ne déplace pas un ticket publié vers une autre colonne', async () => {
    const publishedColumns: Column[] = [...columns, { id: 3, name: '✅Publié', position: 2 }];
    const publishedCard: Card = { ...baseCards[0], id: 20, title: 'Publié A', column_id: 3, published_at: new Date().toISOString() };
    columnsService.list.mockResolvedValue(publishedColumns);
    cardsService.list.mockResolvedValue([...baseCards, publishedCard]);
    await component.reload();

    const publishedGroupCards = component.groups().find((g) => g.column.id === 3)!.cards;
    const targetCards = component.groups()[0].cards;
    const event = {
      previousContainer: { data: publishedGroupCards, id: 'col-3' },
      container: { data: targetCards, id: 'col-1' },
      previousIndex: 0,
      currentIndex: 0,
    } as unknown as CdkDragDrop<Card[]>;

    await component.drop(event);

    expect(cardsService.move).not.toHaveBeenCalled();
  });

  it('affiche un toast pendant 6 secondes lors d\'une tentative de déplacement hors de Publié', async () => {
    vi.useFakeTimers();
    const publishedColumns: Column[] = [...columns, { id: 3, name: '✅Publié', position: 2 }];
    const publishedCard: Card = { ...baseCards[0], id: 20, title: 'Publié A', column_id: 3, published_at: new Date().toISOString() };
    columnsService.list.mockResolvedValue(publishedColumns);
    cardsService.list.mockResolvedValue([...baseCards, publishedCard]);
    await component.reload();

    const drag = { data: publishedCard } as unknown as Parameters<typeof component.canEnter>[0];
    const otherList = { id: 'col-1' } as unknown as Parameters<typeof component.canEnter>[1];

    component.onDragStarted();
    component.canEnter(drag, otherList);
    component.onDragEnded();

    expect(component.toastMessage()).toBe('Un ticket publié ne peut plus être déplacé vers une autre colonne.');

    vi.advanceTimersByTime(5999);
    expect(component.toastMessage()).not.toBeNull();

    vi.advanceTimersByTime(1);
    expect(component.toastMessage()).toBeNull();

    vi.useRealTimers();
  });

  it("n'affiche pas de toast quand le déplacement est autorisé", async () => {
    await component.reload();

    const drag = { data: baseCards[0] } as unknown as Parameters<typeof component.canEnter>[0];
    const otherList = { id: 'col-2' } as unknown as Parameters<typeof component.canEnter>[1];

    component.onDragStarted();
    component.canEnter(drag, otherList);
    component.onDragEnded();

    expect(component.toastMessage()).toBeNull();
  });
});

import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TagDetail } from './tag-detail';
import { TagsService } from '../../../services/board/tags.service';
import { CardsService } from '../../../services/tickets/cards.service';
import { ColumnsService } from '../../../services/board/columns.service';
import { UsersService } from '../../../services/account/users.service';
import { Card } from '../../../models/card.model';

describe('TagDetail', () => {
  let component: TagDetail;
  let navigate: ReturnType<typeof vi.fn>;
  let paramMap$: Subject<{ get: (key: string) => string | null }>;
  let tagsService: { list: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  let cardsService: { list: ReturnType<typeof vi.fn> };

  const tags = [
    { id: 1, name: 'Minecraft', color: 'emerald', archived: false },
    { id: 2, name: 'Pokémon', color: 'red', archived: false },
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
      description: null,
      tag_id: 1,
      epic_id: null,
      cloned_from_id: null,
      assigned_user_id: 1,
      priority: 'low',
      column_id: 2,
      position: 0,
      due_date: null,
      created_at: '2026-01-15 10:00:00',
    },
    {
      id: 11,
      title: 'Dans Idée',
      description: null,
      tag_id: 1,
      epic_id: null,
      cloned_from_id: null,
      assigned_user_id: null,
      priority: 'high',
      column_id: 1,
      position: 0,
      due_date: null,
      created_at: '2026-02-15 10:00:00',
    },
    {
      id: 12,
      title: 'Autre tag',
      description: null,
      tag_id: 2,
      epic_id: null,
      cloned_from_id: null,
      assigned_user_id: null,
      priority: 'medium',
      column_id: 1,
      position: 1,
      due_date: null,
      created_at: '2026-02-20 10:00:00',
    },
  ];

  function configure(id: string, isModerator = true) {
    navigate = vi.fn();
    paramMap$ = new Subject();
    tagsService = { list: vi.fn().mockResolvedValue(tags), update: vi.fn().mockResolvedValue({}) };
    cardsService = { list: vi.fn().mockResolvedValue(cards) };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: TagsService, useValue: tagsService },
        { provide: CardsService, useValue: cardsService },
        { provide: ColumnsService, useValue: { list: vi.fn().mockResolvedValue(columns) } },
        { provide: UsersService, useValue: { liteForKanban: vi.fn().mockResolvedValue(users) } },
        { provide: Router, useValue: { navigate } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: { kanban: { id: 1, name: 'Kanban Test', code: 'TK-TEST', is_moderator: isModerator } },
              paramMap: { get: () => id },
            },
            paramMap: paramMap$.asObservable(),
          },
        },
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
      labels: ['Faible', 'Moyen', 'Élevé'],
      data: [1, 0, 1],
    });
  });

  it('filteredTickets() retourne tous les tickets sans période définie', async () => {
    await component.reload();
    expect(component.filteredTickets().length).toBe(2);
  });

  it('filteredTickets() filtre par date de création (periodFrom/periodTo)', async () => {
    await component.reload();

    component.periodFrom.set('2026-02-01');
    expect(component.filteredTickets().map((t) => t.id)).toEqual([11]);

    component.periodFrom.set(null);
    component.periodTo.set('2026-01-31');
    expect(component.filteredTickets().map((t) => t.id)).toEqual([10]);
  });

  it('statusChart()/priorityChart() se basent sur filteredTickets(), pas sur tous les tickets', async () => {
    await component.reload();
    component.periodTo.set('2026-01-31');

    expect(component.statusChart()).toEqual({ labels: ['Idée', 'Publié'], data: [0, 1] });
    expect(component.priorityChart()).toEqual({ labels: ['Faible', 'Moyen', 'Élevé'], data: [1, 0, 0] });
  });

  it('excludeIdea() exclut les tickets dont la colonne est "💡Idées"', async () => {
    const ideaColumns = [
      { id: 1, name: '💡Idées', position: 0 },
      { id: 2, name: 'Publié', position: 1 },
    ];
    cardsService.list.mockResolvedValue([
      { ...cards[0], column_id: 1 },
      { ...cards[1], id: 20, column_id: 2 },
    ]);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: TagsService, useValue: tagsService },
        { provide: CardsService, useValue: cardsService },
        { provide: ColumnsService, useValue: { list: vi.fn().mockResolvedValue(ideaColumns) } },
        { provide: UsersService, useValue: { liteForKanban: vi.fn().mockResolvedValue(users) } },
        { provide: Router, useValue: { navigate } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: { kanban: { id: 1, name: 'Kanban Test', code: 'TK-TEST', is_moderator: true } },
              paramMap: { get: () => '1' },
            },
            paramMap: paramMap$.asObservable(),
          },
        },
      ],
    });
    component = TestBed.createComponent(TagDetail).componentInstance;
    await component.reload();

    expect(component.filteredTickets().length).toBe(2);

    component.excludeIdea.set(true);
    expect(component.filteredTickets().map((t) => t.id)).toEqual([20]);
  });

  it('userStats() calcule les stats par responsable à partir des tickets filtrés du tag', async () => {
    cardsService.list.mockResolvedValue([
      { ...cards[0], assigned_user_id: 1, published_at: '2026-01-16 10:00:00', due_date: '2026-01-20' },
      { ...cards[1], assigned_user_id: 1, published_at: null, due_date: null },
    ]);
    await component.reload();

    expect(component.userStats()).toEqual([
      {
        user_id: 1,
        username: 'alice',
        completed_count: 1,
        with_due_date_count: 1,
        on_time_count: 1,
        avg_lead_days: 4,
        current_workload: 1,
      },
    ]);
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

    expect(navigate).toHaveBeenCalledWith(['/kanbans', `TK-TEST-${cards[0].id}`]);
  });

  it('ngOnInit() recharge le tag à chaque changement de paramètre de route (navigation directe entre tags)', async () => {
    const reloadSpy = vi.spyOn(component, 'reload');
    component.ngOnInit();

    paramMap$.next({ get: () => '1' });
    await reloadSpy.mock.results[0].value;
    expect(component.tag()?.id).toBe(1);

    paramMap$.next({ get: () => '2' });
    await reloadSpy.mock.results[1].value;
    expect(component.tag()?.id).toBe(2);
  });

  it('unarchiveTag() réactive le tag après confirmation', async () => {
    tagsService.list.mockResolvedValue([{ ...tags[0], archived: true }, tags[1]]);
    tagsService.update.mockResolvedValue({ ...tags[0], archived: false });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await component.reload();

    await component.unarchiveTag();

    expect(tagsService.update).toHaveBeenCalledWith(1, 1, { archived: false });
    expect(component.tag()?.archived).toBe(false);
  });

  it("unarchiveTag() ne fait rien si l'utilisateur annule la confirmation", async () => {
    tagsService.list.mockResolvedValue([{ ...tags[0], archived: true }, tags[1]]);
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    await component.reload();

    await component.unarchiveTag();

    expect(tagsService.update).not.toHaveBeenCalled();
  });

  it('affiche le bouton "Désarchiver" pour un tag archivé, uniquement pour un modérateur', async () => {
    tagsService.list.mockResolvedValue([{ ...tags[0], archived: true }, tags[1]]);
    const fixture = TestBed.createComponent(TagDetail);
    component = fixture.componentInstance;
    await component.reload();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.unarchive-btn')).toBeTruthy();
  });

  it('masque le bouton "Désarchiver" pour un non-modérateur', async () => {
    configure('1', false);
    tagsService.list.mockResolvedValue([{ ...tags[0], archived: true }, tags[1]]);
    const fixture = TestBed.createComponent(TagDetail);
    component = fixture.componentInstance;
    await component.reload();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.unarchive-btn')).toBeFalsy();
  });
});

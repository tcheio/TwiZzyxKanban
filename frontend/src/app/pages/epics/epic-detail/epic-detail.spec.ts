import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EpicDetail } from './epic-detail';
import { EpicsService } from '../../../services/epics.service';
import { CardsService } from '../../../services/cards.service';
import { ColumnsService } from '../../../services/columns.service';
import { UsersService } from '../../../services/users.service';
import { Card } from '../../../models/card.model';

describe('EpicDetail', () => {
  let component: EpicDetail;
  let navigate: ReturnType<typeof vi.fn>;
  let paramMap$: Subject<{ get: (key: string) => string | null }>;

  const epics = [
    { id: 1, name: 'TwiZzyx', color: 'red' },
    { id: 2, name: 'Twitch', color: 'violet' },
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
      tag_id: null,
      epic_id: 1,
      assigned_user_id: 1,
      priority: 'low',
      column_id: 2,
      position: 0,
      due_date: null,
    },
    {
      id: 11,
      title: 'Dans Idée',
      description: null,
      tag_id: null,
      epic_id: 1,
      assigned_user_id: null,
      priority: 'high',
      column_id: 1,
      position: 0,
      due_date: null,
    },
    {
      id: 12,
      title: 'Autre epic',
      description: null,
      tag_id: null,
      epic_id: 2,
      assigned_user_id: null,
      priority: 'medium',
      column_id: 1,
      position: 1,
      due_date: null,
    },
  ];

  function configure(id: string) {
    navigate = vi.fn();
    paramMap$ = new Subject();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: EpicsService, useValue: { list: vi.fn().mockResolvedValue(epics) } },
        { provide: CardsService, useValue: { list: vi.fn().mockResolvedValue(cards) } },
        { provide: ColumnsService, useValue: { list: vi.fn().mockResolvedValue(columns) } },
        { provide: UsersService, useValue: { lite: vi.fn().mockResolvedValue(users) } },
        { provide: Router, useValue: { navigate } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => id } }, paramMap: paramMap$.asObservable() },
        },
      ],
    });
    component = TestBed.createComponent(EpicDetail).componentInstance;
  }

  beforeEach(() => configure('1'));

  it("reload() charge l'EPIC et trie ses tickets par position de colonne", async () => {
    await component.reload();

    expect(component.epic()).toEqual(epics[0]);
    expect(component.tickets().map((t) => t.title)).toEqual(['Dans Idée', 'Dans Publié']);
    expect(component.error()).toBeNull();
  });

  it("reload() définit une erreur si l'EPIC est introuvable", async () => {
    configure('999');
    await component.reload();

    expect(component.epic()).toBeNull();
    expect(component.error()).toBe('EPIC introuvable.');
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

  it("ngOnInit() recharge l'EPIC à chaque changement de paramètre de route (navigation directe entre EPICs)", async () => {
    const reloadSpy = vi.spyOn(component, 'reload');
    component.ngOnInit();

    paramMap$.next({ get: () => '1' });
    await reloadSpy.mock.results[0].value;
    expect(component.epic()?.id).toBe(1);

    paramMap$.next({ get: () => '2' });
    await reloadSpy.mock.results[1].value;
    expect(component.epic()?.id).toBe(2);
  });
});

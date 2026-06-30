import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Board } from './board';
import { ColumnsService } from '../../services/columns.service';
import { CardsService } from '../../services/cards.service';
import { UsersService } from '../../services/users.service';
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
    remove: ReturnType<typeof vi.fn>;
    move: ReturnType<typeof vi.fn>;
  };
  let usersService: { lite: ReturnType<typeof vi.fn> };
  let navigate: ReturnType<typeof vi.fn>;

  const columns: Column[] = [
    { id: 1, name: 'Idée', position: 0 },
    { id: 2, name: 'Script', position: 1 },
  ];
  const baseCards: Card[] = [
    {
      id: 10,
      title: 'A',
      channel: null,
      description: null,
      assigned_user_id: null,
      priority: 'medium',
      column_id: 1,
      position: 0,
    },
    {
      id: 11,
      title: 'B',
      channel: null,
      description: null,
      assigned_user_id: null,
      priority: 'medium',
      column_id: 1,
      position: 1,
    },
    {
      id: 12,
      title: 'C',
      channel: null,
      description: null,
      assigned_user_id: 1,
      priority: 'medium',
      column_id: 2,
      position: 0,
    },
  ];
  const users = [{ id: 1, username: 'alice' }];

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
      remove: vi.fn().mockResolvedValue(undefined),
      move: vi.fn().mockResolvedValue({}),
    };
    usersService = { lite: vi.fn().mockResolvedValue(users) };
    navigate = vi.fn();

    TestBed.configureTestingModule({
      imports: [Board],
      providers: [
        { provide: ColumnsService, useValue: columnsService },
        { provide: CardsService, useValue: cardsService },
        { provide: UsersService, useValue: usersService },
        { provide: Router, useValue: { navigate } },
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

  it('openTicket() navigue vers la page dédiée du ticket', async () => {
    await component.reload();

    component.openTicket(baseCards[0]);

    expect(navigate).toHaveBeenCalledWith(['/tickets', baseCards[0].id]);
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

    expect(cardsService.move).toHaveBeenCalledWith(10, 1, 1);
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

    expect(cardsService.move).toHaveBeenCalledWith(10, 2, 1);
  });

  it('deleteCard() supprime après confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await component.reload();

    await component.deleteCard(baseCards[0]);

    expect(cardsService.remove).toHaveBeenCalledWith(baseCards[0].id);
  });

  it("deleteCard() n'appelle pas remove() si l'utilisateur annule", async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    await component.reload();

    await component.deleteCard(baseCards[0]);

    expect(cardsService.remove).not.toHaveBeenCalled();
  });

  it('addColumn() crée une colonne et réinitialise le champ', async () => {
    component.newColumnName.set('Archivé');
    component.addingColumn.set(true);

    await component.addColumn();

    expect(columnsService.create).toHaveBeenCalledWith('Archivé');
    expect(component.newColumnName()).toBe('');
    expect(component.addingColumn()).toBe(false);
  });

  it("addColumn() ne fait rien si le nom est vide ou ne contient que des espaces", async () => {
    component.newColumnName.set('   ');

    await component.addColumn();

    expect(columnsService.create).not.toHaveBeenCalled();
  });

  it('renameColumn() ne fait rien si le nom est inchangé', async () => {
    await component.renameColumn(columns[0], 'Idée');

    expect(columnsService.rename).not.toHaveBeenCalled();
  });

  it('renameColumn() appelle le service si le nom change', async () => {
    await component.renameColumn(columns[0], 'Brouillon');

    expect(columnsService.rename).toHaveBeenCalledWith(1, 'Brouillon');
  });

  it('deleteColumn() supprime après confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await component.reload();

    await component.deleteColumn(columns[0]);

    expect(columnsService.remove).toHaveBeenCalledWith(columns[0].id);
  });

  it('moveColumn() inverse deux colonnes adjacentes', async () => {
    await component.reload();

    await component.moveColumn(0, 1);

    expect(columnsService.reorder).toHaveBeenCalledWith([2, 1]);
  });

  it('moveColumn() ne fait rien hors limites', async () => {
    await component.reload();

    await component.moveColumn(0, -1);

    expect(columnsService.reorder).not.toHaveBeenCalled();
  });
});

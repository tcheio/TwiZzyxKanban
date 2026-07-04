import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EpicsList } from './epics-list';
import { EpicsService } from '../../../services/epics.service';
import { CardsService } from '../../../services/cards.service';
import { AuthService } from '../../../core/auth.service';
import { Card } from '../../../models/card.model';

describe('EpicsList', () => {
  let component: EpicsList;
  let fixture: ReturnType<typeof TestBed.createComponent<EpicsList>>;
  let epicsService: {
    list: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let navigate: ReturnType<typeof vi.fn>;
  let isAdmin: ReturnType<typeof vi.fn>;

  const epics = [
    { id: 1, name: 'TwiZzyx', color: 'red' },
    { id: 2, name: 'Twitch', color: 'violet' },
  ];
  const cards: Card[] = [
    {
      id: 10,
      title: 'Ticket A',
      description: null,
      tag_id: null,
      epic_id: 1,
      cloned_from_id: null,
      assigned_user_id: null,
      priority: 'low',
      column_id: 1,
      position: 0,
      due_date: null,
    },
    {
      id: 11,
      title: 'Ticket B',
      description: null,
      tag_id: null,
      epic_id: 1,
      cloned_from_id: null,
      assigned_user_id: null,
      priority: 'high',
      column_id: 1,
      position: 1,
      due_date: null,
    },
    {
      id: 12,
      title: 'Ticket C',
      description: null,
      tag_id: null,
      epic_id: 2,
      cloned_from_id: null,
      assigned_user_id: null,
      priority: 'medium',
      column_id: 1,
      position: 2,
      due_date: null,
    },
  ];

  beforeEach(() => {
    navigate = vi.fn();
    isAdmin = vi.fn().mockReturnValue(true);
    epicsService = {
      list: vi.fn().mockResolvedValue(epics),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      remove: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      imports: [EpicsList],
      providers: [
        { provide: EpicsService, useValue: epicsService },
        { provide: CardsService, useValue: { list: vi.fn().mockResolvedValue(cards) } },
        { provide: AuthService, useValue: { isAdmin } },
        { provide: Router, useValue: { navigate } },
      ],
    });
    fixture = TestBed.createComponent(EpicsList);
    component = fixture.componentInstance;
  });

  it('reload() charge les epics et les cartes', async () => {
    await component.reload();
    expect(component.epics()).toEqual(epics);
    expect(component.cards()).toEqual(cards);
  });

  it('ticketCount() compte les tickets associés à une epic', async () => {
    await component.reload();
    expect(component.ticketCount(1)).toBe(2);
    expect(component.ticketCount(2)).toBe(1);
  });

  it("openEpic() navigue vers la page de détail de l'EPIC", async () => {
    await component.reload();
    component.openEpic(epics[0]);
    expect(navigate).toHaveBeenCalledWith(['/epics', 1]);
  });

  it('affiche le bouton "+ Nouvelle EPIC" pour un admin', async () => {
    await component.reload();
    fixture.detectChanges();

    const button = (fixture.nativeElement as HTMLElement).querySelector('.new-epic-btn');
    expect(button).toBeTruthy();
  });

  it('masque les contrôles de gestion pour un non-admin', async () => {
    isAdmin.mockReturnValue(false);
    await component.reload();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.new-epic-btn')).toBeFalsy();
    expect(el.querySelector('.actions')).toBeFalsy();
  });

  it('createEpic() crée une epic et réinitialise le formulaire', async () => {
    component.newEpicName.set('AutreChaine');
    component.newEpicColor.set('sky');
    component.creating.set(true);

    await component.createEpic();

    expect(epicsService.create).toHaveBeenCalledWith('AutreChaine', 'sky');
    expect(component.newEpicName()).toBe('');
    expect(component.creating()).toBe(false);
  });

  it('createEpic() ne fait rien si le nom est vide', async () => {
    component.newEpicName.set('   ');

    await component.createEpic();

    expect(epicsService.create).not.toHaveBeenCalled();
  });

  it('startEdit()/cancelEdit() pilotent le mode édition', () => {
    component.startEdit(epics[0]);
    expect(component.editingId()).toBe(1);
    expect(component.editName()).toBe('TwiZzyx');
    expect(component.editColor()).toBe('red');

    component.cancelEdit();
    expect(component.editingId()).toBeNull();
  });

  it('saveEdit() ne fait rien si rien n\'a changé', async () => {
    component.startEdit(epics[0]);
    component.editName.set('TwiZzyx');
    component.editColor.set('red');

    await component.saveEdit(epics[0]);

    expect(epicsService.update).not.toHaveBeenCalled();
  });

  it('saveEdit() appelle le service si le nom ou la couleur change', async () => {
    component.startEdit(epics[0]);
    component.editName.set('TwiZzyx');
    component.editColor.set('emerald');

    await component.saveEdit(epics[0]);

    expect(epicsService.update).toHaveBeenCalledWith(1, { name: 'TwiZzyx', color: 'emerald' });
  });

  it('deleteEpic() supprime après confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    await component.deleteEpic(epics[0]);

    expect(epicsService.remove).toHaveBeenCalledWith(1);
  });

  it("deleteEpic() n'appelle pas remove() si l'utilisateur annule", async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    await component.deleteEpic(epics[0]);

    expect(epicsService.remove).not.toHaveBeenCalled();
  });
});

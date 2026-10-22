import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KanbansList } from './kanbans-list';
import { KanbansService } from '../../../services/board/kanbans.service';
import { MeService } from '../../../services/tickets/me.service';
import { AuthService } from '../../../core/auth.service';
import { Kanban } from '../../../models/kanban.model';
import { MyTicket } from '../../../models/my-ticket.model';

describe('KanbansList', () => {
  let component: KanbansList;
  let fixture: ReturnType<typeof TestBed.createComponent<KanbansList>>;
  let kanbansService: { list: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  let meService: { tickets: ReturnType<typeof vi.fn> };
  let navigate: ReturnType<typeof vi.fn>;

  const kanbans: Kanban[] = [
    { id: 1, name: 'DEV & CO', code: 'DEV-CO', is_moderator: true },
    { id: 2, name: 'TwiZzyxKanban', code: 'TK-TWIZZYX', is_moderator: false },
  ];
  const myTickets: MyTicket[] = [
    {
      id: 10,
      key: 'DEV-CO-10',
      title: 'Corriger le bug',
      priority: 'high',
      due_date: '2026-01-10',
      created_at: '2026-01-01 10:00:00',
      kanban_code: 'DEV-CO',
      kanban_name: 'DEV & CO',
      column_name: 'En cours',
    },
  ];

  function configure(isAdmin = false): void {
    navigate = vi.fn();
    kanbansService = {
      list: vi.fn().mockResolvedValue(kanbans),
      create: vi.fn().mockResolvedValue({ id: 3, name: 'Nouveau', code: 'NEW', is_moderator: true }),
    };
    meService = { tickets: vi.fn().mockResolvedValue(myTickets) };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [KanbansList],
      providers: [
        { provide: KanbansService, useValue: kanbansService },
        { provide: MeService, useValue: meService },
        { provide: AuthService, useValue: { isAdmin: () => isAdmin } },
        { provide: Router, useValue: { navigate } },
      ],
    });
    fixture = TestBed.createComponent(KanbansList);
    component = fixture.componentInstance;
  }

  beforeEach(() => configure());

  it('reload() charge les kanbans et mes tickets en parallèle', async () => {
    await component.reload();

    expect(component.kanbans()).toEqual(kanbans);
    expect(component.myTickets()).toEqual(myTickets);
    expect(component.loading()).toBe(false);
    expect(component.error()).toBeNull();
  });

  it("reload() signale une erreur si l'un des deux appels échoue", async () => {
    kanbansService.list.mockRejectedValue(new Error('boom'));
    await component.reload();

    expect(component.error()).toBe('Impossible de charger les kanbans.');
  });

  it('openKanban() navigue vers le kanban choisi', async () => {
    await component.reload();

    component.openKanban(kanbans[0]);

    expect(navigate).toHaveBeenCalledWith(['/kanbans', 'DEV-CO']);
  });

  it("openTicket() navigue vers la page du ticket (clé kanban-id)", async () => {
    await component.reload();

    component.openTicket(myTickets[0]);

    expect(navigate).toHaveBeenCalledWith(['/kanbans', 'DEV-CO-10']);
  });

  it('createKanban() crée le kanban et navigue dessus', async () => {
    component.newName.set('Nouveau');
    component.newCode.set('NEW');

    await component.createKanban();

    expect(kanbansService.create).toHaveBeenCalledWith({ name: 'Nouveau', code: 'NEW', template: 'video' });
    expect(navigate).toHaveBeenCalledWith(['/kanbans', 'NEW']);
    expect(component.newName()).toBe('');
  });

  it("createKanban() ne fait rien si le nom ou le code est vide", async () => {
    component.newName.set('');
    component.newCode.set('NEW');

    await component.createKanban();

    expect(kanbansService.create).not.toHaveBeenCalled();
  });

  it('affiche la section "Mes tickets" avec une ligne par ticket', async () => {
    // detectChanges() déclenche ngOnInit() (donc un 1er reload() en tâche de fond) ; on
    // attend ensuite un reload() complet avant de relire le DOM, pour ne pas dépendre de
    // l'ordre d'arrivée des deux appels concurrents.
    fixture.detectChanges();
    await component.reload();
    fixture.detectChanges();

    const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('.my-ticket-row');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('Corriger le bug');
  });

  it("affiche un message quand aucun ticket ne m'est assigné", async () => {
    meService.tickets.mockResolvedValue([]);
    fixture.detectChanges();
    await component.reload();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Aucun ticket en cours ne vous est assigné.');
  });

  it('affiche le bouton "+ Nouveau Kanban" uniquement pour un admin', async () => {
    configure(true);
    fixture.detectChanges();
    await component.reload();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.new-kanban-btn')).toBeTruthy();
  });

  it('masque le bouton "+ Nouveau Kanban" pour un non-admin', async () => {
    configure(false);
    fixture.detectChanges();
    await component.reload();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.new-kanban-btn')).toBeFalsy();
  });

  it('affiche "Mes tickets" et "Mes Kanbans" simultanément, côte à côte sur la même page', async () => {
    fixture.detectChanges();
    await component.reload();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.my-ticket-row')).toBeTruthy();
    expect(el.querySelector('.kanban-card')).toBeTruthy();
  });
});

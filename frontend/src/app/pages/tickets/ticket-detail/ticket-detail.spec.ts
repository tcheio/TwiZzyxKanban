import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TicketDetail } from './ticket-detail';
import { CardsService } from '../../../services/cards.service';
import { ColumnsService } from '../../../services/columns.service';
import { UsersService } from '../../../services/users.service';
import { CommentsService } from '../../../services/comments.service';
import { TagsService } from '../../../services/tags.service';
import { EpicsService } from '../../../services/epics.service';
import { AuthService } from '../../../core/auth.service';
import { Card } from '../../../models/card.model';
import { Comment } from '../../../models/comment.model';

describe('TicketDetail', () => {
  let component: TicketDetail;
  let fixture: ReturnType<typeof TestBed.createComponent<TicketDetail>>;
  let cardsService: {
    get: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    move: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let commentsService: {
    list: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let columnsService: { list: ReturnType<typeof vi.fn> };
  let navigate: ReturnType<typeof vi.fn>;
  let currentUser: ReturnType<typeof vi.fn>;
  let isAdmin: ReturnType<typeof vi.fn>;

  const columns = [
    { id: 1, name: 'Idée', position: 0 },
    { id: 2, name: 'Script', position: 1 },
  ];
  const users = [{ id: 1, username: 'alice' }];
  const tags = [
    { id: 1, name: 'Minecraft' },
    { id: 2, name: 'Pokémon' },
  ];
  const ticket: Card = {
    id: 5,
    title: 'Mon ticket',
    description: 'Notes existantes',
    tag_id: 1,
    epic_id: null,
    assigned_user_id: 1,
    priority: 'medium',
    column_id: 1,
    position: 0,
    due_date: null,
  };
  const comments: Comment[] = [
    { id: 1, card_id: 5, user_id: 1, username: 'alice', body: 'Salut', created_at: '2026-01-01' },
    { id: 2, card_id: 5, user_id: 2, username: 'bob', body: 'Re', created_at: '2026-01-02' },
  ];

  beforeEach(() => {
    navigate = vi.fn();
    currentUser = vi.fn().mockReturnValue({ id: 1, username: 'alice', role: 'user' });
    isAdmin = vi.fn().mockReturnValue(false);
    cardsService = {
      get: vi.fn().mockResolvedValue({ ...ticket }),
      update: vi.fn().mockImplementation((id, partial) => Promise.resolve({ ...ticket, ...partial })),
      move: vi.fn().mockResolvedValue({ ...ticket, column_id: 2 }),
      remove: vi.fn().mockResolvedValue(undefined),
    };
    commentsService = {
      list: vi.fn().mockResolvedValue(comments),
      create: vi.fn().mockResolvedValue({}),
      remove: vi.fn().mockResolvedValue(undefined),
    };
    columnsService = { list: vi.fn().mockResolvedValue(columns) };

    TestBed.configureTestingModule({
      providers: [
        { provide: CardsService, useValue: cardsService },
        { provide: ColumnsService, useValue: columnsService },
        { provide: UsersService, useValue: { lite: vi.fn().mockResolvedValue(users) } },
        { provide: TagsService, useValue: { list: vi.fn().mockResolvedValue(tags) } },
        { provide: EpicsService, useValue: { list: vi.fn().mockResolvedValue([]) } },
        { provide: CommentsService, useValue: commentsService },
        { provide: AuthService, useValue: { currentUser, isAdmin } },
        { provide: Router, useValue: { navigate } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => '5' } } } },
      ],
    });
    fixture = TestBed.createComponent(TicketDetail);
    component = fixture.componentInstance;
  });

  it('reload() charge le ticket, les colonnes, les utilisateurs et les commentaires', async () => {
    await component.reload();

    expect(cardsService.get).toHaveBeenCalledWith(5);
    expect(component.ticket()?.title).toBe('Mon ticket');
    expect(component.columns()).toEqual(columns);
    expect(component.tags()).toEqual(tags);
    expect(component.comments()).toEqual(comments);
    expect(component.descriptionDraft()).toBe('Notes existantes');
  });

  it('assigneeOptions()/tagOptions() exposent les libellés pour le search-select', async () => {
    await component.reload();
    expect(component.assigneeOptions()).toEqual([{ id: 1, label: 'alice', avatarUrl: null, avatarInitial: 'A' }]);
    expect(component.tagOptions().map((o) => o.label)).toEqual(['Minecraft', 'Pokémon']);
  });

  it('updateTitle() ignore une valeur vide', async () => {
    await component.reload();
    component.updateTitle('   ');
    expect(cardsService.update).not.toHaveBeenCalled();
  });

  it('updateTitle() persiste le nouveau titre', async () => {
    await component.reload();
    component.updateTitle('Nouveau titre');
    await Promise.resolve();
    expect(cardsService.update).toHaveBeenCalledWith(5, { title: 'Nouveau titre' });
  });

  it('updatePriority()/updateAssignee() persistent le bon champ', async () => {
    await component.reload();
    component.updatePriority('high');
    component.updateAssignee(null);
    await Promise.resolve();

    expect(cardsService.update).toHaveBeenCalledWith(5, { priority: 'high' });
    expect(cardsService.update).toHaveBeenCalledWith(5, { assigned_user_id: null });
  });

  it('updateTag() persiste le nouveau tag', async () => {
    await component.reload();
    component.updateTag(2);
    await Promise.resolve();
    expect(cardsService.update).toHaveBeenCalledWith(5, { tag_id: 2 });
  });

  it('updateTag() accepte null (retrait du tag)', async () => {
    await component.reload();
    component.updateTag(null);
    await Promise.resolve();
    expect(cardsService.update).toHaveBeenCalledWith(5, { tag_id: null });
  });

  it('updateDueDate() persiste la date ou null si vide', async () => {
    await component.reload();
    component.updateDueDate('2026-08-01');
    await Promise.resolve();
    expect(cardsService.update).toHaveBeenCalledWith(5, { due_date: '2026-08-01' });

    component.updateDueDate('');
    await Promise.resolve();
    expect(cardsService.update).toHaveBeenCalledWith(5, { due_date: null });
  });

  it('isPublished() vaut true seulement si la colonne courante est "Publié"', async () => {
    cardsService.get.mockResolvedValue({ ...ticket, column_id: 3 });
    columnsService.list.mockResolvedValue([...columns, { id: 3, name: '✅Publié', position: 2 }]);

    await component.reload();

    expect(component.isPublished()).toBe(true);
  });

  it('updateStatus() ne fait rien si le ticket est déjà publié', async () => {
    cardsService.get.mockResolvedValue({ ...ticket, column_id: 3 });
    columnsService.list.mockResolvedValue([...columns, { id: 3, name: '✅Publié', position: 2 }]);
    await component.reload();

    await component.updateStatus(1);

    expect(cardsService.move).not.toHaveBeenCalled();
  });

  it('updateStatus() ne fait rien si la colonne est inchangée', async () => {
    await component.reload();
    await component.updateStatus(1);
    expect(cardsService.move).not.toHaveBeenCalled();
  });

  it('updateStatus() appelle move() quand la colonne change', async () => {
    await component.reload();
    await component.updateStatus(2);
    expect(cardsService.move).toHaveBeenCalledWith(5, 2);
    expect(component.ticket()?.column_id).toBe(2);
  });

  it('saveDescription() persiste le brouillon courant', async () => {
    await component.reload();
    component.descriptionDraft.set('Nouvelle description');
    component.saveDescription();
    await Promise.resolve();
    expect(cardsService.update).toHaveBeenCalledWith(5, { description: 'Nouvelle description' });
  });

  it("addComment() ignore un commentaire vide", async () => {
    await component.reload();
    component.newComment.set('   ');
    await component.addComment();
    expect(commentsService.create).not.toHaveBeenCalled();
  });

  it('addComment() crée le commentaire, vide le champ et recharge la liste', async () => {
    await component.reload();
    component.newComment.set('Un avis');
    await component.addComment();
    expect(commentsService.create).toHaveBeenCalledWith(5, 'Un avis');
    expect(component.newComment()).toBe('');
  });

  it("canDeleteComment() autorise l'auteur", async () => {
    await component.reload();
    expect(component.canDeleteComment(comments[0])).toBe(true);
  });

  it("canDeleteComment() refuse un autre utilisateur non-admin", async () => {
    await component.reload();
    expect(component.canDeleteComment(comments[1])).toBe(false);
  });

  it('canDeleteComment() autorise un admin sur tous les commentaires', async () => {
    currentUser.mockReturnValue({ id: 99, username: 'admin', role: 'admin' });
    await component.reload();
    expect(component.canDeleteComment(comments[1])).toBe(true);
  });

  it("deleteComment() ne supprime pas si l'utilisateur annule", async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    await component.reload();
    await component.deleteComment(comments[0]);
    expect(commentsService.remove).not.toHaveBeenCalled();
  });

  it('deleteComment() supprime après confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await component.reload();
    await component.deleteComment(comments[0]);
    expect(commentsService.remove).toHaveBeenCalledWith(5, comments[0].id);
  });

  it('deleteTicket() supprime puis navigue vers /tickets', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await component.reload();
    await component.deleteTicket();
    expect(cardsService.remove).toHaveBeenCalledWith(5);
    expect(navigate).toHaveBeenCalledWith(['/tickets']);
  });

  it("deleteTicket() n'agit pas si l'utilisateur annule", async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    await component.reload();
    await component.deleteTicket();
    expect(cardsService.remove).not.toHaveBeenCalled();
  });

  it('masque le bouton "Supprimer le ticket" pour un non-admin', async () => {
    await component.reload();
    fixture.detectChanges();

    const button = (fixture.nativeElement as HTMLElement).querySelector('button.danger');
    expect(button).toBeFalsy();
  });

  it('affiche le bouton "Supprimer le ticket" pour un admin', async () => {
    isAdmin.mockReturnValue(true);
    await component.reload();
    fixture.detectChanges();

    const button = (fixture.nativeElement as HTMLElement).querySelector('button.danger');
    expect(button).toBeTruthy();
  });
});

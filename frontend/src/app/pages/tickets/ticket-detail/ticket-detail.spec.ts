import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TicketDetail } from './ticket-detail';
import { CardsService } from '../../../services/cards.service';
import { ColumnsService } from '../../../services/columns.service';
import { UsersService } from '../../../services/users.service';
import { CommentsService } from '../../../services/comments.service';
import { CardLinksService } from '../../../services/card-links.service';
import { CardImagesService } from '../../../services/card-images.service';
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
    list: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    move: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let commentsService: {
    list: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let cardLinksService: {
    list: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let cardImagesService: {
    list: ReturnType<typeof vi.fn>;
    upload: ReturnType<typeof vi.fn>;
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
    cloned_from_id: null,
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
      list: vi.fn().mockResolvedValue([ticket]),
      create: vi.fn().mockResolvedValue({ ...ticket, id: 99 }),
      update: vi.fn().mockImplementation((id, partial) => Promise.resolve({ ...ticket, ...partial })),
      move: vi.fn().mockResolvedValue({ ...ticket, column_id: 2 }),
      remove: vi.fn().mockResolvedValue(undefined),
    };
    commentsService = {
      list: vi.fn().mockResolvedValue(comments),
      create: vi.fn().mockResolvedValue({}),
      remove: vi.fn().mockResolvedValue(undefined),
    };
    cardLinksService = {
      list: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({}),
      remove: vi.fn().mockResolvedValue(undefined),
    };
    cardImagesService = {
      list: vi.fn().mockResolvedValue([]),
      upload: vi.fn().mockResolvedValue({ id: 1, card_id: 5, data_url: 'data:image/jpeg;base64,AAA' }),
      remove: vi.fn().mockResolvedValue(undefined),
    };
    columnsService = { list: vi.fn().mockResolvedValue(columns) };

    TestBed.configureTestingModule({
      providers: [
        { provide: CardsService, useValue: cardsService },
        { provide: ColumnsService, useValue: columnsService },
        { provide: UsersService, useValue: { liteForKanban: vi.fn().mockResolvedValue(users) } },
        { provide: TagsService, useValue: { list: vi.fn().mockResolvedValue(tags) } },
        { provide: EpicsService, useValue: { list: vi.fn().mockResolvedValue([]) } },
        { provide: CommentsService, useValue: commentsService },
        { provide: CardLinksService, useValue: cardLinksService },
        { provide: CardImagesService, useValue: cardImagesService },
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

    expect(cardsService.get).toHaveBeenCalledWith(5, 5);
    expect(component.ticket()?.title).toBe('Mon ticket');
    expect(component.columns()).toEqual(columns);
    expect(component.tags()).toEqual(tags);
    expect(component.comments()).toEqual(comments);
    expect(component.descriptionHtml()).toBe('Notes existantes');
    expect(component.descriptionDraftHtml()).toBe('Notes existantes');
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
    expect(cardsService.update).toHaveBeenCalledWith(5, 5, { title: 'Nouveau titre' });
  });

  it('updatePriority()/updateAssignee() persistent le bon champ', async () => {
    await component.reload();
    component.updatePriority('high');
    component.updateAssignee(null);
    await Promise.resolve();

    expect(cardsService.update).toHaveBeenCalledWith(5, 5, { priority: 'high' });
    expect(cardsService.update).toHaveBeenCalledWith(5, 5, { assigned_user_id: null });
  });

  it('updateTag() persiste le nouveau tag', async () => {
    await component.reload();
    component.updateTag(2);
    await Promise.resolve();
    expect(cardsService.update).toHaveBeenCalledWith(5, 5, { tag_id: 2 });
  });

  it('updateTag() accepte null (retrait du tag)', async () => {
    await component.reload();
    component.updateTag(null);
    await Promise.resolve();
    expect(cardsService.update).toHaveBeenCalledWith(5, 5, { tag_id: null });
  });

  it('updateDueDate() persiste la date ou null si vide', async () => {
    await component.reload();
    component.updateDueDate('2026-08-01');
    await Promise.resolve();
    expect(cardsService.update).toHaveBeenCalledWith(5, 5, { due_date: '2026-08-01' });

    component.updateDueDate('');
    await Promise.resolve();
    expect(cardsService.update).toHaveBeenCalledWith(5, 5, { due_date: null });
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

  it('updateStatus() ne fait rien si columnId est null', async () => {
    await component.reload();
    await component.updateStatus(null);
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
    expect(cardsService.move).toHaveBeenCalledWith(5, 5, 2);
    expect(component.ticket()?.column_id).toBe(2);
  });

  it('saveDescription() persiste le brouillon courant', async () => {
    await component.reload();
    component.descriptionDraftHtml.set('Nouvelle description');
    component.saveDescription();
    await Promise.resolve();
    expect(cardsService.update).toHaveBeenCalledWith(5, 5, { description: 'Nouvelle description' });
  });

  it('saveDescription() retire le src des images avant sauvegarde', async () => {
    await component.reload();
    component.descriptionDraftHtml.set(
      '<p>Texte</p><img src="data:image/jpeg;base64,AAA" data-card-image-id="1" alt="" class="max-w-full rounded">'
    );
    component.saveDescription();
    await Promise.resolve();
    expect(cardsService.update).toHaveBeenCalledWith(5, 5, {
      description: '<p>Texte</p><img data-card-image-id="1" alt="">',
    });
  });

  it('hasCommentContent() est faux quand vide, vrai avec du texte ou une image', () => {
    component.newCommentDraftHtml.set('');
    expect(component.hasCommentContent()).toBe(false);

    component.newCommentDraftHtml.set('   <br>');
    expect(component.hasCommentContent()).toBe(false);

    component.newCommentDraftHtml.set('<p>Un avis</p>');
    expect(component.hasCommentContent()).toBe(true);

    component.newCommentDraftHtml.set('<img src="data:image/jpeg;base64,AAA" data-card-image-id="1">');
    expect(component.hasCommentContent()).toBe(true);
  });

  it("addComment() ignore un commentaire vide", async () => {
    await component.reload();
    component.newCommentDraftHtml.set('   ');
    await component.addComment();
    expect(commentsService.create).not.toHaveBeenCalled();
  });

  it('addComment() crée le commentaire, vide le champ et recharge la liste', async () => {
    await component.reload();
    component.newCommentDraftHtml.set('Un avis');
    await component.addComment();
    expect(commentsService.create).toHaveBeenCalledWith(5, 5, 'Un avis');
    expect(component.newCommentDraftHtml()).toBe('');
  });

  it("addComment() vide aussi le contenu réellement affiché (y compris une image insérée)", async () => {
    await component.reload();
    fixture.detectChanges();

    const file = new File(['x'], 'shot.png', { type: 'image/png' });
    const input = document.createElement('input');
    input.type = 'file';
    Object.defineProperty(input, 'files', { value: [file] });
    await component.onCommentImageSelected({ target: input } as unknown as Event);

    // La description est le premier contenteditable de la page, la zone de commentaire le second.
    const editor = (fixture.nativeElement as HTMLElement).querySelectorAll('[contenteditable]')[1] as HTMLElement;
    expect(editor.innerHTML).toContain('data-card-image-id');

    await component.addComment();

    expect(editor.innerHTML).toBe('');
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
    expect(commentsService.remove).toHaveBeenCalledWith(5, 5, comments[0].id);
  });

  it('deleteTicket() supprime puis navigue vers /tickets', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await component.reload();
    await component.deleteTicket();
    expect(cardsService.remove).toHaveBeenCalledWith(5, 5);
    expect(navigate).toHaveBeenCalledWith(['/kanbans', 5, 'tickets']);
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

  it('clonedFrom() retourne null si le ticket ne provient pas d\'un clonage', async () => {
    await component.reload();
    expect(component.clonedFrom()).toBeNull();
  });

  it('clonedFrom() résout la carte source à partir de cloned_from_id', async () => {
    const source = { ...ticket, id: 1, title: 'Source' };
    cardsService.get.mockResolvedValue({ ...ticket, cloned_from_id: 1 });
    cardsService.list.mockResolvedValue([source, { ...ticket, cloned_from_id: 1 }]);

    await component.reload();

    expect(component.clonedFrom()?.title).toBe('Source');
  });

  it('clones() retourne les cartes clonées à partir de ce ticket', async () => {
    const cloneA = { ...ticket, id: 10, title: 'Clone A', cloned_from_id: 5 };
    const cloneB = { ...ticket, id: 11, title: 'Clone B', cloned_from_id: 5 };
    const unrelated = { ...ticket, id: 12, title: 'Autre', cloned_from_id: 999 };
    cardsService.list.mockResolvedValue([ticket, cloneA, cloneB, unrelated]);

    await component.reload();

    expect(component.clones().map((c) => c.title)).toEqual(['Clone A', 'Clone B']);
  });

  it('cloneInitialValue() reprend les données du ticket sauf assigné et échéance', async () => {
    await component.reload();

    expect(component.cloneInitialValue()).toEqual({
      title: 'COPIE - Mon ticket',
      description: 'Notes existantes',
      tag_id: 1,
      epic_id: null,
      priority: 'medium',
      column_id: 1,
    });
  });

  it('createClone() crée le ticket cloné, ferme le dialogue et navigue vers sa page', async () => {
    await component.reload();
    component.cloneDialogOpen.set(true);

    await component.createClone({
      title: 'COPIE - Mon ticket',
      column_id: 1,
      tag_id: 1,
      epic_id: null,
      cloned_from_id: 5,
      assigned_user_id: null,
      priority: 'medium',
    });

    expect(cardsService.create).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ title: 'COPIE - Mon ticket', cloned_from_id: 5 })
    );
    expect(component.cloneDialogOpen()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/kanbans', '5-99']);
  });

  it('linkedBefore() liste les tickets à faire avant', async () => {
    const other = { ...ticket, id: 20, title: 'Autre ticket' };
    cardsService.list.mockResolvedValue([ticket, other]);
    cardLinksService.list.mockResolvedValue([
      { id: 1, card_id: 5, linked_card_id: 20, type: 'before' },
    ]);

    await component.reload();

    expect(component.linkedBefore()).toEqual([{ linkId: 1, card: other }]);
    expect(component.linkedAfter()).toEqual([]);
  });

  it('linkedAfter() inverse le sens quand le ticket est la cible du lien', async () => {
    const other = { ...ticket, id: 20, title: 'Autre ticket' };
    cardsService.list.mockResolvedValue([ticket, other]);
    cardLinksService.list.mockResolvedValue([
      { id: 1, card_id: 20, linked_card_id: 5, type: 'before' },
    ]);

    await component.reload();

    expect(component.linkedAfter()).toEqual([{ linkId: 1, card: other }]);
    expect(component.linkedBefore()).toEqual([]);
  });

  it('addLink() ignore une cible non choisie', async () => {
    await component.reload();
    await component.addLink();
    expect(cardLinksService.create).not.toHaveBeenCalled();
  });

  it('addLink() crée le lien, réinitialise la cible et recharge la liste', async () => {
    await component.reload();
    component.newLinkTargetId.set(20);
    component.newLinkType.set('after');
    await component.addLink();

    expect(cardLinksService.create).toHaveBeenCalledWith(5, 5, 20, 'after');
    expect(component.newLinkTargetId()).toBeNull();
  });

  it("removeLink() n'agit pas si l'utilisateur annule", async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    await component.reload();
    await component.removeLink(1);
    expect(cardLinksService.remove).not.toHaveBeenCalled();
  });

  it('removeLink() supprime après confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await component.reload();
    await component.removeLink(1);
    expect(cardLinksService.remove).toHaveBeenCalledWith(5, 5, 1);
  });

  function fakeImagePasteEvent(target: HTMLElement, file: File): ClipboardEvent {
    return {
      clipboardData: { items: [{ type: file.type, getAsFile: () => file }] },
      preventDefault: vi.fn(),
      target,
    } as unknown as ClipboardEvent;
  }

  it('onDescriptionPaste() uploade une image collée et l\'insère via execCommand', async () => {
    await component.reload();
    const editor = document.createElement('div');
    editor.innerHTML = 'contenu';
    const file = new File(['x'], 'shot.png', { type: 'image/png' });
    const event = fakeImagePasteEvent(editor, file);
    const execSpy = ((document as unknown as { execCommand: typeof vi.fn }).execCommand = vi
      .fn()
      .mockReturnValue(true));

    await component.onDescriptionPaste(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(cardImagesService.upload).toHaveBeenCalledWith(5, 5, file);
    expect(execSpy).toHaveBeenCalledWith(
      'insertHTML',
      false,
      '<img src="data:image/jpeg;base64,AAA" data-card-image-id="1" alt="" class="max-w-full rounded">'
    );
    expect(component.descriptionDraftHtml()).toBe('contenu');
  });

  it('onDescriptionPaste() laisse passer un collage de texte normal', async () => {
    await component.reload();
    const editor = document.createElement('div');
    const event = {
      clipboardData: { items: [{ type: 'text/plain', getAsFile: () => null }] },
      preventDefault: vi.fn(),
      target: editor,
    } as unknown as ClipboardEvent;

    await component.onDescriptionPaste(event);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(cardImagesService.upload).not.toHaveBeenCalled();
  });

  it('onCommentPaste() uploade une image collée dans le commentaire', async () => {
    await component.reload();
    const editor = document.createElement('div');
    editor.innerHTML = 'brouillon';
    const file = new File(['x'], 'shot.png', { type: 'image/png' });
    const event = fakeImagePasteEvent(editor, file);
    (document as unknown as { execCommand: typeof vi.fn }).execCommand = vi.fn().mockReturnValue(true);

    await component.onCommentPaste(event);

    expect(cardImagesService.upload).toHaveBeenCalledWith(5, 5, file);
    expect(component.newCommentDraftHtml()).toBe('brouillon');
  });

  it("onCommentImageSelected() ajoute l'image à la fin de la zone de commentaire", async () => {
    await component.reload();
    fixture.detectChanges();

    const file = new File(['x'], 'shot.png', { type: 'image/png' });
    const input = document.createElement('input');
    input.type = 'file';
    Object.defineProperty(input, 'files', { value: [file] });

    await component.onCommentImageSelected({ target: input } as unknown as Event);

    expect(cardImagesService.upload).toHaveBeenCalledWith(5, 5, file);
    expect(component.newCommentDraftHtml()).toContain('data-card-image-id="1"');
  });

  it("onCommentImageSelected() ne fait rien sans fichier sélectionné", async () => {
    await component.reload();
    fixture.detectChanges();
    const input = document.createElement('input');
    input.type = 'file';

    await component.onCommentImageSelected({ target: input } as unknown as Event);

    expect(cardImagesService.upload).not.toHaveBeenCalled();
  });

  it('triggerGalleryUpload() déclenche le clic sur le input file caché', async () => {
    await component.reload();
    fixture.detectChanges();
    const input = (fixture.nativeElement as HTMLElement).querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, 'click');

    component.triggerGalleryUpload();

    expect(clickSpy).toHaveBeenCalled();
  });

  it('onGalleryImageSelected() uploade le fichier et recharge les images', async () => {
    await component.reload();
    const file = new File(['x'], 'shot.png', { type: 'image/png' });
    const input = document.createElement('input');
    input.type = 'file';
    Object.defineProperty(input, 'files', { value: [file] });
    cardImagesService.list.mockResolvedValue([{ id: 1, card_id: 5, data_url: 'data:image/jpeg;base64,AAA' }]);

    await component.onGalleryImageSelected({ target: input } as unknown as Event);

    expect(cardImagesService.upload).toHaveBeenCalledWith(5, 5, file);
    expect(component.images()).toEqual([{ id: 1, card_id: 5, data_url: 'data:image/jpeg;base64,AAA' }]);
  });

  it('onGalleryImageSelected() ne fait rien sans fichier sélectionné', async () => {
    await component.reload();
    const input = document.createElement('input');
    input.type = 'file';

    await component.onGalleryImageSelected({ target: input } as unknown as Event);

    expect(cardImagesService.upload).not.toHaveBeenCalled();
  });

  it("removeImage() n'agit pas si l'utilisateur annule", async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    await component.reload();
    await component.removeImage(3);
    expect(cardImagesService.remove).not.toHaveBeenCalled();
  });

  it('removeImage() supprime après confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await component.reload();
    await component.removeImage(3);
    expect(cardImagesService.remove).toHaveBeenCalledWith(5, 5, 3);
  });

  it('openImageViewer()/closeImageViewer() pilotent le visualiseur', () => {
    expect(component.viewingImageUrl()).toBeNull();
    component.openImageViewer('data:image/jpeg;base64,AAA');
    expect(component.viewingImageUrl()).toBe('data:image/jpeg;base64,AAA');
    component.closeImageViewer();
    expect(component.viewingImageUrl()).toBeNull();
  });

  it('onEscapeKey() ferme le visualiseur uniquement s\'il est ouvert', () => {
    component.onEscapeKey();
    expect(component.viewingImageUrl()).toBeNull();

    component.openImageViewer('data:image/jpeg;base64,AAA');
    component.onEscapeKey();
    expect(component.viewingImageUrl()).toBeNull();
  });

  it('onCommentContentClick() ouvre le visualiseur seulement en cliquant une image', () => {
    const img = document.createElement('img');
    img.src = 'data:image/jpeg;base64,AAA';
    component.onCommentContentClick({ target: img } as unknown as Event);
    expect(component.viewingImageUrl()).toBe(img.src);

    component.closeImageViewer();
    const span = document.createElement('span');
    component.onCommentContentClick({ target: span } as unknown as Event);
    expect(component.viewingImageUrl()).toBeNull();
  });

  it('le clic sur une vignette de la galerie ouvre le visualiseur', async () => {
    cardImagesService.list.mockResolvedValue([{ id: 4, card_id: 5, data_url: 'data:image/jpeg;base64,ZZZ' }]);
    await component.reload();
    fixture.detectChanges();

    const thumbnailButton = (fixture.nativeElement as HTMLElement).querySelector(
      'img[src="data:image/jpeg;base64,ZZZ"]'
    )?.parentElement as HTMLButtonElement;
    thumbnailButton.click();

    expect(component.viewingImageUrl()).toBe('data:image/jpeg;base64,ZZZ');
  });
});

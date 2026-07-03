import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TagsList } from './tags-list';
import { TagsService } from '../../../services/tags.service';
import { CardsService } from '../../../services/cards.service';
import { AuthService } from '../../../core/auth.service';
import { Card } from '../../../models/card.model';

describe('TagsList', () => {
  let component: TagsList;
  let fixture: ReturnType<typeof TestBed.createComponent<TagsList>>;
  let tagsService: {
    list: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    rename: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let navigate: ReturnType<typeof vi.fn>;
  let isAdmin: ReturnType<typeof vi.fn>;

  const tags = [
    { id: 1, name: 'Minecraft' },
    { id: 2, name: 'Pokémon' },
  ];
  const cards: Card[] = [
    {
      id: 10,
      title: 'Ticket A',
      description: null,
      tag_id: 1,
      epic_id: null,
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
      tag_id: 1,
      epic_id: null,
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
      tag_id: 2,
      epic_id: null,
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
    tagsService = {
      list: vi.fn().mockResolvedValue(tags),
      create: vi.fn().mockResolvedValue({}),
      rename: vi.fn().mockResolvedValue({}),
      remove: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      imports: [TagsList],
      providers: [
        { provide: TagsService, useValue: tagsService },
        { provide: CardsService, useValue: { list: vi.fn().mockResolvedValue(cards) } },
        { provide: AuthService, useValue: { isAdmin } },
        { provide: Router, useValue: { navigate } },
      ],
    });
    fixture = TestBed.createComponent(TagsList);
    component = fixture.componentInstance;
  });

  it('reload() charge les tags et les cartes', async () => {
    await component.reload();
    expect(component.tags()).toEqual(tags);
    expect(component.cards()).toEqual(cards);
  });

  it('ticketCount() compte les tickets associés à un tag', async () => {
    await component.reload();
    expect(component.ticketCount(1)).toBe(2);
    expect(component.ticketCount(2)).toBe(1);
  });

  it('openTag() navigue vers la page de détail du tag', async () => {
    await component.reload();
    component.openTag(tags[0]);
    expect(navigate).toHaveBeenCalledWith(['/tags', 1]);
  });

  it('affiche le bouton "+ Nouveau tag" pour un admin', async () => {
    await component.reload();
    fixture.detectChanges();

    const button = (fixture.nativeElement as HTMLElement).querySelector('.new-tag-btn');
    expect(button).toBeTruthy();
  });

  it('masque les contrôles de gestion pour un non-admin', async () => {
    isAdmin.mockReturnValue(false);
    await component.reload();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.new-tag-btn')).toBeFalsy();
    expect(el.querySelector('.actions')).toBeFalsy();
  });

  it('createTag() crée un tag et réinitialise le formulaire', async () => {
    component.newTagName.set('One Piece');
    component.creating.set(true);

    await component.createTag();

    expect(tagsService.create).toHaveBeenCalledWith('One Piece');
    expect(component.newTagName()).toBe('');
    expect(component.creating()).toBe(false);
  });

  it("createTag() ne fait rien si le nom est vide", async () => {
    component.newTagName.set('   ');

    await component.createTag();

    expect(tagsService.create).not.toHaveBeenCalled();
  });

  it('startEdit()/cancelEdit() pilotent le mode édition', () => {
    component.startEdit(tags[0]);
    expect(component.editingId()).toBe(1);
    expect(component.editName()).toBe('Minecraft');

    component.cancelEdit();
    expect(component.editingId()).toBeNull();
  });

  it('saveEdit() ne fait rien si le nom est inchangé', async () => {
    component.startEdit(tags[0]);
    component.editName.set('Minecraft');

    await component.saveEdit(tags[0]);

    expect(tagsService.rename).not.toHaveBeenCalled();
  });

  it('saveEdit() appelle le service si le nom change', async () => {
    component.startEdit(tags[0]);
    component.editName.set('Minecraft Vanilla');

    await component.saveEdit(tags[0]);

    expect(tagsService.rename).toHaveBeenCalledWith(1, 'Minecraft Vanilla');
  });

  it('deleteTag() supprime après confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    await component.deleteTag(tags[0]);

    expect(tagsService.remove).toHaveBeenCalledWith(1);
  });

  it("deleteTag() n'appelle pas remove() si l'utilisateur annule", async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    await component.deleteTag(tags[0]);

    expect(tagsService.remove).not.toHaveBeenCalled();
  });
});

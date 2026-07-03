import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { NewTicketDialog } from './new-ticket-dialog';
import { CardInput } from '../../../models/card.model';

describe('NewTicketDialog', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<NewTicketDialog>>;
  let component: NewTicketDialog;

  const columns = [
    { id: 1, name: 'Idée', position: 0 },
    { id: 2, name: 'Script', position: 1 },
  ];
  const users = [{ id: 1, username: 'alice' }];
  const tags = [
    { id: 1, name: 'Minecraft' },
    { id: 2, name: 'Pokémon' },
  ];
  const epics = [
    { id: 1, name: 'TwiZzyx', color: 'red' },
    { id: 2, name: 'Twitch', color: 'violet' },
  ];

  function configure(): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [NewTicketDialog] });
    fixture = TestBed.createComponent(NewTicketDialog);
    component = fixture.componentInstance;
    component.columns = columns;
    component.users = users;
    component.tags = tags;
    component.epics = epics;
  }

  beforeEach(() => {
    configure();
    fixture.detectChanges();
  });

  it('le formulaire est invalide tant que le titre et la colonne ne sont pas renseignés', () => {
    expect(component.form.invalid).toBe(true);
  });

  it("submit() n'émet rien si le formulaire est invalide", () => {
    let called = false;
    component.save.subscribe(() => (called = true));

    component.form.patchValue({ title: 'Sans colonne' });
    component.submit();

    expect(called).toBe(false);
  });

  it('submit() émet le CardInput complet quand le formulaire est valide', () => {
    let emitted: CardInput | null = null;
    component.save.subscribe((value) => (emitted = value));

    component.form.setValue({
      title: 'Nouvelle vidéo',
      description: 'Quelques notes',
      column_id: 2,
      tag_id: 1,
      epic_id: 1,
      assigned_user_id: 1,
      priority: 'high',
      due_date: '2026-07-15',
    });
    component.submit();

    expect(emitted).toEqual({
      title: 'Nouvelle vidéo',
      description: 'Quelques notes',
      column_id: 2,
      tag_id: 1,
      epic_id: 1,
      cloned_from_id: null,
      assigned_user_id: 1,
      priority: 'high',
      due_date: '2026-07-15',
    });
  });

  it("submit() convertit une chaîne vide en null pour description/assigned_user_id/due_date, et accepte tag_id=null", () => {
    let emitted: CardInput | null = null;
    component.save.subscribe((value) => (emitted = value));

    component.form.setValue({
      title: 'X',
      description: '',
      column_id: 1,
      tag_id: null,
      epic_id: null,
      assigned_user_id: null,
      priority: 'medium',
      due_date: '',
    });
    component.submit();

    expect(emitted!.description).toBeNull();
    expect(emitted!.assigned_user_id).toBeNull();
    expect(emitted!.tag_id).toBeNull();
    expect(emitted!.epic_id).toBeNull();
    expect(emitted!.due_date).toBeNull();
  });

  it('initialValue pré-remplit le formulaire (utilisé pour le clonage)', () => {
    configure();
    component.initialValue = {
      title: 'COPIE - Original',
      description: 'Notes reprises',
      column_id: 2,
      tag_id: 1,
      epic_id: 1,
      priority: 'high',
    };
    fixture.detectChanges();

    expect(component.form.getRawValue()).toEqual({
      title: 'COPIE - Original',
      description: 'Notes reprises',
      column_id: 2,
      tag_id: 1,
      epic_id: 1,
      assigned_user_id: null,
      priority: 'high',
      due_date: '',
    });
  });

  it('clonedFromId est inclus dans le CardInput émis', () => {
    configure();
    component.clonedFromId = 7;
    fixture.detectChanges();

    let emitted: CardInput | null = null;
    component.save.subscribe((value) => (emitted = value));

    component.form.setValue({
      title: 'X',
      description: '',
      column_id: 1,
      tag_id: null,
      epic_id: null,
      assigned_user_id: null,
      priority: 'medium',
      due_date: '',
    });
    component.submit();

    expect(emitted!.cloned_from_id).toBe(7);
  });
});

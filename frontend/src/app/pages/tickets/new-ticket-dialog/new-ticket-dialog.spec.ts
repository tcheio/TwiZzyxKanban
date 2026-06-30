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

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [NewTicketDialog] });
    fixture = TestBed.createComponent(NewTicketDialog);
    component = fixture.componentInstance;
    component.columns = columns;
    component.users = users;
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
      channel: 'MaChaine',
      column_id: 2,
      assigned_user_id: 1,
      priority: 'high',
    });
    component.submit();

    expect(emitted).toEqual({
      title: 'Nouvelle vidéo',
      channel: 'MaChaine',
      column_id: 2,
      assigned_user_id: 1,
      priority: 'high',
    });
  });

  it("submit() convertit une chaîne vide en null pour channel/assigned_user_id", () => {
    let emitted: CardInput | null = null;
    component.save.subscribe((value) => (emitted = value));

    component.form.setValue({
      title: 'X',
      channel: '',
      column_id: 1,
      assigned_user_id: null,
      priority: 'medium',
    });
    component.submit();

    expect(emitted!.channel).toBeNull();
    expect(emitted!.assigned_user_id).toBeNull();
  });
});

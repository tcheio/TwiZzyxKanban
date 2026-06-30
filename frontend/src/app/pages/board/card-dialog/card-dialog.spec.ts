import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { CardDialog } from './card-dialog';
import { Card, CardInput } from '../../../models/card.model';

describe('CardDialog', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<CardDialog>>;
  let component: CardDialog;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [CardDialog] });
    fixture = TestBed.createComponent(CardDialog);
    component = fixture.componentInstance;
    component.users = [{ id: 1, username: 'alice' }];
    component.defaultColumnId = 2;
  });

  it('initialise un formulaire vide pour une nouvelle carte', () => {
    component.card = null;
    fixture.detectChanges();

    expect(component.form.value.title).toBe('');
    expect(component.form.value.priority).toBe('medium');
    expect(component.form.value.assigned_user_id).toBeNull();
  });

  it('pré-remplit le formulaire en édition', () => {
    const card: Card = {
      id: 5,
      title: 'Existant',
      channel: 'Chaine',
      assigned_user_id: 1,
      priority: 'high',
      column_id: 2,
      position: 0,
    };
    component.card = card;
    fixture.detectChanges();

    expect(component.form.value.title).toBe('Existant');
    expect(component.form.value.channel).toBe('Chaine');
    expect(component.form.value.priority).toBe('high');
    expect(component.form.value.assigned_user_id).toBe(1);
  });

  it("submit() émet le CardInput avec le column_id de la carte éditée", () => {
    const card: Card = {
      id: 5,
      title: 'X',
      channel: null,
      assigned_user_id: null,
      priority: 'medium',
      column_id: 3,
      position: 0,
    };
    component.card = card;
    fixture.detectChanges();

    let emitted: CardInput | null = null;
    component.save.subscribe((value) => (emitted = value));

    component.form.patchValue({ title: 'Modifié' });
    component.submit();

    expect(emitted).not.toBeNull();
    expect(emitted!.title).toBe('Modifié');
    expect(emitted!.column_id).toBe(3);
  });

  it('submit() utilise defaultColumnId pour une nouvelle carte', () => {
    component.card = null;
    fixture.detectChanges();

    let emitted: CardInput | null = null;
    component.save.subscribe((value) => (emitted = value));

    component.form.patchValue({ title: 'Nouvelle carte' });
    component.submit();

    expect(emitted!.column_id).toBe(2);
  });

  it("submit() n'émet rien si le formulaire est invalide", () => {
    component.card = null;
    fixture.detectChanges();

    let called = false;
    component.save.subscribe(() => (called = true));

    component.form.patchValue({ title: '' });
    component.submit();

    expect(called).toBe(false);
  });
});

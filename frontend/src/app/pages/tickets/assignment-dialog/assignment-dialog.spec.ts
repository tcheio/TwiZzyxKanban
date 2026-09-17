import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { AssignmentDialog } from './assignment-dialog';
import { AssignmentInput } from '../../../models/card-assignee.model';
import { CANCELLED_STATUS_ID } from '../../../shared/ticket-status';

describe('AssignmentDialog', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<AssignmentDialog>>;
  let component: AssignmentDialog;

  const users = [
    { id: 1, username: 'alice' },
    { id: 2, username: 'bob' },
    { id: 3, username: 'carol' },
  ];
  const statusOptions = [
    { id: 10, label: 'Idée' },
    { id: 20, label: 'Script' },
    { id: CANCELLED_STATUS_ID, label: '🚫 Annulé' },
  ];

  function configure(): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [AssignmentDialog] });
    fixture = TestBed.createComponent(AssignmentDialog);
    component = fixture.componentInstance;
    component.users = users;
    component.currentAssignedUserId = 1;
    component.currentAssigneeIds = [2];
    component.statusOptions = statusOptions;
    component.currentStatusValue = 10;
  }

  beforeEach(() => {
    configure();
    fixture.detectChanges();
  });

  it('le formulaire est invalide tant que la personne et la raison ne sont pas renseignées', () => {
    expect(component.form.invalid).toBe(true);
  });

  it("userOptions() exclut le responsable principal et les additionnels en mode 'add'", () => {
    expect(component.userOptions().map((o) => o.id)).toEqual([3]);
  });

  it("userOptions() n'exclut que le responsable principal en mode 'replace'", () => {
    component.setAction('replace');
    expect(component.userOptions().map((o) => o.id)).toEqual([2, 3]);
  });

  it('setAction() réinitialise la personne sélectionnée', () => {
    component.form.patchValue({ user_id: 3 });
    component.setAction('replace');
    expect(component.form.value.user_id).toBeNull();
  });

  it("submit() n'émet rien si la raison est vide ou blanche", () => {
    let called = false;
    component.save.subscribe(() => (called = true));

    component.form.patchValue({ user_id: 3, reason: '   ' });
    component.submit();

    expect(called).toBe(false);
  });

  it('submit() émet action/user_id/reason sans changement de statut par défaut', () => {
    let emitted: AssignmentInput | null = null;
    component.save.subscribe((value) => (emitted = value));

    component.form.patchValue({ user_id: 3, reason: 'Renfort ponctuel' });
    component.submit();

    expect(emitted).toEqual({ action: 'add', user_id: 3, reason: 'Renfort ponctuel' });
  });

  it("submit() n'inclut pas de changement de statut si la valeur choisie est la même qu'actuellement", () => {
    let emitted: AssignmentInput | null = null;
    component.save.subscribe((value) => (emitted = value));

    component.toggleChangeStatus(true);
    component.form.patchValue({ user_id: 3, reason: 'X', status_value: 10 });
    component.submit();

    expect(emitted!.new_column_id).toBeUndefined();
    expect(emitted!.cancel).toBeUndefined();
  });

  it('submit() inclut new_column_id quand le statut change vers une colonne', () => {
    let emitted: AssignmentInput | null = null;
    component.save.subscribe((value) => (emitted = value));

    component.toggleChangeStatus(true);
    component.form.patchValue({ user_id: 3, reason: 'X', status_value: 20 });
    component.submit();

    expect(emitted!.new_column_id).toBe(20);
    expect(emitted!.cancel).toBeUndefined();
  });

  it('submit() inclut cancel:true quand le statut annulé est choisi', () => {
    let emitted: AssignmentInput | null = null;
    component.save.subscribe((value) => (emitted = value));

    component.toggleChangeStatus(true);
    component.form.patchValue({ user_id: 3, reason: 'X', status_value: CANCELLED_STATUS_ID });
    component.submit();

    expect(emitted!.cancel).toBe(true);
    expect(emitted!.new_column_id).toBeUndefined();
  });

  it('toggleChangeStatus(false) efface la valeur de statut sélectionnée', () => {
    component.toggleChangeStatus(true);
    component.form.patchValue({ status_value: 20 });
    component.toggleChangeStatus(false);

    expect(component.form.value.changeStatus).toBe(false);
    expect(component.form.value.status_value).toBeNull();
  });
});

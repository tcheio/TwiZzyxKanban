import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { AssignmentDialog } from './assignment-dialog';
import { ReplacementDetails } from '../../../models/card-assignee.model';
import { CANCELLED_STATUS_ID } from '../../../shared/ticket-status';

describe('AssignmentDialog (confirmation de remplacement)', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<AssignmentDialog>>;
  let component: AssignmentDialog;

  const statusOptions = [
    { id: 10, label: 'Idée' },
    { id: 20, label: 'Script' },
    { id: CANCELLED_STATUS_ID, label: '🚫 Annulé' },
  ];

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [AssignmentDialog] });
    fixture = TestBed.createComponent(AssignmentDialog);
    component = fixture.componentInstance;
    component.previousUser = { id: 1, username: 'alice' };
    component.newUser = { id: 3, username: 'carol' };
    component.statusOptions = statusOptions;
    component.currentStatusValue = 10;
    fixture.detectChanges();
  });

  function captureSave(): { value: ReplacementDetails | null } {
    const captured: { value: ReplacementDetails | null } = { value: null };
    component.save.subscribe((v) => (captured.value = v));
    return captured;
  }

  it('affiche qui remplace qui', () => {
    const summary = (fixture.nativeElement as HTMLElement).querySelector('.replacement-summary')!;
    expect(summary.textContent).toContain('alice');
    expect(summary.textContent).toContain('carol');
    expect(summary.textContent).toContain('responsable principal');
  });

  it("submit() n'émet rien si la raison est vide ou blanche", () => {
    const captured = captureSave();
    component.form.patchValue({ reason: '   ' });
    component.submit();
    expect(captured.value).toBeNull();
  });

  it('submit() émet la raison sans changement de statut par défaut', () => {
    const captured = captureSave();
    component.form.patchValue({ reason: '  Alice est en congés ' });
    component.submit();
    expect(captured.value).toEqual({ reason: 'Alice est en congés' });
  });

  it("submit() n'inclut pas de changement de statut si la valeur choisie est la même qu'actuellement", () => {
    const captured = captureSave();
    component.toggleChangeStatus(true);
    component.form.patchValue({ reason: 'X', status_value: 10 });
    component.submit();
    expect(captured.value).toEqual({ reason: 'X' });
  });

  it('submit() inclut new_column_id quand le statut change vers une colonne', () => {
    const captured = captureSave();
    component.toggleChangeStatus(true);
    component.form.patchValue({ reason: 'X', status_value: 20 });
    component.submit();
    expect(captured.value).toEqual({ reason: 'X', new_column_id: 20 });
  });

  it('submit() inclut cancel:true quand le statut annulé est choisi', () => {
    const captured = captureSave();
    component.toggleChangeStatus(true);
    component.form.patchValue({ reason: 'X', status_value: CANCELLED_STATUS_ID });
    component.submit();
    expect(captured.value).toEqual({ reason: 'X', cancel: true });
  });

  it("en mode 'remove', affiche le retrait sans option de statut et n'émet que la raison", () => {
    component.mode = 'remove';
    component.newUser = null;
    fixture.componentRef.changeDetectorRef.markForCheck();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')!.textContent).toContain('Retirer le responsable');
    expect(el.querySelector('.replacement-summary')!.textContent).toContain('alice sera retiré(e)');
    expect(el.textContent).not.toContain('Changer aussi le statut');

    const captured = captureSave();
    component.toggleChangeStatus(true);
    component.form.patchValue({ reason: 'Fin de mission', status_value: 20 });
    component.submit();
    expect(captured.value).toEqual({ reason: 'Fin de mission' });
  });

  it('toggleChangeStatus(false) efface la valeur de statut sélectionnée', () => {
    component.toggleChangeStatus(true);
    component.form.patchValue({ status_value: 20 });
    component.toggleChangeStatus(false);

    expect(component.form.value.changeStatus).toBe(false);
    expect(component.form.value.status_value).toBeNull();
  });
});

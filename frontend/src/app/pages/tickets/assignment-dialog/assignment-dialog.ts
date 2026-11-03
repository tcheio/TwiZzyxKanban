import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { UserLite } from '../../../models/user.model';
import { ReplacementDetails } from '../../../models/card-assignee.model';
import { SearchSelect, SearchSelectOption } from '../../../shared/search-select/search-select';
import { CANCELLED_STATUS_ID } from '../../../shared/ticket-status';

// Fenêtre de confirmation d'un remplacement de responsable : seul ce cas exige une
// raison (un ajout ou la désignation d'un premier responsable se fait directement
// depuis la liste déroulante, sans fenêtre).
@Component({
  selector: 'app-assignment-dialog',
  imports: [ReactiveFormsModule, SearchSelect],
  templateUrl: './assignment-dialog.html',
})
export class AssignmentDialog {
  private readonly fb = inject(FormBuilder);

  @Input({ required: true }) previousUser!: UserLite;
  @Input({ required: true }) newUser!: UserLite;
  @Input() isPrimary = true;
  @Input({ required: true }) statusOptions: SearchSelectOption<number>[] = [];
  @Input({ required: true }) currentStatusValue: number = CANCELLED_STATUS_ID;
  @Input() statusLocked = false;
  @Output() save = new EventEmitter<ReplacementDetails>();
  @Output() cancelled = new EventEmitter<void>();

  readonly form = this.fb.group({
    reason: ['', Validators.required],
    changeStatus: [false],
    status_value: [null as number | null],
  });

  toggleChangeStatus(enabled: boolean): void {
    this.form.patchValue({
      changeStatus: enabled,
      status_value: enabled ? this.currentStatusValue : null,
    });
  }

  reasonMissing(): boolean {
    return !this.form.value.reason?.trim();
  }

  submit(): void {
    if (this.reasonMissing()) return;
    const raw = this.form.getRawValue();

    const details: ReplacementDetails = { reason: raw.reason!.trim() };

    if (raw.changeStatus && raw.status_value !== null && raw.status_value !== this.currentStatusValue) {
      if (raw.status_value === CANCELLED_STATUS_ID) {
        details.cancel = true;
      } else {
        details.new_column_id = raw.status_value;
      }
    }

    this.save.emit(details);
  }
}

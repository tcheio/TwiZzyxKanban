import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { UserLite } from '../../../models/user.model';
import { AssignmentAction, AssignmentInput } from '../../../models/card-assignee.model';
import { SearchSelect, SearchSelectOption } from '../../../shared/search-select/search-select';
import { CANCELLED_STATUS_ID } from '../../../shared/ticket-status';

@Component({
  selector: 'app-assignment-dialog',
  imports: [ReactiveFormsModule, SearchSelect],
  templateUrl: './assignment-dialog.html',
})
export class AssignmentDialog {
  private readonly fb = inject(FormBuilder);

  @Input({ required: true }) users: UserLite[] = [];
  @Input() currentAssignedUserId: number | null = null;
  @Input() currentAssigneeIds: number[] = [];
  @Input({ required: true }) statusOptions: SearchSelectOption<number>[] = [];
  @Input({ required: true }) currentStatusValue: number = CANCELLED_STATUS_ID;
  @Input() statusLocked = false;
  @Output() save = new EventEmitter<AssignmentInput>();
  @Output() cancelled = new EventEmitter<void>();

  readonly form = this.fb.group({
    action: ['add' as AssignmentAction, Validators.required],
    user_id: [null as number | null, Validators.required],
    reason: ['', Validators.required],
    changeStatus: [false],
    status_value: [null as number | null],
  });

  setAction(action: AssignmentAction): void {
    if (this.form.value.action === action) return;
    this.form.patchValue({ action, user_id: null });
  }

  toggleChangeStatus(enabled: boolean): void {
    this.form.patchValue({
      changeStatus: enabled,
      status_value: enabled ? this.currentStatusValue : null,
    });
  }

  userOptions(): SearchSelectOption<number>[] {
    const action = this.form.value.action;
    const excluded = new Set<number>(
      action === 'add'
        ? [this.currentAssignedUserId, ...this.currentAssigneeIds].filter((id): id is number => id !== null)
        : this.currentAssignedUserId !== null
          ? [this.currentAssignedUserId]
          : []
    );
    return this.users
      .filter((u) => !excluded.has(u.id))
      .map((u) => ({
        id: u.id,
        label: u.username,
        avatarUrl: u.avatar_url ?? null,
        avatarInitial: u.username.charAt(0).toUpperCase(),
      }));
  }

  reasonMissing(): boolean {
    return !this.form.value.reason?.trim();
  }

  submit(): void {
    if (this.form.invalid || this.reasonMissing()) return;
    const raw = this.form.getRawValue();

    const input: AssignmentInput = {
      action: raw.action!,
      user_id: raw.user_id!,
      reason: raw.reason!.trim(),
    };

    if (raw.changeStatus && raw.status_value !== null && raw.status_value !== this.currentStatusValue) {
      if (raw.status_value === CANCELLED_STATUS_ID) {
        input.cancel = true;
      } else {
        input.new_column_id = raw.status_value;
      }
    }

    this.save.emit(input);
  }
}

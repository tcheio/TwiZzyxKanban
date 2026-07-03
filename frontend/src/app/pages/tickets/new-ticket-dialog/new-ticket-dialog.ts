import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CardInput, Priority } from '../../../models/card.model';
import { Column } from '../../../models/column.model';
import { UserLite } from '../../../models/user.model';
import { Tag } from '../../../models/tag.model';
import { Epic } from '../../../models/epic.model';

@Component({
  selector: 'app-new-ticket-dialog',
  imports: [ReactiveFormsModule],
  templateUrl: './new-ticket-dialog.html',
  styleUrl: './new-ticket-dialog.css',
})
export class NewTicketDialog {
  private fb = inject(FormBuilder);

  @Input({ required: true }) columns: Column[] = [];
  @Input({ required: true }) users: UserLite[] = [];
  @Input({ required: true }) tags: Tag[] = [];
  @Input({ required: true }) epics: Epic[] = [];
  @Output() save = new EventEmitter<CardInput>();
  @Output() cancel = new EventEmitter<void>();

  readonly form = this.fb.group({
    title: ['', Validators.required],
    channel: [''],
    column_id: [null as number | null, Validators.required],
    tag_id: [null as number | null],
    epic_id: [null as number | null],
    assigned_user_id: [null as number | null],
    priority: ['medium' as Priority, Validators.required],
    due_date: [''],
  });

  submit(): void {
    if (this.form.invalid) return;
    const raw = this.form.getRawValue();
    this.save.emit({
      title: raw.title!,
      channel: raw.channel || null,
      column_id: raw.column_id!,
      tag_id: raw.tag_id ?? null,
      epic_id: raw.epic_id ?? null,
      assigned_user_id: raw.assigned_user_id ?? null,
      priority: raw.priority!,
      due_date: raw.due_date || null,
    });
  }
}

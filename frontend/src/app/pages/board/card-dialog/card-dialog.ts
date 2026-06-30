import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Card, CardInput, Priority } from '../../../models/card.model';
import { UserLite } from '../../../models/user.model';

@Component({
  selector: 'app-card-dialog',
  imports: [ReactiveFormsModule],
  templateUrl: './card-dialog.html',
  styleUrl: './card-dialog.css',
})
export class CardDialog implements OnInit {
  private fb = inject(FormBuilder);

  @Input() card: Card | null = null;
  @Input({ required: true }) users: UserLite[] = [];
  @Input({ required: true }) defaultColumnId!: number;
  @Output() save = new EventEmitter<CardInput>();
  @Output() cancel = new EventEmitter<void>();

  readonly form = this.fb.group({
    title: ['', Validators.required],
    channel: [''],
    assigned_user_id: [null as number | null],
    priority: ['medium' as Priority, Validators.required],
  });

  ngOnInit(): void {
    if (this.card) {
      this.form.patchValue({
        title: this.card.title,
        channel: this.card.channel ?? '',
        assigned_user_id: this.card.assigned_user_id,
        priority: this.card.priority,
      });
    }
  }

  submit(): void {
    if (this.form.invalid) return;
    const raw = this.form.getRawValue();
    this.save.emit({
      title: raw.title!,
      channel: raw.channel || null,
      assigned_user_id: raw.assigned_user_id ?? null,
      priority: raw.priority!,
      column_id: this.card?.column_id ?? this.defaultColumnId,
    });
  }
}

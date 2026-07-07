import { Component, Input } from '@angular/core';
import { Card } from '../../models/card.model';
import { Column } from '../../models/column.model';
import { statusChipClass, statusLabel } from '../ticket-status';

@Component({
  selector: 'app-status-chip',
  templateUrl: './status-chip.html',
})
export class StatusChip {
  @Input({ required: true }) ticket!: Card;
  @Input({ required: true }) columns!: Column[];

  get label(): string {
    return statusLabel(this.ticket, this.columns);
  }

  get chipClass(): string {
    return statusChipClass(this.ticket);
  }
}

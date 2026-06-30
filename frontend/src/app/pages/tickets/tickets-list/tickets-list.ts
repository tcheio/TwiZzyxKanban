import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ColumnsService } from '../../../services/columns.service';
import { CardsService } from '../../../services/cards.service';
import { UsersService } from '../../../services/users.service';
import { Card, CardInput } from '../../../models/card.model';
import { Column } from '../../../models/column.model';
import { UserLite } from '../../../models/user.model';
import { NewTicketDialog } from '../new-ticket-dialog/new-ticket-dialog';

@Component({
  selector: 'app-tickets-list',
  imports: [NewTicketDialog],
  templateUrl: './tickets-list.html',
  styleUrl: './tickets-list.css',
})
export class TicketsList implements OnInit {
  private columnsService = inject(ColumnsService);
  private cardsService = inject(CardsService);
  private usersService = inject(UsersService);
  private router = inject(Router);

  readonly columns = signal<Column[]>([]);
  readonly tickets = signal<Card[]>([]);
  readonly users = signal<UserLite[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly dialogOpen = signal(false);

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [columns, cards, users] = await Promise.all([
        this.columnsService.list(),
        this.cardsService.list(),
        this.usersService.lite(),
      ]);
      this.columns.set(columns);
      this.users.set(users);

      const columnPosition = new Map(columns.map((c) => [c.id, c.position]));
      const sorted = [...cards].sort((a, b) => {
        const colDiff = (columnPosition.get(a.column_id) ?? 0) - (columnPosition.get(b.column_id) ?? 0);
        return colDiff !== 0 ? colDiff : a.position - b.position;
      });
      this.tickets.set(sorted);
    } catch {
      this.error.set('Impossible de charger les tickets.');
    } finally {
      this.loading.set(false);
    }
  }

  columnName(columnId: number): string {
    return this.columns().find((c) => c.id === columnId)?.name ?? '—';
  }

  userName(id: number | null): string {
    if (!id) return '—';
    return this.users().find((u) => u.id === id)?.username ?? '—';
  }

  openTicket(card: Card): void {
    this.router.navigate(['/tickets', card.id]);
  }

  async createTicket(input: CardInput): Promise<void> {
    try {
      const created = await this.cardsService.create(input);
      this.dialogOpen.set(false);
      this.router.navigate(['/tickets', created.id]);
    } catch {
      this.error.set('Échec de la création du ticket.');
    }
  }
}

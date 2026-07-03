import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ColumnsService } from '../../../services/columns.service';
import { CardsService } from '../../../services/cards.service';
import { UsersService } from '../../../services/users.service';
import { TagsService } from '../../../services/tags.service';
import { EpicsService } from '../../../services/epics.service';
import { Card, CardInput } from '../../../models/card.model';
import { Column } from '../../../models/column.model';
import { UserLite } from '../../../models/user.model';
import { Tag } from '../../../models/tag.model';
import { Epic } from '../../../models/epic.model';
import { NewTicketDialog } from '../new-ticket-dialog/new-ticket-dialog';
import { AuthService } from '../../../core/auth.service';

@Component({
  selector: 'app-tickets-list',
  imports: [FormsModule, NewTicketDialog],
  templateUrl: './tickets-list.html',
  styleUrl: './tickets-list.css',
})
export class TicketsList implements OnInit {
  private columnsService = inject(ColumnsService);
  private cardsService = inject(CardsService);
  private usersService = inject(UsersService);
  private tagsService = inject(TagsService);
  private epicsService = inject(EpicsService);
  private router = inject(Router);
  protected authService = inject(AuthService);

  readonly columns = signal<Column[]>([]);
  readonly tickets = signal<Card[]>([]);
  readonly users = signal<UserLite[]>([]);
  readonly tags = signal<Tag[]>([]);
  readonly epics = signal<Epic[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly dialogOpen = signal(false);

  readonly filterTagId = signal<number | null>(null);
  readonly filterEpicId = signal<number | null>(null);
  readonly filterAssigneeId = signal<number | null>(null);
  readonly filterColumnId = signal<number | null>(null);

  readonly hasActiveFilters = computed(
    () =>
      this.filterTagId() !== null ||
      this.filterEpicId() !== null ||
      this.filterAssigneeId() !== null ||
      this.filterColumnId() !== null
  );

  readonly filteredTickets = computed(() => {
    const tagId = this.filterTagId();
    const epicId = this.filterEpicId();
    const assigneeId = this.filterAssigneeId();
    const columnId = this.filterColumnId();
    return this.tickets().filter((ticket) => {
      if (tagId !== null && ticket.tag_id !== tagId) return false;
      if (epicId !== null && ticket.epic_id !== epicId) return false;
      if (assigneeId !== null && ticket.assigned_user_id !== assigneeId) return false;
      if (columnId !== null && ticket.column_id !== columnId) return false;
      return true;
    });
  });

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [columns, cards, users, tags, epics] = await Promise.all([
        this.columnsService.list(),
        this.cardsService.list(),
        this.usersService.lite(),
        this.tagsService.list(),
        this.epicsService.list(),
      ]);
      this.columns.set(columns);
      this.users.set(users);
      this.tags.set(tags);
      this.epics.set(epics);

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

  resetFilters(): void {
    this.filterTagId.set(null);
    this.filterEpicId.set(null);
    this.filterAssigneeId.set(null);
    this.filterColumnId.set(null);
  }

  columnName(columnId: number): string {
    return this.columns().find((c) => c.id === columnId)?.name ?? '—';
  }

  userName(id: number | null): string {
    if (!id) return '—';
    return this.users().find((u) => u.id === id)?.username ?? '—';
  }

  tagName(tagId: number | null): string {
    if (!tagId) return '—';
    return this.tags().find((t) => t.id === tagId)?.name ?? '—';
  }

  epicName(epicId: number | null): string {
    if (!epicId) return '—';
    return this.epics().find((e) => e.id === epicId)?.name ?? '—';
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

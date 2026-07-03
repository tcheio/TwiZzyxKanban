import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EpicsService } from '../../../services/epics.service';
import { CardsService } from '../../../services/cards.service';
import { ColumnsService } from '../../../services/columns.service';
import { UsersService } from '../../../services/users.service';
import { Epic } from '../../../models/epic.model';
import { Card, Priority } from '../../../models/card.model';
import { Column } from '../../../models/column.model';
import { UserLite } from '../../../models/user.model';
import { ChartComponent } from '../../../shared/chart/chart';

const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Basse',
  medium: 'Moyenne',
  high: 'Haute',
};

@Component({
  selector: 'app-epic-detail',
  imports: [RouterLink, ChartComponent],
  templateUrl: './epic-detail.html',
  styleUrl: './epic-detail.css',
})
export class EpicDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private epicsService = inject(EpicsService);
  private cardsService = inject(CardsService);
  private columnsService = inject(ColumnsService);
  private usersService = inject(UsersService);

  readonly epic = signal<Epic | null>(null);
  readonly columns = signal<Column[]>([]);
  readonly users = signal<UserLite[]>([]);
  readonly tickets = signal<Card[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly statusChart = computed(() => {
    const columns = this.columns();
    const tickets = this.tickets();
    return {
      labels: columns.map((c) => c.name),
      data: columns.map((c) => tickets.filter((t) => t.column_id === c.id).length),
    };
  });

  readonly priorityChart = computed(() => {
    const tickets = this.tickets();
    const priorities: Priority[] = ['low', 'medium', 'high'];
    return {
      labels: priorities.map((p) => PRIORITY_LABELS[p]),
      data: priorities.map((p) => tickets.filter((t) => t.priority === p).length),
    };
  });

  private get epicId(): number {
    return Number(this.route.snapshot.paramMap.get('id'));
  }

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [epics, cards, columns, users] = await Promise.all([
        this.epicsService.list(),
        this.cardsService.list(),
        this.columnsService.list(),
        this.usersService.lite(),
      ]);

      const epic = epics.find((e) => e.id === this.epicId) ?? null;
      if (!epic) {
        this.error.set('EPIC introuvable.');
        return;
      }

      this.epic.set(epic);
      this.columns.set(columns);
      this.users.set(users);

      const columnPosition = new Map(columns.map((c) => [c.id, c.position]));
      const ticketsForEpic = cards
        .filter((c) => c.epic_id === epic.id)
        .sort((a, b) => {
          const colDiff = (columnPosition.get(a.column_id) ?? 0) - (columnPosition.get(b.column_id) ?? 0);
          return colDiff !== 0 ? colDiff : a.position - b.position;
        });
      this.tickets.set(ticketsForEpic);
    } catch {
      this.error.set("Impossible de charger l'EPIC.");
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
}

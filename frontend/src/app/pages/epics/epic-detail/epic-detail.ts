import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { EpicsService } from '../../../services/epics.service';
import { CardsService } from '../../../services/cards.service';
import { ColumnsService } from '../../../services/columns.service';
import { UsersService } from '../../../services/users.service';
import { Epic } from '../../../models/epic.model';
import { Card, Priority } from '../../../models/card.model';
import { Column } from '../../../models/column.model';
import { UserLite } from '../../../models/user.model';
import { ChartComponent } from '../../../shared/chart/chart';
import { epicBadgeClass, epicDotClass } from '../../../shared/epic-colors';
import { StatusChip } from '../../../shared/status-chip/status-chip';
import { cancelledTitleClass } from '../../../shared/ticket-status';
import { startAutoRefresh } from '../../../shared/auto-refresh';

const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Basse',
  medium: 'Moyenne',
  high: 'Haute',
};

const PRIORITY_DOT_CLASSES: Record<Priority, string> = {
  low: 'bg-gray-400',
  medium: 'bg-amber-500',
  high: 'bg-red-600',
};

@Component({
  selector: 'app-epic-detail',
  imports: [RouterLink, ChartComponent, StatusChip],
  templateUrl: './epic-detail.html',
})
export class EpicDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly titleService = inject(Title);
  private readonly epicsService = inject(EpicsService);
  private readonly cardsService = inject(CardsService);
  private readonly columnsService = inject(ColumnsService);
  private readonly usersService = inject(UsersService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly kanbanId = Number(this.route.snapshot.paramMap.get('kanbanId'));

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

  private epicId = Number(this.route.snapshot.paramMap.get('id'));

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      this.epicId = Number(params.get('id'));
      this.reload();
    });
    startAutoRefresh(this.destroyRef, () => this.reload({ silent: true }));
  }

  async reload(options: { silent?: boolean } = {}): Promise<void> {
    if (!options.silent) {
      this.loading.set(true);
    }
    this.error.set(null);
    try {
      const [epics, cards, columns, users] = await Promise.all([
        this.epicsService.list(this.kanbanId),
        this.cardsService.list(this.kanbanId),
        this.columnsService.list(this.kanbanId),
        this.usersService.liteForKanban(this.kanbanId),
      ]);

      const epic = epics.find((e) => e.id === this.epicId) ?? null;
      if (!epic) {
        this.error.set('EPIC introuvable.');
        return;
      }

      this.epic.set(epic);
      this.columns.set(columns);
      this.users.set(users);
      this.titleService.setTitle(`${epic.name} - TwiZzyxKanban`);

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

  readonly cancelledTitleClass = cancelledTitleClass;

  userName(id: number | null): string {
    if (!id) return '—';
    return this.users().find((u) => u.id === id)?.username ?? '—';
  }

  userInitial(id: number | null): string {
    const name = this.userName(id);
    return name === '—' ? '?' : name.charAt(0).toUpperCase();
  }

  userAvatar(id: number | null): string | null {
    if (!id) return null;
    return this.users().find((u) => u.id === id)?.avatar_url ?? null;
  }

  epicClass(): string {
    return epicBadgeClass(this.epic()?.color);
  }

  epicDot(): string {
    return epicDotClass(this.epic()?.color);
  }

  priorityDotClass(priority: Priority): string {
    return PRIORITY_DOT_CLASSES[priority];
  }

  openTicket(card: Card): void {
    this.router.navigate(['/kanbans', this.kanbanId, 'tickets', card.id]);
  }
}

import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { TagsService } from '../../../services/board/tags.service';
import { CardsService } from '../../../services/tickets/cards.service';
import { ColumnsService } from '../../../services/board/columns.service';
import { UsersService } from '../../../services/account/users.service';
import { Tag } from '../../../models/tag.model';
import { Card, Priority } from '../../../models/card.model';
import { Column } from '../../../models/column.model';
import { UserLite } from '../../../models/user.model';
import { Kanban } from '../../../models/kanban.model';
import { ChartComponent } from '../../../shared/chart/chart';
import { tagBadgeClass } from '../../../shared/tag-colors';
import { StatusChip } from '../../../shared/status-chip/status-chip';
import { cancelledTitleClass } from '../../../shared/ticket-status';
import { PRIORITY_LABELS, priorityLabel, priorityDotClass } from '../../../shared/priority';
import { startAutoRefresh } from '../../../shared/auto-refresh';
import { PeriodFilter } from '../../../shared/period-filter/period-filter';
import { inPeriod } from '../../../shared/period';

@Component({
  selector: 'app-tag-detail',
  imports: [RouterLink, ChartComponent, StatusChip, PeriodFilter],
  templateUrl: './tag-detail.html',
})
export class TagDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly titleService = inject(Title);
  private readonly tagsService = inject(TagsService);
  private readonly cardsService = inject(CardsService);
  private readonly columnsService = inject(ColumnsService);
  private readonly usersService = inject(UsersService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly kanban = this.route.snapshot.data['kanban'] as Kanban;
  protected readonly kanbanId = this.kanban.id;
  protected readonly kanbanCode = this.kanban.code;
  protected readonly canManage = this.kanban.is_moderator;

  readonly tag = signal<Tag | null>(null);
  readonly columns = signal<Column[]>([]);
  readonly users = signal<UserLite[]>([]);
  readonly tickets = signal<Card[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  // Période d'analyse (filtre sur la date de création du ticket) : null des deux côtés =
  // pas de filtre, tout l'historique.
  readonly periodFrom = signal<string | null>(null);
  readonly periodTo = signal<string | null>(null);

  readonly filteredTickets = computed(() => {
    const from = this.periodFrom();
    const to = this.periodTo();
    if (!from && !to) return this.tickets();
    return this.tickets().filter((t) => inPeriod(t.created_at, from, to));
  });

  readonly statusChart = computed(() => {
    const columns = this.columns();
    const tickets = this.filteredTickets();
    return {
      labels: columns.map((c) => c.name),
      data: columns.map((c) => tickets.filter((t) => t.column_id === c.id).length),
    };
  });

  readonly priorityChart = computed(() => {
    const tickets = this.filteredTickets();
    const priorities: Priority[] = ['low', 'medium', 'high'];
    return {
      labels: priorities.map((p) => PRIORITY_LABELS[p]),
      data: priorities.map((p) => tickets.filter((t) => t.priority === p).length),
    };
  });

  private tagId = Number(this.route.snapshot.paramMap.get('id'));

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      this.tagId = Number(params.get('id'));
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
      const [tags, cards, columns, users] = await Promise.all([
        this.tagsService.list(this.kanbanId),
        this.cardsService.list(this.kanbanId),
        this.columnsService.list(this.kanbanId),
        this.usersService.liteForKanban(this.kanbanId),
      ]);

      const tag = tags.find((t) => t.id === this.tagId) ?? null;
      if (!tag) {
        this.error.set('Tag introuvable.');
        return;
      }

      this.tag.set(tag);
      this.columns.set(columns);
      this.users.set(users);
      this.titleService.setTitle(`${tag.name} - TwiZzyxKanban`);

      const columnPosition = new Map(columns.map((c) => [c.id, c.position]));
      const ticketsForTag = cards
        .filter((c) => c.tag_id === tag.id || (c.tag_ids ?? []).includes(tag.id))
        .sort((a, b) => {
          const colDiff = (columnPosition.get(a.column_id) ?? 0) - (columnPosition.get(b.column_id) ?? 0);
          return colDiff !== 0 ? colDiff : a.position - b.position;
        });
      this.tickets.set(ticketsForTag);
    } catch {
      this.error.set('Impossible de charger le tag.');
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

  tagClass(): string {
    return tagBadgeClass(this.tag()?.color);
  }

  readonly priorityDotClass = priorityDotClass;
  readonly priorityLabel = priorityLabel;

  openTicket(card: Card): void {
    this.router.navigate(['/kanbans', `${this.kanban.code}-${card.id}`]);
  }

  async unarchiveTag(): Promise<void> {
    const tag = this.tag();
    if (!tag || !confirm(`Réactiver le tag "${tag.name}" ?`)) return;
    try {
      this.tag.set(await this.tagsService.update(this.kanbanId, tag.id, { archived: false }));
    } catch {
      this.error.set('Échec de la réactivation du tag.');
    }
  }
}

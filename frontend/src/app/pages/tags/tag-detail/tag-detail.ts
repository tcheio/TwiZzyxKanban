import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TagsService } from '../../../services/tags.service';
import { CardsService } from '../../../services/cards.service';
import { ColumnsService } from '../../../services/columns.service';
import { UsersService } from '../../../services/users.service';
import { Tag } from '../../../models/tag.model';
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
  selector: 'app-tag-detail',
  imports: [RouterLink, ChartComponent],
  templateUrl: './tag-detail.html',
  styleUrl: './tag-detail.css',
})
export class TagDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private tagsService = inject(TagsService);
  private cardsService = inject(CardsService);
  private columnsService = inject(ColumnsService);
  private usersService = inject(UsersService);

  readonly tag = signal<Tag | null>(null);
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

  private get tagId(): number {
    return Number(this.route.snapshot.paramMap.get('id'));
  }

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [tags, cards, columns, users] = await Promise.all([
        this.tagsService.list(),
        this.cardsService.list(),
        this.columnsService.list(),
        this.usersService.lite(),
      ]);

      const tag = tags.find((t) => t.id === this.tagId) ?? null;
      if (!tag) {
        this.error.set('Tag introuvable.');
        return;
      }

      this.tag.set(tag);
      this.columns.set(columns);
      this.users.set(users);

      const columnPosition = new Map(columns.map((c) => [c.id, c.position]));
      const ticketsForTag = cards
        .filter((c) => c.tag_id === tag.id)
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

  userName(id: number | null): string {
    if (!id) return '—';
    return this.users().find((u) => u.id === id)?.username ?? '—';
  }

  openTicket(card: Card): void {
    this.router.navigate(['/tickets', card.id]);
  }
}

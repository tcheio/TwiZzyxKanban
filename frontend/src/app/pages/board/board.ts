import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  CdkDropList,
  CdkDropListGroup,
  CdkDrag,
  CdkDragDrop,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { ColumnsService } from '../../services/columns.service';
import { CardsService } from '../../services/cards.service';
import { UsersService } from '../../services/users.service';
import { TagsService } from '../../services/tags.service';
import { EpicsService } from '../../services/epics.service';
import { Column } from '../../models/column.model';
import { Kanban } from '../../models/kanban.model';
import { Card, Priority } from '../../models/card.model';
import { UserLite } from '../../models/user.model';
import { Tag } from '../../models/tag.model';
import { Epic } from '../../models/epic.model';
import { epicBadgeClass } from '../../shared/epic-colors';
import { tagBadgeClass } from '../../shared/tag-colors';
import { startAutoRefresh } from '../../shared/auto-refresh';

interface ColumnGroup {
  column: Column;
  cards: Card[];
}

const PUBLISHED_COLUMN_NAME = '✅Publié';
const PUBLISHED_RETENTION_DAYS = 14;
const DUE_SOON_DAYS = 7;
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const TOAST_DURATION_MS = 6000;

const PRIORITY_CLASSES: Record<Priority, string> = {
  low: 'bg-gray-400',
  medium: 'bg-amber-500',
  high: 'bg-red-600',
};

@Component({
  selector: 'app-board',
  imports: [CdkDropListGroup, CdkDropList, CdkDrag, FormsModule],
  templateUrl: './board.html',
})
export class Board implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly kanban = this.route.snapshot.data['kanban'] as Kanban;
  private readonly kanbanId = this.kanban.id;

  readonly groups = signal<ColumnGroup[]>([]);
  readonly users = signal<UserLite[]>([]);
  readonly tags = signal<Tag[]>([]);
  readonly epics = signal<Epic[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly toastMessage = signal<string | null>(null);
  private toastTimeout: ReturnType<typeof setTimeout> | null = null;
  private blockedDragAttempt = false;
  private dragInProgress = false;

  readonly selectedAssigneeId = signal<number | null>(null);
  readonly searchQuery = signal('');

  constructor(
    private readonly columnsService: ColumnsService,
    private readonly cardsService: CardsService,
    private readonly usersService: UsersService,
    private readonly tagsService: TagsService,
    private readonly epicsService: EpicsService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.reload();
    startAutoRefresh(this.destroyRef, () => {
      if (!this.dragInProgress) {
        this.reload({ silent: true });
      }
    });
  }

  async reload(options: { silent?: boolean } = {}): Promise<void> {
    if (!options.silent) {
      this.loading.set(true);
    }
    this.error.set(null);
    try {
      const [columns, cards, users, tags, epics] = await Promise.all([
        this.columnsService.list(this.kanbanId),
        this.cardsService.list(this.kanbanId),
        this.usersService.liteForKanban(this.kanbanId),
        this.tagsService.list(this.kanbanId),
        this.epicsService.list(this.kanbanId),
      ]);
      this.users.set(users);
      this.tags.set(tags);
      this.epics.set(epics);
      this.groups.set(
        columns.map((column) => ({
          column,
          cards: cards
            .filter((c) => c.column_id === column.id)
            .filter((c) => !c.cancelled_at)
            .filter((c) => this.isVisibleInColumn(c, column))
            .sort((a, b) => a.position - b.position),
        }))
      );
    } catch {
      this.error.set('Impossible de charger le tableau.');
    } finally {
      this.loading.set(false);
    }
  }

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

  visibleCards(group: ColumnGroup): Card[] {
    const assigneeId = this.selectedAssigneeId();
    const query = this.searchQuery().trim().toLowerCase();
    return group.cards.filter((c) => {
      if (assigneeId !== null && c.assigned_user_id !== assigneeId) return false;
      if (query && !c.title.toLowerCase().includes(query)) return false;
      return true;
    });
  }

  toggleAssigneeFilter(userId: number | null): void {
    if (userId === null) return;
    this.selectedAssigneeId.set(this.selectedAssigneeId() === userId ? null : userId);
  }

  clearAssigneeFilter(): void {
    this.selectedAssigneeId.set(null);
  }

  tagName(tagId: number | null): string | null {
    if (!tagId) return null;
    return this.tags().find((t) => t.id === tagId)?.name ?? null;
  }

  priorityClass(priority: Priority): string {
    return PRIORITY_CLASSES[priority];
  }

  tagClass(tagId: number | null): string {
    return tagBadgeClass(tagId, this.tagName(tagId));
  }

  epicName(epicId: number | null): string | null {
    if (!epicId) return null;
    return this.epics().find((e) => e.id === epicId)?.name ?? null;
  }

  epicClass(epicId: number | null): string {
    if (!epicId) return '';
    const color = this.epics().find((e) => e.id === epicId)?.color;
    return epicBadgeClass(color);
  }

  formatDate(dateStr: string): string {
    const [year, month, day] = dateStr.split('-');
    return `${day}-${month}-${year}`;
  }

  isDueSoon(dueDate: string | null): boolean {
    if (!dueDate) return false;
    const diffDays = (new Date(dueDate).getTime() - Date.now()) / MS_PER_DAY;
    return diffDays <= DUE_SOON_DAYS;
  }

  private isVisibleInColumn(card: Card, column: Column): boolean {
    if (column.name !== PUBLISHED_COLUMN_NAME || !card.published_at) return true;
    const ageDays = (Date.now() - new Date(card.published_at).getTime()) / MS_PER_DAY;
    return ageDays < PUBLISHED_RETENTION_DAYS;
  }

  private isPublished(card: Card): boolean {
    return this.groups().find((g) => g.column.id === card.column_id)?.column.name === PUBLISHED_COLUMN_NAME;
  }

  canEnter = (drag: CdkDrag<Card>, drop: CdkDropList): boolean => {
    const card = drag.data;
    const allowed = !this.isPublished(card) || drop.id === 'col-' + card.column_id;
    if (!allowed) {
      this.blockedDragAttempt = true;
    }
    return allowed;
  };

  onDragStarted(): void {
    this.blockedDragAttempt = false;
    this.dragInProgress = true;
  }

  onDragEnded(): void {
    this.dragInProgress = false;
    if (this.blockedDragAttempt) {
      this.showToast('Un ticket publié ne peut plus être déplacé vers une autre colonne.');
      this.blockedDragAttempt = false;
    }
  }

  private showToast(message: string): void {
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
    this.toastMessage.set(message);
    this.toastTimeout = setTimeout(() => this.toastMessage.set(null), TOAST_DURATION_MS);
  }

  async drop(event: CdkDragDrop<Card[]>): Promise<void> {
    const card = event.previousContainer.data[event.previousIndex];
    if (event.previousContainer !== event.container && this.isPublished(card)) {
      return;
    }

    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
    }
    this.groups.set([...this.groups()]);

    const targetColumnId = Number(event.container.id.replace('col-', ''));
    try {
      await this.cardsService.move(this.kanbanId, card.id, targetColumnId, event.currentIndex);
    } catch {
      this.error.set('Le déplacement a échoué, rechargement du tableau...');
      await this.reload();
    }
  }

  openTicket(card: Card): void {
    this.router.navigate(['/kanbans', `${this.kanban.code}-${card.id}`]);
  }
}

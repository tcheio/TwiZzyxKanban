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
  low: 'bg-text-faint',
  medium: 'bg-amber-500',
  high: 'bg-danger',
};

// Plus la valeur est basse, plus la carte remonte quand le tri "Priorité" est actif.
const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

export type SortKey = 'name' | 'priority' | 'due_date' | 'tag' | 'epic';

// Ordre canonique appliqué quand plusieurs critères de tri sont actifs en même temps :
// chaque critère actif départage les égalités du précédent, dans cet ordre.
const SORT_KEY_ORDER: SortKey[] = ['name', 'priority', 'due_date', 'tag', 'epic'];
const SORT_KEY_LABELS: Record<SortKey, string> = {
  name: 'Nom',
  priority: 'Priorité',
  due_date: 'Échéance',
  tag: 'Tag',
  epic: 'Épic',
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

  // Tri(s) actif(s) en plus de l'ordre personnalisé (glisser-déposer) : aucun par défaut,
  // et jamais persisté (réinitialisé à chaque rechargement de page).
  readonly activeSortKeys = signal<ReadonlySet<SortKey>>(new Set());
  readonly sortKeyOrder = SORT_KEY_ORDER;
  readonly sortKeyLabels = SORT_KEY_LABELS;

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

  // Responsable principal + additionnels, dans cet ordre. null si personne n'est assigné,
  // pour permettre `@if (cardAssigneeIds(card); as ids)` dans le template (un tableau vide
  // serait toujours "vrai").
  cardAssigneeIds(card: Card): number[] | null {
    const ids = [card.assigned_user_id, ...(card.assignee_ids ?? [])].filter(
      (id): id is number => id !== null
    );
    return ids.length ? ids : null;
  }

  assigneeNames(ids: number[]): string {
    return ids.map((id) => this.userName(id)).join(', ');
  }

  visibleCards(group: ColumnGroup): Card[] {
    const assigneeId = this.selectedAssigneeId();
    const query = this.searchQuery().trim().toLowerCase();
    const filtered = group.cards.filter((c) => {
      if (assigneeId !== null && c.assigned_user_id !== assigneeId && !(c.assignee_ids ?? []).includes(assigneeId)) {
        return false;
      }
      if (query && !c.title.toLowerCase().includes(query)) return false;
      return true;
    });

    const activeKeys = this.sortKeyOrder.filter((key) => this.activeSortKeys().has(key));
    if (activeKeys.length === 0) return filtered;
    return [...filtered].sort((a, b) => this.compareCards(a, b, activeKeys));
  }

  toggleAssigneeFilter(userId: number | null): void {
    if (userId === null) return;
    this.selectedAssigneeId.set(this.selectedAssigneeId() === userId ? null : userId);
  }

  clearAssigneeFilter(): void {
    this.selectedAssigneeId.set(null);
  }

  toggleSortKey(key: SortKey): void {
    const next = new Set(this.activeSortKeys());
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    this.activeSortKeys.set(next);
  }

  // Chaque critère actif (dans l'ordre canonique) départage les égalités du précédent ;
  // l'ordre personnalisé (position) sert de dernier recours si tout est à égalité.
  private compareCards(a: Card, b: Card, activeKeys: SortKey[]): number {
    for (const key of activeKeys) {
      const cmp = this.compareByKey(a, b, key);
      if (cmp !== 0) return cmp;
    }
    return a.position - b.position;
  }

  private compareByKey(a: Card, b: Card, key: SortKey): number {
    switch (key) {
      case 'name':
        return a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' });
      case 'priority':
        return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      case 'due_date':
        return this.compareNullableThenValue(
          a.due_date,
          b.due_date,
          (x, y) => new Date(x).getTime() - new Date(y).getTime()
        );
      case 'tag':
        return this.compareNullableThenValue(this.tagName(a.tag_id), this.tagName(b.tag_id), (x, y) =>
          x.localeCompare(y, 'fr', { sensitivity: 'base' })
        );
      case 'epic':
        return this.compareNullableThenValue(this.epicName(a.epic_id), this.epicName(b.epic_id), (x, y) =>
          x.localeCompare(y, 'fr', { sensitivity: 'base' })
        );
    }
  }

  // Les cartes qui portent la valeur triée passent avant celles qui ne l'ont pas
  // (elles restent alors en ordre personnalisé, départagées plus loin dans compareCards).
  private compareNullableThenValue<T>(a: T | null, b: T | null, compare: (a: T, b: T) => number): number {
    if (a !== null && b !== null) return compare(a, b);
    if (a !== null) return -1;
    if (b !== null) return 1;
    return 0;
  }

  tagName(tagId: number | null): string | null {
    if (!tagId) return null;
    return this.tags().find((t) => t.id === tagId)?.name ?? null;
  }

  priorityClass(priority: Priority): string {
    return PRIORITY_CLASSES[priority];
  }

  tagClass(tagId: number | null): string {
    if (!tagId) return '';
    const color = this.tags().find((t) => t.id === tagId)?.color;
    return tagBadgeClass(color);
  }

  tagEmote(tagId: number | null): string | null {
    if (!tagId) return null;
    return this.tags().find((t) => t.id === tagId)?.emote_url ?? null;
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

  epicEmote(epicId: number | null): string | null {
    if (!epicId) return null;
    return this.epics().find((e) => e.id === epicId)?.emote_url ?? null;
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

  isPublished(card: Card): boolean {
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

  private groupForContainerId(containerId: string): ColumnGroup | undefined {
    return this.groups().find((g) => 'col-' + g.column.id === containerId);
  }

  // Quand une recherche/un filtre destinataire est actif, l'index donné par CDK
  // (previousIndex/currentIndex) est relatif aux cartes VISIBLES, pas à la liste
  // complète de la colonne (`[cdkDropListData]="group.cards"`). On traduit donc la
  // position choisie parmi les cartes visibles en index réel dans la liste complète,
  // pour ne pas désynchroniser l'ordre stocké quand certaines cartes sont masquées.
  private resolveRealTargetIndex(
    targetFullList: Card[],
    targetVisibleList: Card[],
    visibleIndex: number,
    draggedCardId: number
  ): number {
    const others = targetFullList.filter((c) => c.id !== draggedCardId);
    const visibleOthers = targetVisibleList.filter((c) => c.id !== draggedCardId);

    if (visibleIndex >= visibleOthers.length) {
      const last = visibleOthers[visibleOthers.length - 1];
      const lastRealIndex = last ? others.findIndex((c) => c.id === last.id) : -1;
      return lastRealIndex === -1 ? others.length : lastRealIndex + 1;
    }

    const neighbor = visibleOthers[visibleIndex];
    const idx = others.findIndex((c) => c.id === neighbor.id);
    return idx === -1 ? others.length : idx;
  }

  async drop(event: CdkDragDrop<Card[]>): Promise<void> {
    // `event.item.data` (le `[cdkDragData]` de la carte réellement saisie) est fiable
    // même filtré, contrairement à un index dans `previousContainer.data`.
    const card = event.item.data as Card;
    if (event.previousContainer !== event.container && this.isPublished(card)) {
      return;
    }

    const previousGroup = this.groupForContainerId(event.previousContainer.id);
    const targetGroup = this.groupForContainerId(event.container.id);
    if (!previousGroup || !targetGroup) return;

    const realPreviousIndex = previousGroup.cards.findIndex((c) => c.id === card.id);
    if (realPreviousIndex === -1) return;

    const targetVisible = this.visibleCards(targetGroup);
    const realCurrentIndex = this.resolveRealTargetIndex(
      targetGroup.cards,
      targetVisible,
      event.currentIndex,
      card.id
    );

    if (previousGroup === targetGroup) {
      moveItemInArray(previousGroup.cards, realPreviousIndex, realCurrentIndex);
    } else {
      transferArrayItem(previousGroup.cards, targetGroup.cards, realPreviousIndex, realCurrentIndex);
    }
    this.groups.set([...this.groups()]);

    try {
      await this.cardsService.move(this.kanbanId, card.id, targetGroup.column.id, realCurrentIndex);
    } catch {
      this.error.set('Le déplacement a échoué, rechargement du tableau...');
      await this.reload();
    }
  }

  openTicket(card: Card): void {
    this.router.navigate(['/kanbans', `${this.kanban.code}-${card.id}`]);
  }

  goToTag(tagId: number): void {
    this.router.navigate(['/kanbans', this.kanban.code, 'tags', tagId]);
  }

  goToEpic(epicId: number): void {
    this.router.navigate(['/kanbans', this.kanban.code, 'epics', epicId]);
  }
}

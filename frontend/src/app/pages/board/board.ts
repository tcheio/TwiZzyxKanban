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
import { ColumnsService } from '../../services/board/columns.service';
import { CardsService } from '../../services/tickets/cards.service';
import { UsersService } from '../../services/account/users.service';
import { TagsService } from '../../services/board/tags.service';
import { EpicsService } from '../../services/board/epics.service';
import { AuthService } from '../../core/auth.service';
import { Column } from '../../models/column.model';
import { Kanban } from '../../models/kanban.model';
import { Card, Priority } from '../../models/card.model';
import { UserLite } from '../../models/user.model';
import { Tag } from '../../models/tag.model';
import { Epic } from '../../models/epic.model';
import { epicBadgeClass } from '../../shared/epic-colors';
import { tagBadgeClass } from '../../shared/tag-colors';
import { priorityLabel, priorityDotClass } from '../../shared/priority';
import { startAutoRefresh } from '../../shared/auto-refresh';

// Une colonne non divisée produit 1 lane (state: null) ; une colonne divisée en 2
// états (column.state_a_name/state_b_name) produit 2 lanes ('a' puis 'b'). Chaque lane
// se comporte comme une mini-colonne autonome pour le drag & drop (tri, filtres,
// position) — c'est ce qui permet de réutiliser tel quel tout le mécanisme existant.
interface Lane {
  column: Column;
  state: 'a' | 'b' | null;
  cards: Card[];
}

interface ColumnGroup {
  column: Column;
  lanes: Lane[];
}

const PUBLISHED_COLUMN_NAME = '✅Publié';
const PUBLISHED_RETENTION_DAYS = 14;
const DUE_SOON_DAYS = 7;
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const TOAST_DURATION_MS = 6000;

// Plus la valeur est basse, plus la carte remonte quand le tri "Priorité" est actif.
const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

export type SortKey = 'name' | 'priority' | 'due_date';

// Ordre canonique appliqué quand plusieurs critères de tri sont actifs en même temps :
// chaque critère actif départage les égalités du précédent, dans cet ordre.
const SORT_KEY_ORDER: SortKey[] = ['name', 'priority', 'due_date'];
const SORT_KEY_LABELS: Record<SortKey, string> = {
  name: 'Nom',
  priority: 'Priorité',
  due_date: 'Échéance',
};

// Pseudo-id (jamais un vrai tag_id) représentant le filtre "Aucun tag" : les tickets qui
// n'ont ni tag principal ni tag additionnel. Il n'existe pas d'équivalent pour les EPICs.
export const NO_TAG_FILTER_ID = -1;

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
  readonly selectedTagFilterId = signal<number | null>(null);
  readonly selectedEpicFilterId = signal<number | null>(null);
  readonly searchQuery = signal('');
  readonly noTagFilterId = NO_TAG_FILTER_ID;

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
    private readonly epicsService: EpicsService,
    private readonly authService: AuthService
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
      this.groups.set(columns.map((column) => this.buildColumnGroup(column, cards)));
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

  visibleCards(lane: Lane): Card[] {
    const assigneeId = this.selectedAssigneeId();
    const tagFilterId = this.selectedTagFilterId();
    const epicFilterId = this.selectedEpicFilterId();
    const query = this.searchQuery().trim().toLowerCase();
    const filtered = lane.cards.filter((c) => {
      if (assigneeId !== null && c.assigned_user_id !== assigneeId && !(c.assignee_ids ?? []).includes(assigneeId)) {
        return false;
      }
      if (tagFilterId === NO_TAG_FILTER_ID) {
        if (c.tag_id || (c.tag_ids ?? []).length) return false;
      } else if (tagFilterId !== null && c.tag_id !== tagFilterId && !(c.tag_ids ?? []).includes(tagFilterId)) {
        return false;
      }
      if (epicFilterId !== null && c.epic_id !== epicFilterId) return false;
      if (query && !c.title.toLowerCase().includes(query)) return false;
      return true;
    });

    const activeKeys = this.sortKeyOrder.filter((key) => this.activeSortKeys().has(key));
    if (activeKeys.length === 0) return filtered;
    return [...filtered].sort((a, b) => this.compareCards(a, b, activeKeys));
  }

  hasActiveFilters(): boolean {
    return (
      this.selectedAssigneeId() !== null || this.selectedTagFilterId() !== null || this.selectedEpicFilterId() !== null
    );
  }

  toggleAssigneeFilter(userId: number | null): void {
    if (userId === null) return;
    this.selectedAssigneeId.set(this.selectedAssigneeId() === userId ? null : userId);
  }

  visibleTagFilters(): Tag[] {
    return this.tags().filter((t) => t.visible_in_filter);
  }

  visibleEpicFilters(): Epic[] {
    return this.epics().filter((e) => e.visible_in_filter);
  }

  toggleTagFilter(tagId: number): void {
    this.selectedTagFilterId.set(this.selectedTagFilterId() === tagId ? null : tagId);
  }

  toggleEpicFilter(epicId: number): void {
    this.selectedEpicFilterId.set(this.selectedEpicFilterId() === epicId ? null : epicId);
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

  readonly priorityClass = priorityDotClass;
  readonly priorityLabel = priorityLabel;

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

  private buildColumnGroup(column: Column, allCards: Card[]): ColumnGroup {
    const columnCards = allCards
      .filter((c) => c.column_id === column.id)
      .filter((c) => !c.cancelled_at)
      .filter((c) => this.isVisibleInColumn(c, column))
      .sort((a, b) => a.position - b.position);

    if (!column.state_a_name) {
      return { column, lanes: [{ column, state: null, cards: columnCards }] };
    }
    // Cas limite : une carte dont l'état ne correspond à aucun état connu (ex: colonne
    // divisée après coup, cf columns.controller.js::update) retombe dans la 1ère lane.
    return {
      column,
      lanes: [
        { column, state: 'a', cards: columnCards.filter((c) => c.state !== 'b') },
        { column, state: 'b', cards: columnCards.filter((c) => c.state === 'b') },
      ],
    };
  }

  stateLabel(column: Column, state: 'a' | 'b' | null): string | null {
    if (state === 'a') return column.state_a_name ?? null;
    if (state === 'b') return column.state_b_name ?? null;
    return null;
  }

  laneContainerId(column: Column, state: 'a' | 'b' | null): string {
    return state ? `col-${column.id}-${state}` : `col-${column.id}`;
  }

  totalVisibleCount(group: ColumnGroup): number {
    return group.lanes.reduce((sum, lane) => sum + this.visibleCards(lane).length, 0);
  }

  private isVisibleInColumn(card: Card, column: Column): boolean {
    if (column.name !== PUBLISHED_COLUMN_NAME || !card.published_at) return true;
    const ageDays = (Date.now() - new Date(card.published_at).getTime()) / MS_PER_DAY;
    return ageDays < PUBLISHED_RETENTION_DAYS;
  }

  isPublished(card: Card): boolean {
    return this.groups().find((g) => g.column.id === card.column_id)?.column.name === PUBLISHED_COLUMN_NAME;
  }

  // Seuls les modérateurs du kanban et les responsables (principal ou additionnel) du
  // ticket peuvent changer son statut (déplacement de colonne) — reflète la règle
  // appliquée côté backend (cards.controller.js::move/cancel/restore).
  canChangeStatus(card: Card): boolean {
    if (this.kanban.is_moderator) return true;
    const userId = this.authService.currentUser()?.id;
    if (!userId) return false;
    return card.assigned_user_id === userId || (card.assignee_ids ?? []).includes(userId);
  }

  canEnter = (drag: CdkDrag<Card>, drop: CdkDropList): boolean => {
    const card = drag.data;
    // Comparaison au niveau colonne (pas lane) : un ticket publié peut toujours se
    // réordonner entre les 2 états d'une même colonne, mais pas en sortir.
    const allowed = !this.isPublished(card) || this.columnIdForContainerId(drop.id) === card.column_id;
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

  private columnIdForContainerId(containerId: string): number {
    return Number(containerId.replace(/^col-/, '').replace(/-[ab]$/, ''));
  }

  private laneForContainerId(containerId: string): Lane | undefined {
    for (const group of this.groups()) {
      const lane = group.lanes.find((l) => this.laneContainerId(l.column, l.state) === containerId);
      if (lane) return lane;
    }
    return undefined;
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

    const previousLane = this.laneForContainerId(event.previousContainer.id);
    const targetLane = this.laneForContainerId(event.container.id);
    if (!previousLane || !targetLane) return;

    const realPreviousIndex = previousLane.cards.findIndex((c) => c.id === card.id);
    if (realPreviousIndex === -1) return;

    const targetVisible = this.visibleCards(targetLane);
    const realCurrentIndex = this.resolveRealTargetIndex(
      targetLane.cards,
      targetVisible,
      event.currentIndex,
      card.id
    );

    if (previousLane === targetLane) {
      moveItemInArray(previousLane.cards, realPreviousIndex, realCurrentIndex);
    } else {
      transferArrayItem(previousLane.cards, targetLane.cards, realPreviousIndex, realCurrentIndex);
    }
    this.groups.set([...this.groups()]);

    try {
      await this.cardsService.move(this.kanbanId, card.id, targetLane.column.id, realCurrentIndex, targetLane.state);
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

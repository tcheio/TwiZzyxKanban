import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
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
import { Column } from '../../models/column.model';
import { Card } from '../../models/card.model';
import { UserLite } from '../../models/user.model';
import { Tag } from '../../models/tag.model';

interface ColumnGroup {
  column: Column;
  cards: Card[];
}

const PUBLISHED_COLUMN_NAME = 'Publié';
const PUBLISHED_RETENTION_DAYS = 14;
const DUE_SOON_DAYS = 7;
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const TOAST_DURATION_MS = 6000;

@Component({
  selector: 'app-board',
  imports: [CdkDropListGroup, CdkDropList, CdkDrag],
  templateUrl: './board.html',
  styleUrl: './board.css',
})
export class Board implements OnInit {
  private router = inject(Router);

  readonly groups = signal<ColumnGroup[]>([]);
  readonly users = signal<UserLite[]>([]);
  readonly tags = signal<Tag[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly newColumnName = signal('');
  readonly addingColumn = signal(false);

  readonly toastMessage = signal<string | null>(null);
  private toastTimeout: ReturnType<typeof setTimeout> | null = null;
  private blockedDragAttempt = false;

  constructor(
    private columnsService: ColumnsService,
    private cardsService: CardsService,
    private usersService: UsersService,
    private tagsService: TagsService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [columns, cards, users, tags] = await Promise.all([
        this.columnsService.list(),
        this.cardsService.list(),
        this.usersService.lite(),
        this.tagsService.list(),
      ]);
      this.users.set(users);
      this.tags.set(tags);
      this.groups.set(
        columns.map((column) => ({
          column,
          cards: cards
            .filter((c) => c.column_id === column.id)
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

  tagName(tagId: number | null): string | null {
    if (!tagId) return null;
    return this.tags().find((t) => t.id === tagId)?.name ?? null;
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
  }

  onDragEnded(): void {
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
      await this.cardsService.move(card.id, targetColumnId, event.currentIndex);
    } catch {
      this.error.set('Le déplacement a échoué, rechargement du tableau...');
      await this.reload();
    }
  }

  openTicket(card: Card): void {
    this.router.navigate(['/tickets', card.id]);
  }

  async addColumn(): Promise<void> {
    const name = this.newColumnName().trim();
    if (!name) return;
    try {
      await this.columnsService.create(name);
      this.newColumnName.set('');
      this.addingColumn.set(false);
      await this.reload();
    } catch {
      this.error.set('Échec de la création de la colonne.');
    }
  }

  async renameColumn(column: Column, name: string): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed || trimmed === column.name) return;
    try {
      await this.columnsService.rename(column.id, trimmed);
      await this.reload();
    } catch {
      this.error.set('Échec du renommage de la colonne.');
    }
  }

  async deleteColumn(column: Column): Promise<void> {
    if (!confirm(`Supprimer la colonne "${column.name}" ?`)) return;
    try {
      await this.columnsService.remove(column.id);
      await this.reload();
    } catch {
      this.error.set('Impossible de supprimer une colonne contenant des cartes.');
    }
  }

  async moveColumn(index: number, direction: -1 | 1): Promise<void> {
    const groups = this.groups();
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= groups.length) return;

    const orderedIds = groups.map((g) => g.column.id);
    [orderedIds[index], orderedIds[targetIndex]] = [orderedIds[targetIndex], orderedIds[index]];

    try {
      await this.columnsService.reorder(orderedIds);
      await this.reload();
    } catch {
      this.error.set('Échec de la réorganisation des colonnes.');
    }
  }
}

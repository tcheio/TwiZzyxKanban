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
import { Column } from '../../models/column.model';
import { Card } from '../../models/card.model';
import { UserLite } from '../../models/user.model';

interface ColumnGroup {
  column: Column;
  cards: Card[];
}

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
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly newColumnName = signal('');
  readonly addingColumn = signal(false);

  constructor(
    private columnsService: ColumnsService,
    private cardsService: CardsService,
    private usersService: UsersService
  ) {}

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
      this.users.set(users);
      this.groups.set(
        columns.map((column) => ({
          column,
          cards: cards
            .filter((c) => c.column_id === column.id)
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

  async drop(event: CdkDragDrop<Card[]>): Promise<void> {
    const card = event.previousContainer.data[event.previousIndex];

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

  async deleteCard(card: Card): Promise<void> {
    if (!confirm(`Supprimer la carte "${card.title}" ?`)) return;
    try {
      await this.cardsService.remove(card.id);
      await this.reload();
    } catch {
      this.error.set('Échec de la suppression de la carte.');
    }
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

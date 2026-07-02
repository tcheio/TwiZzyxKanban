import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ColumnsService } from '../../../services/columns.service';
import { Column } from '../../../models/column.model';

@Component({
  selector: 'app-board-settings',
  imports: [RouterLink],
  templateUrl: './board-settings.html',
})
export class BoardSettings implements OnInit {
  private columnsService = inject(ColumnsService);

  readonly columns = signal<Column[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly newColumnName = signal('');

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.columns.set(await this.columnsService.list());
    } catch {
      this.error.set('Impossible de charger les colonnes.');
    } finally {
      this.loading.set(false);
    }
  }

  async rename(column: Column, name: string): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed || trimmed === column.name) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.columnsService.rename(column.id, trimmed);
      await this.reload();
    } catch {
      this.error.set('Échec du renommage de la colonne.');
    } finally {
      this.saving.set(false);
    }
  }

  async move(index: number, direction: -1 | 1): Promise<void> {
    const columns = this.columns();
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= columns.length) return;

    const orderedIds = columns.map((c) => c.id);
    [orderedIds[index], orderedIds[targetIndex]] = [orderedIds[targetIndex], orderedIds[index]];

    this.saving.set(true);
    this.error.set(null);
    try {
      this.columns.set(await this.columnsService.reorder(orderedIds));
    } catch {
      this.error.set('Échec de la réorganisation des colonnes.');
    } finally {
      this.saving.set(false);
    }
  }

  async remove(column: Column): Promise<void> {
    if (!confirm(`Supprimer la colonne "${column.name}" ?`)) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.columnsService.remove(column.id);
      await this.reload();
    } catch {
      this.error.set('Impossible de supprimer une colonne contenant des cartes.');
    } finally {
      this.saving.set(false);
    }
  }

  async addColumn(): Promise<void> {
    const name = this.newColumnName().trim();
    if (!name) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.columnsService.create(name);
      this.newColumnName.set('');
      await this.reload();
    } catch {
      this.error.set('Échec de la création de la colonne.');
    } finally {
      this.saving.set(false);
    }
  }
}

import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ColumnsService } from '../../../services/columns.service';
import { TagsService } from '../../../services/tags.service';
import { EpicsService } from '../../../services/epics.service';
import { Column } from '../../../models/column.model';
import { Kanban } from '../../../models/kanban.model';
import { Tag } from '../../../models/tag.model';
import { Epic } from '../../../models/epic.model';
import { tagBadgeClass } from '../../../shared/tag-colors';
import { epicBadgeClass } from '../../../shared/epic-colors';

@Component({
  selector: 'app-board-settings',
  imports: [RouterLink],
  templateUrl: './board-settings.html',
})
export class BoardSettings implements OnInit {
  private readonly columnsService = inject(ColumnsService);
  private readonly tagsService = inject(TagsService);
  private readonly epicsService = inject(EpicsService);
  private readonly route = inject(ActivatedRoute);
  private readonly kanban = this.route.snapshot.data['kanban'] as Kanban;
  readonly kanbanId = this.kanban.id;
  readonly kanbanCode = this.kanban.code;

  readonly columns = signal<Column[]>([]);
  readonly tags = signal<Tag[]>([]);
  readonly epics = signal<Epic[]>([]);
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
      const [columns, tags, epics] = await Promise.all([
        this.columnsService.list(this.kanbanId),
        this.tagsService.list(this.kanbanId),
        this.epicsService.list(this.kanbanId),
      ]);
      this.columns.set(columns);
      this.tags.set(tags);
      this.epics.set(epics);
    } catch {
      this.error.set('Impossible de charger les paramètres du tableau.');
    } finally {
      this.loading.set(false);
    }
  }

  tagClass(tag: Tag): string {
    return tagBadgeClass(tag.color);
  }

  epicClass(epic: Epic): string {
    return epicBadgeClass(epic.color);
  }

  async toggleTagVisible(tag: Tag): Promise<void> {
    try {
      await this.tagsService.update(this.kanbanId, tag.id, { visible_in_filter: !tag.visible_in_filter });
      this.tags.update((list) => list.map((t) => (t.id === tag.id ? { ...t, visible_in_filter: !t.visible_in_filter } : t)));
    } catch {
      this.error.set('Échec de la mise à jour du tag.');
    }
  }

  async toggleEpicVisible(epic: Epic): Promise<void> {
    try {
      await this.epicsService.update(this.kanbanId, epic.id, { visible_in_filter: !epic.visible_in_filter });
      this.epics.update((list) => list.map((e) => (e.id === epic.id ? { ...e, visible_in_filter: !e.visible_in_filter } : e)));
    } catch {
      this.error.set("Échec de la mise à jour de l'EPIC.");
    }
  }

  async toggleColumnRestricted(column: Column): Promise<void> {
    try {
      await this.columnsService.setRestricted(this.kanbanId, column.id, !column.restricted);
      this.columns.update((list) =>
        list.map((c) => (c.id === column.id ? { ...c, restricted: !c.restricted } : c))
      );
    } catch {
      this.error.set('Échec de la mise à jour de la colonne.');
    }
  }

  // Les 2 noms d'état d'une colonne divisée sont renseignés ou absents ensemble (vide
  // des deux côtés = colonne non divisée) — même règle que côté backend
  // (columns.controller.js::validateStateNames).
  async updateColumnStates(column: Column, stateAName: string, stateBName: string): Promise<void> {
    const trimmedA = stateAName.trim();
    const trimmedB = stateBName.trim();
    if (!!trimmedA !== !!trimmedB) {
      this.error.set("État A et état B doivent être renseignés ou absents ensemble.");
      return;
    }
    if (trimmedA === (column.state_a_name ?? '') && trimmedB === (column.state_b_name ?? '')) return;

    this.saving.set(true);
    this.error.set(null);
    try {
      const updated = await this.columnsService.setStates(this.kanbanId, column.id, trimmedA || null, trimmedB || null);
      this.columns.update((list) => list.map((c) => (c.id === column.id ? updated : c)));
    } catch {
      this.error.set('Échec de la mise à jour des états de la colonne.');
    } finally {
      this.saving.set(false);
    }
  }

  async rename(column: Column, name: string): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed || trimmed === column.name) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.columnsService.rename(this.kanbanId, column.id, trimmed);
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
      this.columns.set(await this.columnsService.reorder(this.kanbanId, orderedIds));
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
      await this.columnsService.remove(this.kanbanId, column.id);
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
      await this.columnsService.create(this.kanbanId, name);
      this.newColumnName.set('');
      await this.reload();
    } catch {
      this.error.set('Échec de la création de la colonne.');
    } finally {
      this.saving.set(false);
    }
  }
}

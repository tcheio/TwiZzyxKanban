import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ColumnsService } from '../../../services/board/columns.service';
import { TagsService } from '../../../services/board/tags.service';
import { EpicsService } from '../../../services/board/epics.service';
import { StatsService } from '../../../services/board/stats.service';
import { Column } from '../../../models/column.model';
import { Kanban } from '../../../models/kanban.model';
import { Tag } from '../../../models/tag.model';
import { Epic } from '../../../models/epic.model';
import { ColumnDuration, UserStat } from '../../../models/stats.model';
import { tagBadgeClass } from '../../../shared/tag-colors';
import { epicBadgeClass } from '../../../shared/epic-colors';
import { PeriodFilter } from '../../../shared/period-filter/period-filter';

@Component({
  selector: 'app-board-settings',
  imports: [RouterLink, PeriodFilter],
  templateUrl: './board-settings.html',
})
export class BoardSettings implements OnInit {
  private readonly columnsService = inject(ColumnsService);
  private readonly tagsService = inject(TagsService);
  private readonly epicsService = inject(EpicsService);
  private readonly statsService = inject(StatsService);
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

  readonly statsPeriodFrom = signal<string | null>(null);
  readonly statsPeriodTo = signal<string | null>(null);
  readonly columnDurations = signal<ColumnDuration[]>([]);
  readonly userStats = signal<UserStat[]>([]);
  readonly statsLoading = signal(false);

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
    await this.reloadStats();
  }

  async reloadStats(): Promise<void> {
    this.statsLoading.set(true);
    try {
      const [durations, users] = await Promise.all([
        this.statsService.columnDurations(this.kanbanId, this.statsPeriodFrom(), this.statsPeriodTo()),
        this.statsService.userStats(this.kanbanId, this.statsPeriodFrom(), this.statsPeriodTo()),
      ]);
      this.columnDurations.set(durations);
      this.userStats.set(users);
    } catch {
      this.error.set('Impossible de charger les statistiques.');
    } finally {
      this.statsLoading.set(false);
    }
  }

  setStatsPeriodFrom(value: string | null): void {
    this.statsPeriodFrom.set(value);
    this.reloadStats();
  }

  setStatsPeriodTo(value: string | null): void {
    this.statsPeriodTo.set(value);
    this.reloadStats();
  }

  // Durée au format le plus lisible : heures si < 1 jour, jours sinon.
  formatDuration(hours: number): string {
    if (hours < 24) return `${hours.toFixed(1)} h`;
    return `${(hours / 24).toFixed(1)} j`;
  }

  onTimeRateLabel(stat: UserStat): string {
    if (!stat.with_due_date_count) return '—';
    return `${Math.round((stat.on_time_count / stat.with_due_date_count) * 100)} %`;
  }

  leadLabel(stat: UserStat): string {
    if (stat.avg_lead_days === null) return '—';
    const rounded = Math.round(Math.abs(stat.avg_lead_days) * 10) / 10;
    return stat.avg_lead_days >= 0 ? `+${rounded} j (avance)` : `-${rounded} j (retard)`;
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

  // La colonne avec laquelle `column` est actuellement imbriquée (au plus une, cf le
  // champ `group_key` partagé) — null si `column` n'est imbriquée avec aucune autre.
  groupedWith(column: Column): Column | null {
    if (!column.group_key) return null;
    return this.columns().find((c) => c.id !== column.id && c.group_key === column.group_key) ?? null;
  }

  // Les colonnes que `column` peut rejoindre (toutes les autres colonnes du kanban).
  groupableColumns(column: Column): Column[] {
    return this.columns().filter((c) => c.id !== column.id);
  }

  // `targetId: null` retire `column` de son groupe (l'autre colonne, si elle existe
  // encore, reste groupée seule désormais — elle redevient visuellement une colonne
  // normale côté tableau). Sinon, imbrique `column` avec la colonne cible : réutilise la
  // group_key déjà présente sur l'une des deux si elle existe, sinon en génère une.
  async updateColumnGroup(column: Column, targetId: number | null): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    try {
      if (targetId === null) {
        const updated = await this.columnsService.setGroupKey(this.kanbanId, column.id, null);
        this.columns.update((list) => list.map((c) => (c.id === column.id ? updated : c)));
        return;
      }
      const target = this.columns().find((c) => c.id === targetId);
      if (!target) return;
      const groupKey = column.group_key ?? target.group_key ?? `group-${column.id}-${target.id}`;
      const [updatedColumn, updatedTarget] = await Promise.all([
        this.columnsService.setGroupKey(this.kanbanId, column.id, groupKey),
        this.columnsService.setGroupKey(this.kanbanId, target.id, groupKey),
      ]);
      this.columns.update((list) =>
        list.map((c) => {
          if (c.id === updatedColumn.id) return updatedColumn;
          if (c.id === updatedTarget.id) return updatedTarget;
          return c;
        })
      );
    } catch {
      this.error.set('Échec du regroupement des colonnes.');
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

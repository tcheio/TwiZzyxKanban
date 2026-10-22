import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BoardSettings } from './board-settings';
import { ColumnsService } from '../../../services/board/columns.service';
import { TagsService } from '../../../services/board/tags.service';
import { EpicsService } from '../../../services/board/epics.service';
import { StatsService } from '../../../services/board/stats.service';
import { Tag } from '../../../models/tag.model';
import { Epic } from '../../../models/epic.model';
import { Column } from '../../../models/column.model';
import { ColumnDuration, UserStat } from '../../../models/stats.model';

describe('BoardSettings', () => {
  let component: BoardSettings;
  let columnsService: {
    list: ReturnType<typeof vi.fn>;
    setRestricted: ReturnType<typeof vi.fn>;
    setGroupKey: ReturnType<typeof vi.fn>;
  };
  let tagsService: { list: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  let epicsService: { list: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  let statsService: { columnDurations: ReturnType<typeof vi.fn>; userStats: ReturnType<typeof vi.fn> };

  const columns: Column[] = [{ id: 1, name: '💡Idées', position: 0, restricted: true }];
  const tags: Tag[] = [
    { id: 1, name: 'Minecraft', color: 'emerald', emote_url: null, visible_in_filter: true, archived: false },
  ];
  const epics: Epic[] = [{ id: 1, name: 'Saison 2', color: 'red', emote_url: null, visible_in_filter: false }];
  const columnDurations: ColumnDuration[] = [{ column_id: 1, column_name: '💡Idées', sample_count: 3, avg_hours: 12.5 }];
  const userStats: UserStat[] = [
    { user_id: 1, username: 'alice', completed_count: 2, with_due_date_count: 2, on_time_count: 1, avg_lead_days: -1, current_workload: 3 },
  ];

  beforeEach(() => {
    columnsService = {
      list: vi.fn().mockResolvedValue(columns),
      setRestricted: vi.fn().mockResolvedValue({}),
      setGroupKey: vi.fn().mockResolvedValue({ ...columns[0], group_key: 'group-1-2' }),
    };
    tagsService = {
      list: vi.fn().mockResolvedValue(tags),
      update: vi.fn().mockResolvedValue({}),
    };
    epicsService = {
      list: vi.fn().mockResolvedValue(epics),
      update: vi.fn().mockResolvedValue({}),
    };
    statsService = {
      columnDurations: vi.fn().mockResolvedValue(columnDurations),
      userStats: vi.fn().mockResolvedValue(userStats),
    };

    TestBed.configureTestingModule({
      imports: [BoardSettings],
      providers: [
        { provide: ColumnsService, useValue: columnsService },
        { provide: TagsService, useValue: tagsService },
        { provide: EpicsService, useValue: epicsService },
        { provide: StatsService, useValue: statsService },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { data: { kanban: { id: 1, name: 'Kanban Test', code: 'TK-TEST' } } } },
        },
      ],
    });
    component = TestBed.createComponent(BoardSettings).componentInstance;
  });

  it('reload() charge les colonnes, tags et EPICs', async () => {
    await component.reload();
    expect(component.columns()).toEqual(columns);
    expect(component.tags()).toEqual(tags);
    expect(component.epics()).toEqual(epics);
  });

  it('toggleColumnRestricted() inverse restricted et persiste', async () => {
    await component.reload();
    await component.toggleColumnRestricted(columns[0]);

    expect(columnsService.setRestricted).toHaveBeenCalledWith(1, 1, false);
    expect(component.columns()[0].restricted).toBe(false);
  });

  it('updateColumnGroup() imbrique 2 colonnes (même group_key générée sur les deux)', async () => {
    const montage: Column = { id: 2, name: '🎬Montage', position: 1 };
    columnsService.list.mockResolvedValue([...columns, montage]);
    columnsService.setGroupKey.mockImplementation((_kanbanId: number, id: number, groupKey: string | null) =>
      Promise.resolve({ ...(id === 1 ? columns[0] : montage), group_key: groupKey })
    );
    await component.reload();

    await component.updateColumnGroup(columns[0], montage.id);

    expect(columnsService.setGroupKey).toHaveBeenCalledWith(1, 1, 'group-1-2');
    expect(columnsService.setGroupKey).toHaveBeenCalledWith(1, 2, 'group-1-2');
    expect(component.columns().find((c) => c.id === 1)?.group_key).toBe('group-1-2');
    expect(component.columns().find((c) => c.id === 2)?.group_key).toBe('group-1-2');
  });

  it('updateColumnGroup() réutilise la group_key déjà présente sur la colonne cible', async () => {
    const montage: Column = { id: 2, name: '🎬Montage', position: 1, group_key: 'existant' };
    columnsService.list.mockResolvedValue([...columns, montage]);
    await component.reload();

    await component.updateColumnGroup(columns[0], montage.id);

    expect(columnsService.setGroupKey).toHaveBeenCalledWith(1, 1, 'existant');
    expect(columnsService.setGroupKey).toHaveBeenCalledWith(1, 2, 'existant');
  });

  it('updateColumnGroup(column, null) dégroupe la colonne', async () => {
    const montage: Column = { id: 2, name: '🎬Montage', position: 1, group_key: 'g1' };
    columnsService.list.mockResolvedValue([{ ...columns[0], group_key: 'g1' }, montage]);
    columnsService.setGroupKey.mockResolvedValue({ ...columns[0], group_key: null });
    await component.reload();

    await component.updateColumnGroup(component.columns()[0], null);

    expect(columnsService.setGroupKey).toHaveBeenCalledWith(1, 1, null);
    expect(component.columns()[0].group_key).toBeNull();
  });

  it('groupedWith() résout la colonne partenaire, groupableColumns() exclut la colonne elle-même', async () => {
    const montage: Column = { id: 2, name: '🎬Montage', position: 1, group_key: 'g1' };
    const derush: Column = { ...columns[0], group_key: 'g1' };
    columnsService.list.mockResolvedValue([derush, montage]);
    await component.reload();

    expect(component.groupedWith(derush)?.id).toBe(2);
    expect(component.groupableColumns(derush).map((c) => c.id)).toEqual([2]);
  });

  it('toggleTagVisible() inverse visible_in_filter et persiste', async () => {
    await component.reload();
    await component.toggleTagVisible(tags[0]);

    expect(tagsService.update).toHaveBeenCalledWith(1, 1, { visible_in_filter: false });
    expect(component.tags()[0].visible_in_filter).toBe(false);
  });

  it('toggleEpicVisible() inverse visible_in_filter et persiste', async () => {
    await component.reload();
    await component.toggleEpicVisible(epics[0]);

    expect(epicsService.update).toHaveBeenCalledWith(1, 1, { visible_in_filter: true });
    expect(component.epics()[0].visible_in_filter).toBe(true);
  });

  it('reload() charge aussi les statistiques (durées par colonne et stats par membre)', async () => {
    await component.reload();

    expect(statsService.columnDurations).toHaveBeenCalledWith(1, null, null);
    expect(statsService.userStats).toHaveBeenCalledWith(1, null, null);
    expect(component.columnDurations()).toEqual(columnDurations);
    expect(component.userStats()).toEqual(userStats);
  });

  it('setStatsPeriodFrom()/setStatsPeriodTo() mettent à jour la période utilisée pour charger les stats', async () => {
    await component.reload();
    statsService.columnDurations.mockClear();
    statsService.userStats.mockClear();

    component.setStatsPeriodFrom('2026-01-01');
    component.setStatsPeriodTo('2026-01-31');
    expect(component.statsPeriodFrom()).toBe('2026-01-01');
    expect(component.statsPeriodTo()).toBe('2026-01-31');

    // Flush explicitement un rechargement pour vérifier que la période posée ci-dessus est
    // bien celle utilisée (les appels fire-and-forget déclenchés par les setters eux-mêmes
    // ne sont pas attendables depuis le test).
    await component.reloadStats();

    expect(statsService.columnDurations).toHaveBeenLastCalledWith(1, '2026-01-01', '2026-01-31');
    expect(statsService.userStats).toHaveBeenLastCalledWith(1, '2026-01-01', '2026-01-31');
  });

  it('formatDuration() affiche en heures sous 24h, en jours au-delà', () => {
    expect(component.formatDuration(5)).toBe('5.0 h');
    expect(component.formatDuration(48)).toBe('2.0 j');
  });

  it('onTimeRateLabel() calcule le pourcentage de tickets dans les temps, ou "—" sans échéance', () => {
    expect(component.onTimeRateLabel(userStats[0])).toBe('50 %');
    expect(component.onTimeRateLabel({ ...userStats[0], with_due_date_count: 0 })).toBe('—');
  });

  it('leadLabel() affiche "avance" ou "retard", ou "—" sans donnée', () => {
    expect(component.leadLabel({ ...userStats[0], avg_lead_days: 2 })).toBe('+2 j (avance)');
    expect(component.leadLabel({ ...userStats[0], avg_lead_days: -2 })).toBe('-2 j (retard)');
    expect(component.leadLabel({ ...userStats[0], avg_lead_days: null })).toBe('—');
  });
});

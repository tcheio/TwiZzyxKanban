import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BoardSettings } from './board-settings';
import { ColumnsService } from '../../../services/columns.service';
import { TagsService } from '../../../services/tags.service';
import { EpicsService } from '../../../services/epics.service';
import { Tag } from '../../../models/tag.model';
import { Epic } from '../../../models/epic.model';
import { Column } from '../../../models/column.model';

describe('BoardSettings', () => {
  let component: BoardSettings;
  let columnsService: {
    list: ReturnType<typeof vi.fn>;
    setRestricted: ReturnType<typeof vi.fn>;
    setStates: ReturnType<typeof vi.fn>;
  };
  let tagsService: { list: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  let epicsService: { list: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };

  const columns: Column[] = [{ id: 1, name: '💡Idées', position: 0, restricted: true }];
  const tags: Tag[] = [{ id: 1, name: 'Minecraft', color: 'emerald', emote_url: null, visible_in_filter: true }];
  const epics: Epic[] = [{ id: 1, name: 'Saison 2', color: 'red', emote_url: null, visible_in_filter: false }];

  beforeEach(() => {
    columnsService = {
      list: vi.fn().mockResolvedValue(columns),
      setRestricted: vi.fn().mockResolvedValue({}),
      setStates: vi.fn().mockResolvedValue({ ...columns[0], state_a_name: 'Derush', state_b_name: 'Montage' }),
    };
    tagsService = {
      list: vi.fn().mockResolvedValue(tags),
      update: vi.fn().mockResolvedValue({}),
    };
    epicsService = {
      list: vi.fn().mockResolvedValue(epics),
      update: vi.fn().mockResolvedValue({}),
    };

    TestBed.configureTestingModule({
      imports: [BoardSettings],
      providers: [
        { provide: ColumnsService, useValue: columnsService },
        { provide: TagsService, useValue: tagsService },
        { provide: EpicsService, useValue: epicsService },
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

  it('updateColumnStates() persiste les 2 noms et met à jour la colonne', async () => {
    await component.reload();
    await component.updateColumnStates(columns[0], 'Derush', 'Montage');

    expect(columnsService.setStates).toHaveBeenCalledWith(1, 1, 'Derush', 'Montage');
    expect(component.columns()[0].state_a_name).toBe('Derush');
    expect(component.columns()[0].state_b_name).toBe('Montage');
  });

  it("updateColumnStates() avec les 2 noms vides retire la division d'une colonne déjà divisée", async () => {
    const splitColumn: Column = { id: 2, name: '🎬Montage', position: 1, state_a_name: 'Derush', state_b_name: 'Montage' };
    columnsService.list.mockResolvedValue([...columns, splitColumn]);
    await component.reload();

    await component.updateColumnStates(splitColumn, '', '');

    expect(columnsService.setStates).toHaveBeenCalledWith(1, 2, null, null);
  });

  it("updateColumnStates() refuse un seul des 2 noms renseigné", async () => {
    await component.reload();
    await component.updateColumnStates(columns[0], 'Derush', '');

    expect(columnsService.setStates).not.toHaveBeenCalled();
    expect(component.error()).toBeTruthy();
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
});

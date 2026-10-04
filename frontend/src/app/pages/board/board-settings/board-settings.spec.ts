import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BoardSettings } from './board-settings';
import { ColumnsService } from '../../../services/columns.service';
import { TagsService } from '../../../services/tags.service';
import { EpicsService } from '../../../services/epics.service';
import { Tag } from '../../../models/tag.model';
import { Epic } from '../../../models/epic.model';

describe('BoardSettings', () => {
  let component: BoardSettings;
  let tagsService: { list: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  let epicsService: { list: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };

  const tags: Tag[] = [{ id: 1, name: 'Minecraft', color: 'emerald', emote_url: null, visible_in_filter: true }];
  const epics: Epic[] = [{ id: 1, name: 'Saison 2', color: 'red', emote_url: null, visible_in_filter: false }];

  beforeEach(() => {
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
        { provide: ColumnsService, useValue: { list: vi.fn().mockResolvedValue([]) } },
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
    expect(component.tags()).toEqual(tags);
    expect(component.epics()).toEqual(epics);
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

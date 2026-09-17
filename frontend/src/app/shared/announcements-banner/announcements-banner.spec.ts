import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnnouncementsBanner } from './announcements-banner';
import { AnnouncementsService } from '../../services/announcements.service';
import { Announcement } from '../../models/announcement.model';

function makeAnnouncement(overrides: Partial<Announcement>): Announcement {
  return {
    id: 1,
    kanban_id: null,
    kanban_name: null,
    kanban_code: null,
    message: 'Message',
    created_by_user_id: 1,
    created_at: '2026-01-01 10:00:00',
    updated_at: '2026-01-01 10:00:00',
    ...overrides,
  };
}

describe('AnnouncementsBanner', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<AnnouncementsBanner>>;
  let component: AnnouncementsBanner;
  let announcementsService: { list: ReturnType<typeof vi.fn> };

  const announcements: Announcement[] = [
    makeAnnouncement({ id: 1, message: 'Globale' }),
    makeAnnouncement({ id: 2, message: 'Pour A', kanban_id: 5 }),
    makeAnnouncement({ id: 3, message: 'Pour B', kanban_id: 6 }),
  ];

  beforeEach(() => {
    announcementsService = { list: vi.fn().mockResolvedValue(announcements) };

    TestBed.configureTestingModule({
      imports: [AnnouncementsBanner],
      providers: [{ provide: AnnouncementsService, useValue: announcementsService }],
    });
    fixture = TestBed.createComponent(AnnouncementsBanner);
    component = fixture.componentInstance;
  });

  it('affiche les annonces globales, hors kanban', async () => {
    component.kanbanId = null;
    await component.ngOnInit();
    expect(component.visibleAnnouncements().map((a) => a.message)).toEqual(['Globale']);
  });

  it("affiche les annonces globales et celles du kanban courant, pas celles d'un autre kanban", async () => {
    component.kanbanId = 5;
    await component.ngOnInit();
    expect(component.visibleAnnouncements().map((a) => a.message)).toEqual(['Globale', 'Pour A']);
  });

  it('dismiss() masque une annonce sans affecter les autres', async () => {
    component.kanbanId = 5;
    await component.ngOnInit();

    component.dismiss(1);

    expect(component.visibleAnnouncements().map((a) => a.message)).toEqual(['Pour A']);
  });
});

import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminAnnouncements } from './admin-announcements';
import { AnnouncementsService } from '../../services/announcements.service';
import { KanbansService } from '../../services/kanbans.service';
import { Announcement } from '../../models/announcement.model';

describe('AdminAnnouncements', () => {
  let component: AdminAnnouncements;
  let announcementsService: {
    list: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let kanbansService: { list: ReturnType<typeof vi.fn> };

  const kanbans = [{ id: 5, name: 'Kanban A', code: 'TK-A', is_moderator: true }];
  const baseAnnouncements: Announcement[] = [
    {
      id: 1,
      kanban_id: null,
      kanban_name: null,
      kanban_code: null,
      message: 'Globale',
      created_by_user_id: 1,
      created_at: '2026-01-01 10:00:00',
      updated_at: '2026-01-01 10:00:00',
    },
    {
      id: 2,
      kanban_id: 5,
      kanban_name: 'Kanban A',
      kanban_code: 'TK-A',
      message: 'Pour A',
      created_by_user_id: 1,
      created_at: '2026-01-01 10:00:00',
      updated_at: '2026-01-01 10:00:00',
    },
  ];

  beforeEach(() => {
    announcementsService = {
      list: vi.fn().mockResolvedValue(baseAnnouncements),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      remove: vi.fn().mockResolvedValue(undefined),
    };
    kanbansService = { list: vi.fn().mockResolvedValue(kanbans) };

    TestBed.configureTestingModule({
      imports: [AdminAnnouncements],
      providers: [
        { provide: AnnouncementsService, useValue: announcementsService },
        { provide: KanbansService, useValue: kanbansService },
      ],
    });
    component = TestBed.createComponent(AdminAnnouncements).componentInstance;
  });

  it('reload() charge les annonces et les kanbans', async () => {
    await component.reload();
    expect(component.announcements()).toEqual(baseAnnouncements);
    expect(component.kanbans()).toEqual(kanbans);
  });

  it("scopeLabel() affiche \"Toute l'application\" ou le nom du kanban", async () => {
    await component.reload();
    expect(component.scopeLabel(baseAnnouncements[0])).toBe("Toute l'application");
    expect(component.scopeLabel(baseAnnouncements[1])).toBe('Kanban A');
  });

  it('createAnnouncement() envoie kanban_id=null pour la portée globale', async () => {
    component.createForm.setValue({ message: 'Maintenance prévue', kanbanId: '' });

    await component.createAnnouncement();

    expect(announcementsService.create).toHaveBeenCalledWith('Maintenance prévue', null);
    expect(component.creating()).toBe(false);
  });

  it('createAnnouncement() convertit kanbanId en nombre pour une portée précise', async () => {
    component.createForm.setValue({ message: 'Ce kanban ferme', kanbanId: '5' });

    await component.createAnnouncement();

    expect(announcementsService.create).toHaveBeenCalledWith('Ce kanban ferme', 5);
  });

  it('createAnnouncement() ne fait rien si le message est vide', async () => {
    component.createForm.setValue({ message: '', kanbanId: '' });

    await component.createAnnouncement();

    expect(announcementsService.create).not.toHaveBeenCalled();
  });

  it("startEdit()/cancelEdit() pilotent le mode édition", () => {
    component.startEdit(baseAnnouncements[1]);
    expect(component.editingId()).toBe(2);
    expect(component.editForm.value.message).toBe('Pour A');
    expect(component.editForm.value.kanbanId).toBe('5');

    component.cancelEdit();
    expect(component.editingId()).toBeNull();
  });

  it('saveEdit() met à jour le message et la portée', async () => {
    component.startEdit(baseAnnouncements[1]);
    component.editForm.patchValue({ message: 'Modifiée', kanbanId: '' });

    await component.saveEdit(baseAnnouncements[1]);

    expect(announcementsService.update).toHaveBeenCalledWith(2, { message: 'Modifiée', kanban_id: null });
    expect(component.editingId()).toBeNull();
  });

  it('deleteAnnouncement() supprime après confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    await component.deleteAnnouncement(baseAnnouncements[0]);

    expect(announcementsService.remove).toHaveBeenCalledWith(1);
  });

  it("deleteAnnouncement() n'appelle pas remove() si annulé", async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    await component.deleteAnnouncement(baseAnnouncements[0]);

    expect(announcementsService.remove).not.toHaveBeenCalled();
  });
});

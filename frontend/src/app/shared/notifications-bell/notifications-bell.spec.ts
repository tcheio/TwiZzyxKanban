import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotificationsBell } from './notifications-bell';
import { NotificationsService } from '../../services/notifications.service';
import { AppNotification } from '../../models/notification.model';

describe('NotificationsBell', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<NotificationsBell>>;
  let component: NotificationsBell;
  let notificationsService: {
    list: ReturnType<typeof vi.fn>;
    markRead: ReturnType<typeof vi.fn>;
    markAllRead: ReturnType<typeof vi.fn>;
  };
  let navigate: ReturnType<typeof vi.fn>;

  const notifications: AppNotification[] = [
    {
      id: 1,
      user_id: 1,
      kanban_id: 1,
      card_id: 5,
      card_title: 'Vidéo A',
      kanban_code: 'TK-TEST',
      actor_user_id: 2,
      type: 'comment',
      message: 'bob a commenté le ticket « Vidéo A »',
      read_at: null,
      created_at: '2026-01-01 10:00:00',
    },
    {
      id: 2,
      user_id: 1,
      kanban_id: 1,
      card_id: 6,
      card_title: 'Vidéo B',
      kanban_code: 'TK-TEST',
      actor_user_id: 2,
      type: 'status',
      message: 'bob a déplacé le ticket « Vidéo B »',
      read_at: '2026-01-01 09:00:00',
      created_at: '2026-01-01 09:00:00',
    },
  ];

  beforeEach(() => {
    notificationsService = {
      list: vi.fn().mockResolvedValue(notifications),
      markRead: vi.fn().mockResolvedValue(undefined),
      markAllRead: vi.fn().mockResolvedValue(undefined),
    };
    navigate = vi.fn();

    TestBed.configureTestingModule({
      imports: [NotificationsBell],
      providers: [
        { provide: NotificationsService, useValue: notificationsService },
        { provide: Router, useValue: { navigate } },
      ],
    });
    fixture = TestBed.createComponent(NotificationsBell);
    component = fixture.componentInstance;
  });

  it("charge les notifications à l'initialisation", async () => {
    await component.ngOnInit();
    expect(component.notifications()).toEqual(notifications);
  });

  it('unreadCount() compte les notifications non lues', async () => {
    await component.ngOnInit();
    expect(component.unreadCount()).toBe(1);
  });

  it('select() marque comme lue si nécessaire, navigue et ferme le panneau', async () => {
    await component.ngOnInit();
    component.toggle();

    await component.select(notifications[0]);

    expect(notificationsService.markRead).toHaveBeenCalledWith(1);
    expect(component.notifications().find((n) => n.id === 1)?.read_at).toBeTruthy();
    expect(navigate).toHaveBeenCalledWith(['/kanbans', 'TK-TEST-5']);
    expect(component.open()).toBe(false);
  });

  it('select() sur une notification déjà lue ne rappelle pas markRead()', async () => {
    await component.ngOnInit();

    await component.select(notifications[1]);

    expect(notificationsService.markRead).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/kanbans', 'TK-TEST-6']);
  });

  it('markAllRead() marque tout comme lu localement puis appelle le service', async () => {
    await component.ngOnInit();

    await component.markAllRead(new MouseEvent('click'));

    expect(component.unreadCount()).toBe(0);
    expect(notificationsService.markAllRead).toHaveBeenCalled();
  });

  it('toggle() ouvre puis referme le panneau', () => {
    component.toggle();
    expect(component.open()).toBe(true);
    component.toggle();
    expect(component.open()).toBe(false);
  });
});

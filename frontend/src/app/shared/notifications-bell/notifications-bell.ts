import { Component, DestroyRef, ElementRef, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NotificationsService } from '../../services/notifications.service';
import { AppNotification } from '../../models/notification.model';
import { startAutoRefresh } from '../auto-refresh';

const NOTIFICATIONS_POLL_INTERVAL_MS = 30000;

@Component({
  selector: 'app-notifications-bell',
  imports: [],
  templateUrl: './notifications-bell.html',
})
export class NotificationsBell implements OnInit {
  private readonly notificationsService = inject(NotificationsService);
  private readonly router = inject(Router);
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);

  readonly notifications = signal<AppNotification[]>([]);
  readonly open = signal(false);
  readonly unreadCount = computed(() => this.notifications().filter((n) => !n.read_at).length);

  async ngOnInit(): Promise<void> {
    await this.reload();
    startAutoRefresh(this.destroyRef, () => this.reload(), NOTIFICATIONS_POLL_INTERVAL_MS);
  }

  async reload(): Promise<void> {
    try {
      this.notifications.set(await this.notificationsService.list());
    } catch {
      // Silencieux : une notif ratée n'a pas besoin d'interrompre l'utilisateur.
    }
  }

  toggle(): void {
    this.open.update((o) => !o);
  }

  async select(notification: AppNotification): Promise<void> {
    this.open.set(false);
    if (!notification.read_at) {
      this.notifications.update((list) =>
        list.map((n) => (n.id === notification.id ? { ...n, read_at: new Date().toISOString() } : n))
      );
      this.notificationsService.markRead(notification.id).catch(() => this.reload());
    }
    this.router.navigate(['/kanbans', `${notification.kanban_code}-${notification.card_id}`]);
  }

  async markAllRead(event: MouseEvent): Promise<void> {
    event.stopPropagation();
    this.notifications.update((list) => list.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    try {
      await this.notificationsService.markAllRead();
    } catch {
      await this.reload();
    }
  }

  formatTime(dateStr: string): string {
    const [datePart, timePart] = dateStr.split(' ');
    const [year, month, day] = datePart.split('-');
    const time = timePart ? timePart.slice(0, 5) : '';
    return time ? `${day}/${month} à ${time}` : `${day}/${month}`;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.elementRef.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.open.set(false);
  }
}

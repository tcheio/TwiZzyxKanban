import { Component, DestroyRef, Input, OnInit, inject, signal } from '@angular/core';
import { AnnouncementsService } from '../../services/announcements.service';
import { Announcement } from '../../models/announcement.model';
import { startAutoRefresh } from '../auto-refresh';

const ANNOUNCEMENTS_POLL_INTERVAL_MS = 60000;

@Component({
  selector: 'app-announcements-banner',
  imports: [],
  templateUrl: './announcements-banner.html',
})
export class AnnouncementsBanner implements OnInit {
  private readonly announcementsService = inject(AnnouncementsService);
  private readonly destroyRef = inject(DestroyRef);

  // Kanban actuellement ouvert (ou null hors d'un kanban) : détermine quelles annonces
  // scopées à un kanban s'affichent, en plus des annonces globales qui s'affichent
  // toujours. Fourni par le composant racine, qui connaît déjà ce contexte.
  @Input() kanbanId: number | null = null;

  readonly announcements = signal<Announcement[]>([]);
  private readonly dismissedIds = signal<Set<number>>(new Set());

  async ngOnInit(): Promise<void> {
    await this.reload();
    startAutoRefresh(this.destroyRef, () => this.reload(), ANNOUNCEMENTS_POLL_INTERVAL_MS);
  }

  async reload(): Promise<void> {
    try {
      this.announcements.set(await this.announcementsService.list());
    } catch {
      // Silencieux : une annonce ratée n'a pas besoin d'interrompre l'utilisateur.
    }
  }

  visibleAnnouncements(): Announcement[] {
    const dismissed = this.dismissedIds();
    return this.announcements().filter(
      (a) => (a.kanban_id === null || a.kanban_id === this.kanbanId) && !dismissed.has(a.id)
    );
  }

  dismiss(id: number): void {
    this.dismissedIds.update((set) => new Set(set).add(id));
  }
}

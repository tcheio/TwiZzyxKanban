import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AnnouncementsService } from '../../services/announcements.service';
import { KanbansService } from '../../services/kanbans.service';
import { Announcement } from '../../models/announcement.model';
import { Kanban } from '../../models/kanban.model';

// Une valeur de <select> ne peut pas être `null` nativement : on utilise la chaîne vide
// pour représenter "Toute l'application" et on convertit vers/depuis `null` à la frontière.
const GLOBAL_SCOPE_VALUE = '';

@Component({
  selector: 'app-admin-announcements',
  imports: [ReactiveFormsModule],
  templateUrl: './admin-announcements.html',
})
export class AdminAnnouncements implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly announcementsService = inject(AnnouncementsService);
  private readonly kanbansService = inject(KanbansService);

  readonly announcements = signal<Announcement[]>([]);
  readonly kanbans = signal<Kanban[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly creating = signal(false);
  readonly editingId = signal<number | null>(null);

  readonly createForm = this.fb.group({
    message: ['', Validators.required],
    kanbanId: [GLOBAL_SCOPE_VALUE],
  });

  readonly editForm = this.fb.group({
    message: ['', Validators.required],
    kanbanId: [GLOBAL_SCOPE_VALUE],
  });

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [announcements, kanbans] = await Promise.all([this.announcementsService.list(), this.kanbansService.list()]);
      this.announcements.set(announcements);
      this.kanbans.set(kanbans);
    } catch {
      this.error.set('Impossible de charger les annonces.');
    } finally {
      this.loading.set(false);
    }
  }

  scopeLabel(announcement: Announcement): string {
    return announcement.kanban_id === null ? 'Toute l\'application' : (announcement.kanban_name ?? '—');
  }

  async createAnnouncement(): Promise<void> {
    if (this.createForm.invalid) return;
    const raw = this.createForm.getRawValue();
    try {
      await this.announcementsService.create(raw.message!.trim(), raw.kanbanId ? Number(raw.kanbanId) : null);
      this.createForm.reset({ message: '', kanbanId: GLOBAL_SCOPE_VALUE });
      this.creating.set(false);
      await this.reload();
    } catch (err: any) {
      this.error.set(err?.error?.error ?? "Échec de la création de l'annonce.");
    }
  }

  startEdit(announcement: Announcement): void {
    this.editingId.set(announcement.id);
    this.editForm.reset({
      message: announcement.message,
      kanbanId: announcement.kanban_id === null ? GLOBAL_SCOPE_VALUE : String(announcement.kanban_id),
    });
  }

  cancelEdit(): void {
    this.editingId.set(null);
  }

  async saveEdit(announcement: Announcement): Promise<void> {
    if (this.editForm.invalid) return;
    const raw = this.editForm.getRawValue();
    try {
      await this.announcementsService.update(announcement.id, {
        message: raw.message!.trim(),
        kanban_id: raw.kanbanId ? Number(raw.kanbanId) : null,
      });
      this.editingId.set(null);
      await this.reload();
    } catch (err: any) {
      this.error.set(err?.error?.error ?? "Échec de la modification de l'annonce.");
    }
  }

  async deleteAnnouncement(announcement: Announcement): Promise<void> {
    if (!confirm('Supprimer cette annonce ?')) return;
    try {
      await this.announcementsService.remove(announcement.id);
      await this.reload();
    } catch (err: any) {
      this.error.set(err?.error?.error ?? "Échec de la suppression de l'annonce.");
    }
  }
}

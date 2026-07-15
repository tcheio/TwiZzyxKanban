import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { KanbansService } from '../../../services/kanbans.service';
import { AuthService } from '../../../core/auth.service';
import { Kanban, KanbanTemplate } from '../../../models/kanban.model';

@Component({
  selector: 'app-kanbans-list',
  imports: [FormsModule],
  templateUrl: './kanbans-list.html',
})
export class KanbansList implements OnInit {
  private readonly kanbansService = inject(KanbansService);
  private readonly router = inject(Router);
  protected readonly authService = inject(AuthService);

  readonly kanbans = signal<Kanban[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly creating = signal(false);

  readonly newName = signal('');
  readonly newCode = signal('');
  readonly newTemplate = signal<KanbanTemplate>('video');

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.kanbans.set(await this.kanbansService.list());
    } catch {
      this.error.set('Impossible de charger les kanbans.');
    } finally {
      this.loading.set(false);
    }
  }

  openKanban(kanban: Kanban): void {
    this.router.navigate(['/kanbans', kanban.id]);
  }

  async createKanban(): Promise<void> {
    if (!this.newName().trim() || !this.newCode().trim()) return;
    this.error.set(null);
    try {
      const kanban = await this.kanbansService.create({
        name: this.newName().trim(),
        code: this.newCode().trim(),
        template: this.newTemplate(),
      });
      this.creating.set(false);
      this.newName.set('');
      this.newCode.set('');
      this.newTemplate.set('video');
      this.router.navigate(['/kanbans', kanban.id]);
    } catch (err: unknown) {
      const message = (err as { error?: { error?: string } })?.error?.error;
      this.error.set(message ?? 'Échec de la création du kanban.');
    }
  }
}

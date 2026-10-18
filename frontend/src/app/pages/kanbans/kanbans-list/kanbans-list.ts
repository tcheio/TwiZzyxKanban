import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { KanbansService } from '../../../services/board/kanbans.service';
import { MeService } from '../../../services/tickets/me.service';
import { AuthService } from '../../../core/auth.service';
import { Kanban, KanbanTemplate } from '../../../models/kanban.model';
import { MyTicket } from '../../../models/my-ticket.model';
import { priorityLabel, priorityDotClass } from '../../../shared/priority';
import { dueDateLabel, dueDateClass, formatDate } from '../../../shared/due-date';

@Component({
  selector: 'app-kanbans-list',
  imports: [FormsModule],
  templateUrl: './kanbans-list.html',
})
export class KanbansList implements OnInit {
  private readonly kanbansService = inject(KanbansService);
  private readonly meService = inject(MeService);
  private readonly router = inject(Router);
  protected readonly authService = inject(AuthService);

  readonly kanbans = signal<Kanban[]>([]);
  readonly myTickets = signal<MyTicket[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly creating = signal(false);

  readonly newName = signal('');
  readonly newCode = signal('');
  readonly newTemplate = signal<KanbanTemplate>('video');

  readonly priorityLabel = priorityLabel;
  readonly priorityDotClass = priorityDotClass;
  readonly dueDateLabel = dueDateLabel;
  readonly dueDateClass = dueDateClass;
  readonly formatDate = formatDate;

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [kanbans, myTickets] = await Promise.all([this.kanbansService.list(), this.meService.tickets()]);
      this.kanbans.set(kanbans);
      this.myTickets.set(myTickets);
    } catch {
      this.error.set('Impossible de charger les kanbans.');
    } finally {
      this.loading.set(false);
    }
  }

  openKanban(kanban: Kanban): void {
    this.router.navigate(['/kanbans', kanban.code]);
  }

  openTicket(ticket: MyTicket): void {
    this.router.navigate(['/kanbans', ticket.key]);
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
      this.router.navigate(['/kanbans', kanban.code]);
    } catch (err: unknown) {
      const message = (err as { error?: { error?: string } })?.error?.error;
      this.error.set(message ?? 'Échec de la création du kanban.');
    }
  }
}

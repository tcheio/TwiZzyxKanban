import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { EpicsService } from '../../../services/epics.service';
import { CardsService } from '../../../services/cards.service';
import { AuthService } from '../../../core/auth.service';
import { Epic } from '../../../models/epic.model';
import { Card } from '../../../models/card.model';
import { Kanban } from '../../../models/kanban.model';
import { EPIC_COLORS, epicDotClass } from '../../../shared/epic-colors';

@Component({
  selector: 'app-epics-list',
  imports: [FormsModule],
  templateUrl: './epics-list.html',
})
export class EpicsList implements OnInit {
  private readonly epicsService = inject(EpicsService);
  private readonly cardsService = inject(CardsService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly authService = inject(AuthService);
  private readonly kanban = this.route.snapshot.data['kanban'] as Kanban;
  private readonly kanbanId = this.kanban.id;

  readonly epicColors = EPIC_COLORS;
  readonly epicDotClass = epicDotClass;

  readonly epics = signal<Epic[]>([]);
  readonly cards = signal<Card[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly creating = signal(false);
  readonly newEpicName = signal('');
  readonly newEpicColor = signal(EPIC_COLORS[0]);

  readonly editingId = signal<number | null>(null);
  readonly editName = signal('');
  readonly editColor = signal('');

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [epics, cards] = await Promise.all([
        this.epicsService.list(this.kanbanId),
        this.cardsService.list(this.kanbanId),
      ]);
      this.epics.set(epics);
      this.cards.set(cards);
    } catch {
      this.error.set('Impossible de charger les EPICs.');
    } finally {
      this.loading.set(false);
    }
  }

  ticketCount(epicId: number): number {
    return this.cards().filter((c) => c.epic_id === epicId).length;
  }

  openEpic(epic: Epic): void {
    this.router.navigate(['/kanbans', this.kanban.code, 'epics', epic.id]);
  }

  async createEpic(): Promise<void> {
    const name = this.newEpicName().trim();
    if (!name) return;
    try {
      await this.epicsService.create(this.kanbanId, name, this.newEpicColor());
      this.newEpicName.set('');
      this.newEpicColor.set(EPIC_COLORS[0]);
      this.creating.set(false);
      await this.reload();
    } catch {
      this.error.set("Échec de la création de l'EPIC.");
    }
  }

  startEdit(epic: Epic): void {
    this.editingId.set(epic.id);
    this.editName.set(epic.name);
    this.editColor.set(epic.color);
  }

  cancelEdit(): void {
    this.editingId.set(null);
  }

  async saveEdit(epic: Epic): Promise<void> {
    const trimmed = this.editName().trim();
    const color = this.editColor();
    this.editingId.set(null);
    if (!trimmed || (trimmed === epic.name && color === epic.color)) return;
    try {
      await this.epicsService.update(this.kanbanId, epic.id, { name: trimmed, color });
      await this.reload();
    } catch {
      this.error.set("Échec de la modification de l'EPIC.");
    }
  }

  async deleteEpic(epic: Epic): Promise<void> {
    if (!confirm(`Supprimer l'EPIC "${epic.name}" ?`)) return;
    try {
      await this.epicsService.remove(this.kanbanId, epic.id);
      await this.reload();
    } catch {
      this.error.set("Échec de la suppression de l'EPIC.");
    }
  }
}

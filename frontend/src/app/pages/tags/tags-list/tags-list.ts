import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TagsService } from '../../../services/tags.service';
import { CardsService } from '../../../services/cards.service';
import { AuthService } from '../../../core/auth.service';
import { Tag } from '../../../models/tag.model';
import { Card } from '../../../models/card.model';
import { Kanban } from '../../../models/kanban.model';
import { TAG_COLORS, tagBadgeClass, tagDotClass } from '../../../shared/tag-colors';

@Component({
  selector: 'app-tags-list',
  imports: [FormsModule],
  templateUrl: './tags-list.html',
})
export class TagsList implements OnInit {
  private readonly tagsService = inject(TagsService);
  private readonly cardsService = inject(CardsService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly authService = inject(AuthService);
  private readonly kanban = this.route.snapshot.data['kanban'] as Kanban;
  private readonly kanbanId = this.kanban.id;

  readonly tagColors = TAG_COLORS;
  readonly tagDotClass = tagDotClass;

  readonly tags = signal<Tag[]>([]);
  readonly cards = signal<Card[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly creating = signal(false);
  readonly newTagName = signal('');
  readonly newTagColor = signal(TAG_COLORS[0]);

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
      const [tags, cards] = await Promise.all([
        this.tagsService.list(this.kanbanId),
        this.cardsService.list(this.kanbanId),
      ]);
      this.tags.set(tags);
      this.cards.set(cards);
    } catch {
      this.error.set('Impossible de charger les tags.');
    } finally {
      this.loading.set(false);
    }
  }

  ticketCount(tagId: number): number {
    return this.cards().filter((c) => c.tag_id === tagId).length;
  }

  tagClass(tag: Tag): string {
    return tagBadgeClass(tag.color);
  }

  openTag(tag: Tag): void {
    this.router.navigate(['/kanbans', this.kanban.code, 'tags', tag.id]);
  }

  async createTag(): Promise<void> {
    const name = this.newTagName().trim();
    if (!name) return;
    try {
      await this.tagsService.create(this.kanbanId, name, this.newTagColor());
      this.newTagName.set('');
      this.newTagColor.set(TAG_COLORS[0]);
      this.creating.set(false);
      await this.reload();
    } catch {
      this.error.set('Échec de la création du tag.');
    }
  }

  startEdit(tag: Tag): void {
    this.editingId.set(tag.id);
    this.editName.set(tag.name);
    this.editColor.set(tag.color);
  }

  cancelEdit(): void {
    this.editingId.set(null);
  }

  async saveEdit(tag: Tag): Promise<void> {
    const trimmed = this.editName().trim();
    const color = this.editColor();
    this.editingId.set(null);
    if (!trimmed || (trimmed === tag.name && color === tag.color)) return;
    try {
      await this.tagsService.update(this.kanbanId, tag.id, { name: trimmed, color });
      await this.reload();
    } catch {
      this.error.set('Échec du renommage du tag.');
    }
  }

  async deleteTag(tag: Tag): Promise<void> {
    if (!confirm(`Supprimer le tag "${tag.name}" ?`)) return;
    try {
      await this.tagsService.remove(this.kanbanId, tag.id);
      await this.reload();
    } catch {
      this.error.set('Échec de la suppression du tag.');
    }
  }
}

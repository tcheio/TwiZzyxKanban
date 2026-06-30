import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CardsService } from '../../../services/cards.service';
import { ColumnsService } from '../../../services/columns.service';
import { UsersService } from '../../../services/users.service';
import { CommentsService } from '../../../services/comments.service';
import { TagsService } from '../../../services/tags.service';
import { AuthService } from '../../../core/auth.service';
import { Card, Priority } from '../../../models/card.model';
import { Column } from '../../../models/column.model';
import { UserLite } from '../../../models/user.model';
import { Comment } from '../../../models/comment.model';
import { Tag } from '../../../models/tag.model';

@Component({
  selector: 'app-ticket-detail',
  imports: [RouterLink, FormsModule],
  templateUrl: './ticket-detail.html',
  styleUrl: './ticket-detail.css',
})
export class TicketDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cardsService = inject(CardsService);
  private columnsService = inject(ColumnsService);
  private usersService = inject(UsersService);
  private commentsService = inject(CommentsService);
  private tagsService = inject(TagsService);
  protected authService = inject(AuthService);

  readonly ticket = signal<Card | null>(null);
  readonly columns = signal<Column[]>([]);
  readonly users = signal<UserLite[]>([]);
  readonly tags = signal<Tag[]>([]);
  readonly comments = signal<Comment[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly descriptionDraft = signal('');
  readonly newComment = signal('');

  protected get ticketId(): number {
    return Number(this.route.snapshot.paramMap.get('id'));
  }

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [ticket, columns, users, tags, comments] = await Promise.all([
        this.cardsService.get(this.ticketId),
        this.columnsService.list(),
        this.usersService.lite(),
        this.tagsService.list(),
        this.commentsService.list(this.ticketId),
      ]);
      this.ticket.set(ticket);
      this.columns.set(columns);
      this.users.set(users);
      this.tags.set(tags);
      this.comments.set(comments);
      this.descriptionDraft.set(ticket.description ?? '');
    } catch {
      this.error.set('Ticket introuvable.');
    } finally {
      this.loading.set(false);
    }
  }

  userName(id: number | null): string {
    if (!id) return '—';
    return this.users().find((u) => u.id === id)?.username ?? '—';
  }

  private async patch(partial: {
    title?: string;
    channel?: string | null;
    assigned_user_id?: number | null;
    priority?: Priority;
    description?: string | null;
    tag_id?: number | null;
  }): Promise<void> {
    const ticket = this.ticket();
    if (!ticket) return;
    try {
      const updated = await this.cardsService.update(ticket.id, partial);
      this.ticket.set(updated);
    } catch {
      this.error.set("Échec de l'enregistrement.");
    }
  }

  updateTitle(value: string): void {
    if (!value.trim()) return;
    this.patch({ title: value.trim() });
  }

  updateChannel(value: string): void {
    this.patch({ channel: value || null });
  }

  updatePriority(value: Priority): void {
    this.patch({ priority: value });
  }

  updateAssignee(userId: number | null): void {
    this.patch({ assigned_user_id: userId });
  }

  updateTag(tagId: number | null): void {
    this.patch({ tag_id: tagId });
  }

  async updateStatus(columnId: number): Promise<void> {
    const ticket = this.ticket();
    if (!ticket || columnId === ticket.column_id) return;
    try {
      const moved = await this.cardsService.move(ticket.id, columnId);
      this.ticket.set(moved);
    } catch {
      this.error.set('Échec du changement de statut.');
    }
  }

  saveDescription(): void {
    this.patch({ description: this.descriptionDraft() || null });
  }

  async addComment(): Promise<void> {
    const body = this.newComment().trim();
    if (!body) return;
    try {
      await this.commentsService.create(this.ticketId, body);
      this.newComment.set('');
      this.comments.set(await this.commentsService.list(this.ticketId));
    } catch {
      this.error.set("Échec de l'ajout du commentaire.");
    }
  }

  canDeleteComment(comment: Comment): boolean {
    const user = this.authService.currentUser();
    if (!user) return false;
    return user.role === 'admin' || user.id === comment.user_id;
  }

  async deleteComment(comment: Comment): Promise<void> {
    if (!confirm('Supprimer ce commentaire ?')) return;
    try {
      await this.commentsService.remove(this.ticketId, comment.id);
      this.comments.set(await this.commentsService.list(this.ticketId));
    } catch {
      this.error.set('Échec de la suppression du commentaire.');
    }
  }

  async deleteTicket(): Promise<void> {
    const ticket = this.ticket();
    if (!ticket) return;
    if (!confirm(`Supprimer le ticket "${ticket.title}" ?`)) return;
    try {
      await this.cardsService.remove(ticket.id);
      this.router.navigate(['/tickets']);
    } catch {
      this.error.set('Échec de la suppression du ticket.');
    }
  }
}

import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { CardsService } from '../../../services/cards.service';
import { ColumnsService } from '../../../services/columns.service';
import { UsersService } from '../../../services/users.service';
import { CommentsService } from '../../../services/comments.service';
import { TagsService } from '../../../services/tags.service';
import { EpicsService } from '../../../services/epics.service';
import { AuthService } from '../../../core/auth.service';
import { Card, Priority } from '../../../models/card.model';
import { Column } from '../../../models/column.model';
import { UserLite } from '../../../models/user.model';
import { Comment } from '../../../models/comment.model';
import { Tag } from '../../../models/tag.model';
import { Epic } from '../../../models/epic.model';
import { epicBadgeClass, epicDotClass } from '../../../shared/epic-colors';
import { tagBadgeClass } from '../../../shared/tag-colors';
import { SearchSelect, SearchSelectOption } from '../../../shared/search-select/search-select';

const PRIORITY_OPTIONS: SearchSelectOption<Priority>[] = [
  { id: 'low', label: 'Basse', dotClass: 'bg-gray-400' },
  { id: 'medium', label: 'Moyenne', dotClass: 'bg-amber-500' },
  { id: 'high', label: 'Haute', dotClass: 'bg-red-600' },
];

@Component({
  selector: 'app-ticket-detail',
  imports: [RouterLink, FormsModule, SearchSelect],
  templateUrl: './ticket-detail.html',
})
export class TicketDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private titleService = inject(Title);
  private cardsService = inject(CardsService);
  private columnsService = inject(ColumnsService);
  private usersService = inject(UsersService);
  private commentsService = inject(CommentsService);
  private tagsService = inject(TagsService);
  private epicsService = inject(EpicsService);
  protected authService = inject(AuthService);

  readonly ticket = signal<Card | null>(null);
  readonly columns = signal<Column[]>([]);
  readonly users = signal<UserLite[]>([]);
  readonly tags = signal<Tag[]>([]);
  readonly epics = signal<Epic[]>([]);
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
      const [ticket, columns, users, tags, epics, comments] = await Promise.all([
        this.cardsService.get(this.ticketId),
        this.columnsService.list(),
        this.usersService.lite(),
        this.tagsService.list(),
        this.epicsService.list(),
        this.commentsService.list(this.ticketId),
      ]);
      this.ticket.set(ticket);
      this.columns.set(columns);
      this.users.set(users);
      this.tags.set(tags);
      this.epics.set(epics);
      this.comments.set(comments);
      this.descriptionDraft.set(ticket.description ?? '');
      this.titleService.setTitle(`${ticket.title} - TwiZzyxKanban`);
    } catch {
      this.error.set('Ticket introuvable.');
    } finally {
      this.loading.set(false);
    }
  }

  epicName(epicId: number | null): string | null {
    if (!epicId) return null;
    return this.epics().find((e) => e.id === epicId)?.name ?? null;
  }

  epicClass(epicId: number | null): string {
    if (!epicId) return '';
    const color = this.epics().find((e) => e.id === epicId)?.color;
    return epicBadgeClass(color);
  }

  epicDot(epicId: number | null): string {
    if (!epicId) return '';
    const color = this.epics().find((e) => e.id === epicId)?.color;
    return epicDotClass(color);
  }

  assigneeOptions(): SearchSelectOption<number>[] {
    return this.users().map((u) => ({
      id: u.id,
      label: u.username,
      avatarUrl: u.avatar_url ?? null,
      avatarInitial: u.username.charAt(0).toUpperCase(),
    }));
  }

  tagOptions(): SearchSelectOption<number>[] {
    return this.tags().map((t) => ({ id: t.id, label: t.name, badgeClass: tagBadgeClass(t.id) }));
  }

  epicOptions(): SearchSelectOption<number>[] {
    return this.epics().map((e) => ({ id: e.id, label: e.name, badgeClass: epicBadgeClass(e.color) }));
  }

  readonly priorityOptions = PRIORITY_OPTIONS;

  formatDateTime(dateStr: string): string {
    const [datePart, timePart] = dateStr.split(' ');
    if (!datePart) return dateStr;
    const [year, month, day] = datePart.split('-');
    const time = timePart ? timePart.slice(0, 5) : '';
    return time ? `${day}-${month}-${year} à ${time}` : `${day}-${month}-${year}`;
  }

  private async patch(partial: {
    title?: string;
    assigned_user_id?: number | null;
    priority?: Priority;
    description?: string | null;
    tag_id?: number | null;
    epic_id?: number | null;
    due_date?: string | null;
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

  updatePriority(value: Priority | null): void {
    if (!value) return;
    this.patch({ priority: value });
  }

  updateAssignee(userId: number | null): void {
    this.patch({ assigned_user_id: userId });
  }

  updateTag(tagId: number | null): void {
    this.patch({ tag_id: tagId });
  }

  updateEpic(epicId: number | null): void {
    this.patch({ epic_id: epicId });
  }

  updateDueDate(value: string): void {
    this.patch({ due_date: value || null });
  }

  isPublished(): boolean {
    const ticket = this.ticket();
    if (!ticket) return false;
    return this.columns().find((c) => c.id === ticket.column_id)?.name === '✅Publié';
  }

  async updateStatus(columnId: number): Promise<void> {
    const ticket = this.ticket();
    if (!ticket || columnId === ticket.column_id || this.isPublished()) return;
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

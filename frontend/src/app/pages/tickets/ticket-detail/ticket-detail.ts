import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { CardsService } from '../../../services/cards.service';
import { ColumnsService } from '../../../services/columns.service';
import { UsersService } from '../../../services/users.service';
import { CommentsService } from '../../../services/comments.service';
import { CardLinksService } from '../../../services/card-links.service';
import { TagsService } from '../../../services/tags.service';
import { EpicsService } from '../../../services/epics.service';
import { AuthService } from '../../../core/auth.service';
import { Card, CardInput, Priority } from '../../../models/card.model';
import { Column } from '../../../models/column.model';
import { UserLite } from '../../../models/user.model';
import { Comment } from '../../../models/comment.model';
import { CardLink, CardLinkType } from '../../../models/card-link.model';
import { Tag } from '../../../models/tag.model';
import { Epic } from '../../../models/epic.model';
import { epicBadgeClass, epicDotClass } from '../../../shared/epic-colors';
import { tagBadgeClass } from '../../../shared/tag-colors';
import { SearchSelect, SearchSelectOption } from '../../../shared/search-select/search-select';
import { NewTicketDialog } from '../new-ticket-dialog/new-ticket-dialog';

const PRIORITY_OPTIONS: SearchSelectOption<Priority>[] = [
  { id: 'low', label: 'Basse', dotClass: 'bg-gray-400' },
  { id: 'medium', label: 'Moyenne', dotClass: 'bg-amber-500' },
  { id: 'high', label: 'Haute', dotClass: 'bg-red-600' },
];

export interface LinkedTicket {
  linkId: number;
  card: Card;
}

@Component({
  selector: 'app-ticket-detail',
  imports: [RouterLink, FormsModule, SearchSelect, NewTicketDialog],
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
  private cardLinksService = inject(CardLinksService);
  private tagsService = inject(TagsService);
  private epicsService = inject(EpicsService);
  protected authService = inject(AuthService);

  readonly ticket = signal<Card | null>(null);
  readonly columns = signal<Column[]>([]);
  readonly users = signal<UserLite[]>([]);
  readonly tags = signal<Tag[]>([]);
  readonly epics = signal<Epic[]>([]);
  readonly comments = signal<Comment[]>([]);
  readonly links = signal<CardLink[]>([]);
  readonly cards = signal<Card[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly descriptionDraft = signal('');
  readonly newComment = signal('');
  readonly cloneDialogOpen = signal(false);
  readonly newLinkTargetId = signal<number | null>(null);
  readonly newLinkType = signal<CardLinkType>('before');

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
      const [ticket, columns, users, tags, epics, comments, links, cards] = await Promise.all([
        this.cardsService.get(this.ticketId),
        this.columnsService.list(),
        this.usersService.lite(),
        this.tagsService.list(),
        this.epicsService.list(),
        this.commentsService.list(this.ticketId),
        this.cardLinksService.list(this.ticketId),
        this.cardsService.list(),
      ]);
      this.ticket.set(ticket);
      this.columns.set(columns);
      this.users.set(users);
      this.tags.set(tags);
      this.epics.set(epics);
      this.comments.set(comments);
      this.links.set(links);
      this.cards.set(cards);
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

  clonedFrom(): Card | null {
    const ticket = this.ticket();
    if (!ticket?.cloned_from_id) return null;
    return this.cards().find((c) => c.id === ticket.cloned_from_id) ?? null;
  }

  clones(): Card[] {
    const ticket = this.ticket();
    if (!ticket) return [];
    return this.cards().filter((c) => c.cloned_from_id === ticket.id);
  }

  private resolvedLinks(): (LinkedTicket & { effectiveType: CardLinkType })[] {
    const ticket = this.ticket();
    if (!ticket) return [];
    return this.links()
      .map((link) => {
        const isSource = link.card_id === ticket.id;
        const otherId = isSource ? link.linked_card_id : link.card_id;
        const card = this.cards().find((c) => c.id === otherId);
        if (!card) return null;
        // Depuis le ticket qui n'est pas à l'origine du lien, la relation est inversée
        const effectiveType: CardLinkType = isSource ? link.type : link.type === 'before' ? 'after' : 'before';
        return { linkId: link.id, card, effectiveType };
      })
      .filter((entry): entry is LinkedTicket & { effectiveType: CardLinkType } => entry !== null);
  }

  linkedBefore(): LinkedTicket[] {
    return this.resolvedLinks()
      .filter((entry) => entry.effectiveType === 'before')
      .map(({ linkId, card }) => ({ linkId, card }));
  }

  linkedAfter(): LinkedTicket[] {
    return this.resolvedLinks()
      .filter((entry) => entry.effectiveType === 'after')
      .map(({ linkId, card }) => ({ linkId, card }));
  }

  linkTargetOptions(): SearchSelectOption<number>[] {
    const ticket = this.ticket();
    return this.cards()
      .filter((c) => c.id !== ticket?.id)
      .map((c) => ({ id: c.id, label: c.title }));
  }

  async addLink(): Promise<void> {
    const targetId = this.newLinkTargetId();
    if (!targetId) return;
    try {
      await this.cardLinksService.create(this.ticketId, targetId, this.newLinkType());
      this.newLinkTargetId.set(null);
      this.links.set(await this.cardLinksService.list(this.ticketId));
    } catch {
      this.error.set("Échec de l'ajout du lien.");
    }
  }

  async removeLink(linkId: number): Promise<void> {
    if (!confirm('Supprimer ce lien ?')) return;
    try {
      await this.cardLinksService.remove(this.ticketId, linkId);
      this.links.set(await this.cardLinksService.list(this.ticketId));
    } catch {
      this.error.set('Échec de la suppression du lien.');
    }
  }

  cloneInitialValue(): Partial<CardInput> | null {
    const ticket = this.ticket();
    if (!ticket) return null;
    return {
      title: `COPIE - ${ticket.title}`,
      description: ticket.description,
      tag_id: ticket.tag_id,
      epic_id: ticket.epic_id,
      priority: ticket.priority,
      column_id: ticket.column_id,
    };
  }

  async createClone(input: CardInput): Promise<void> {
    try {
      const created = await this.cardsService.create(input);
      this.cloneDialogOpen.set(false);
      this.router.navigate(['/tickets', created.id]);
    } catch {
      this.error.set('Échec de la création du clone.');
    }
  }

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

  statusOptions(): SearchSelectOption<number>[] {
    return this.columns().map((c) => ({ id: c.id, label: c.name }));
  }

  statusTriggerClass(): string {
    const base = 'w-full justify-between rounded-full border px-3 py-1.5 font-semibold';
    return this.isPublished()
      ? `${base} border-gray-200 bg-gray-100 text-gray-500`
      : `${base} border-blue-200 bg-blue-50 text-blue-700`;
  }

  async updateStatus(columnId: number | null): Promise<void> {
    const ticket = this.ticket();
    if (!ticket || columnId === null || columnId === ticket.column_id || this.isPublished()) return;
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

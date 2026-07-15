import { Component, DestroyRef, ElementRef, HostListener, OnInit, ViewChild, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { CardsService } from '../../../services/cards.service';
import { ColumnsService } from '../../../services/columns.service';
import { UsersService } from '../../../services/users.service';
import { CommentsService } from '../../../services/comments.service';
import { CardLinksService } from '../../../services/card-links.service';
import { CardImagesService } from '../../../services/card-images.service';
import { TagsService } from '../../../services/tags.service';
import { EpicsService } from '../../../services/epics.service';
import { AuthService } from '../../../core/auth.service';
import { Card, CardInput, Priority } from '../../../models/card.model';
import { Column } from '../../../models/column.model';
import { UserLite } from '../../../models/user.model';
import { Comment } from '../../../models/comment.model';
import { CardLink, CardLinkType } from '../../../models/card-link.model';
import { CardImage } from '../../../models/card-image.model';
import { Tag } from '../../../models/tag.model';
import { Epic } from '../../../models/epic.model';
import { epicBadgeClass, epicDotClass } from '../../../shared/epic-colors';
import { tagBadgeClass } from '../../../shared/tag-colors';
import { stripCardImageSrc, hydrateCardImages } from '../../../shared/card-image-html';
import { SearchSelect, SearchSelectOption } from '../../../shared/search-select/search-select';
import { NewTicketDialog } from '../new-ticket-dialog/new-ticket-dialog';
import { CANCELLED_STATUS_ID, CANCELLED_STATUS_LABEL, cancelledTitleClass } from '../../../shared/ticket-status';
import { startAutoRefresh } from '../../../shared/auto-refresh';

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
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly titleService = inject(Title);
  private readonly cardsService = inject(CardsService);
  private readonly columnsService = inject(ColumnsService);
  private readonly usersService = inject(UsersService);
  private readonly commentsService = inject(CommentsService);
  private readonly cardLinksService = inject(CardLinksService);
  private readonly cardImagesService = inject(CardImagesService);
  private readonly tagsService = inject(TagsService);
  private readonly epicsService = inject(EpicsService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly authService = inject(AuthService);

  @ViewChild('commentEditor') private commentEditorRef?: ElementRef<HTMLDivElement>;
  @ViewChild('galleryFileInput') private galleryFileInputRef?: ElementRef<HTMLInputElement>;

  readonly ticket = signal<Card | null>(null);
  readonly columns = signal<Column[]>([]);
  readonly users = signal<UserLite[]>([]);
  readonly tags = signal<Tag[]>([]);
  readonly epics = signal<Epic[]>([]);
  readonly comments = signal<Comment[]>([]);
  readonly links = signal<CardLink[]>([]);
  readonly images = signal<CardImage[]>([]);
  readonly cards = signal<Card[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  // descriptionHtml n'est modifié que par reload() (jamais par la saisie) pour que le
  // binding [innerHTML] ne réinitialise pas le curseur à chaque frappe.
  readonly descriptionHtml = signal('');
  readonly descriptionDraftHtml = signal('');
  readonly newCommentDraftHtml = signal('');
  readonly cloneDialogOpen = signal(false);
  readonly newLinkTargetId = signal<number | null>(null);
  readonly newLinkType = signal<CardLinkType>('before');
  readonly viewingImageUrl = signal<string | null>(null);

  protected get kanbanId(): number {
    return Number(this.route.snapshot.paramMap.get('kanbanId'));
  }

  protected get ticketId(): number {
    return Number(this.route.snapshot.paramMap.get('id'));
  }

  async ngOnInit(): Promise<void> {
    await this.reload();
    startAutoRefresh(this.destroyRef, () => this.reload({ silent: true }));
  }

  async reload(options: { silent?: boolean } = {}): Promise<void> {
    if (!options.silent) {
      this.loading.set(true);
    }
    this.error.set(null);
    // En rafraîchissement silencieux, si une description a été modifiée mais pas encore
    // enregistrée, on ne veut pas écraser la saisie de l'utilisateur.
    const hasUnsavedDescription = options.silent && this.descriptionDraftHtml() !== this.descriptionHtml();
    try {
      const [ticket, columns, users, tags, epics, comments, links, images, cards] = await Promise.all([
        this.cardsService.get(this.kanbanId, this.ticketId),
        this.columnsService.list(this.kanbanId),
        this.usersService.liteForKanban(this.kanbanId),
        this.tagsService.list(this.kanbanId),
        this.epicsService.list(this.kanbanId),
        this.commentsService.list(this.kanbanId, this.ticketId),
        this.cardLinksService.list(this.kanbanId, this.ticketId),
        this.cardImagesService.list(this.kanbanId, this.ticketId),
        this.cardsService.list(this.kanbanId),
      ]);
      this.ticket.set(ticket);
      this.columns.set(columns);
      this.users.set(users);
      this.tags.set(tags);
      this.epics.set(epics);
      this.comments.set(comments);
      this.links.set(links);
      this.images.set(images);
      this.cards.set(cards);
      const hydratedDescription = hydrateCardImages(ticket.description ?? '', images);
      this.descriptionHtml.set(hydratedDescription);
      if (!hasUnsavedDescription) {
        this.descriptionDraftHtml.set(hydratedDescription);
      }
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
    return this.tags().map((t) => ({ id: t.id, label: t.name, badgeClass: tagBadgeClass(t.id, t.name) }));
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
        const invertedType: CardLinkType = link.type === 'before' ? 'after' : 'before';
        const effectiveType: CardLinkType = isSource ? link.type : invertedType;
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
      await this.cardLinksService.create(this.kanbanId, this.ticketId, targetId, this.newLinkType());
      this.newLinkTargetId.set(null);
      this.links.set(await this.cardLinksService.list(this.kanbanId, this.ticketId));
    } catch {
      this.error.set("Échec de l'ajout du lien.");
    }
  }

  async removeLink(linkId: number): Promise<void> {
    if (!confirm('Supprimer ce lien ?')) return;
    try {
      await this.cardLinksService.remove(this.kanbanId, this.ticketId, linkId);
      this.links.set(await this.cardLinksService.list(this.kanbanId, this.ticketId));
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
      const created = await this.cardsService.create(this.kanbanId, input);
      this.cloneDialogOpen.set(false);
      this.router.navigate(['/kanbans', `${this.kanbanId}-${created.id}`]);
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
      const updated = await this.cardsService.update(this.kanbanId, ticket.id, partial);
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

  readonly cancelledTitleClass = cancelledTitleClass;

  statusOptions(): SearchSelectOption<number>[] {
    return [
      ...this.columns().map((c) => ({ id: c.id, label: c.name })),
      { id: CANCELLED_STATUS_ID, label: CANCELLED_STATUS_LABEL, dotClass: 'bg-red-600' },
    ];
  }

  statusValue(): number {
    const ticket = this.ticket();
    if (!ticket) return CANCELLED_STATUS_ID;
    return this.isCancelled() ? CANCELLED_STATUS_ID : ticket.column_id;
  }

  statusTriggerClass(): string {
    const base = 'w-full justify-between rounded-full border px-3 py-1.5 font-semibold';
    if (this.isPublished()) return `${base} border-gray-200 bg-gray-100 text-gray-500`;
    if (this.isCancelled()) return `${base} border-red-200 bg-red-50 text-red-700`;
    return `${base} border-blue-200 bg-blue-50 text-blue-700`;
  }

  async updateStatus(value: number | null): Promise<void> {
    const ticket = this.ticket();
    if (!ticket || value === null || this.isPublished() || value === this.statusValue()) return;
    try {
      let current = ticket;
      if (value === CANCELLED_STATUS_ID) {
        current = await this.cardsService.cancel(this.kanbanId, ticket.id);
      } else {
        if (this.isCancelled()) {
          current = await this.cardsService.restore(this.kanbanId, ticket.id);
        }
        if (value !== current.column_id) {
          current = await this.cardsService.move(this.kanbanId, current.id, value);
        }
      }
      this.ticket.set(current);
    } catch {
      this.error.set('Échec du changement de statut.');
    }
  }

  onDescriptionInput(event: Event): void {
    this.descriptionDraftHtml.set((event.target as HTMLElement).innerHTML);
  }

  async onDescriptionPaste(event: ClipboardEvent): Promise<void> {
    await this.handleImagePaste(event, () => {
      this.descriptionDraftHtml.set((event.target as HTMLElement).innerHTML);
    });
  }

  saveDescription(): void {
    this.patch({ description: stripCardImageSrc(this.descriptionDraftHtml()) || null });
  }

  hasCommentContent(): boolean {
    const html = this.newCommentDraftHtml();
    if (/<img[\s>]/i.test(html)) return true;
    const container = document.createElement('div');
    container.innerHTML = html;
    return (container.textContent ?? '').trim().length > 0;
  }

  onCommentInput(event: Event): void {
    this.newCommentDraftHtml.set((event.target as HTMLElement).innerHTML);
  }

  async onCommentPaste(event: ClipboardEvent): Promise<void> {
    await this.handleImagePaste(event, () => {
      this.newCommentDraftHtml.set((event.target as HTMLElement).innerHTML);
    });
  }

  async onCommentImageSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const image = await this.cardImagesService.upload(this.kanbanId, this.ticketId, file);
      this.commentEditorRef?.nativeElement.insertAdjacentHTML('beforeend', this.imageTag(image));
      this.newCommentDraftHtml.set(this.commentEditorRef?.nativeElement.innerHTML ?? '');
      this.images.set(await this.cardImagesService.list(this.kanbanId, this.ticketId));
    } catch {
      this.error.set("Échec de l'ajout de l'image.");
    }
  }

  async addComment(): Promise<void> {
    if (!this.hasCommentContent()) return;
    try {
      await this.commentsService.create(this.kanbanId, this.ticketId, this.newCommentDraftHtml());
      this.newCommentDraftHtml.set('');
      // La zone de commentaire est un contenteditable "non contrôlé" : son contenu (texte
      // et images insérées) vit hors du binding Angular, donc on le vide directement dans
      // le DOM plutôt que de compter sur un re-rendu déclenché par un signal.
      if (this.commentEditorRef) {
        this.commentEditorRef.nativeElement.innerHTML = '';
      }
      this.comments.set(await this.commentsService.list(this.kanbanId, this.ticketId));
    } catch {
      this.error.set("Échec de l'ajout du commentaire.");
    }
  }

  onCommentContentClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (target instanceof HTMLImageElement) {
      this.openImageViewer(target.src);
    }
  }

  openImageViewer(url: string): void {
    this.viewingImageUrl.set(url);
  }

  closeImageViewer(): void {
    this.viewingImageUrl.set(null);
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.viewingImageUrl()) {
      this.closeImageViewer();
    }
  }

  triggerGalleryUpload(): void {
    this.galleryFileInputRef?.nativeElement.click();
  }

  async onGalleryImageSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      await this.cardImagesService.upload(this.kanbanId, this.ticketId, file);
      this.images.set(await this.cardImagesService.list(this.kanbanId, this.ticketId));
    } catch {
      this.error.set("Échec de l'ajout de l'image.");
    }
  }

  async removeImage(imageId: number): Promise<void> {
    if (!confirm('Supprimer cette image ?')) return;
    try {
      await this.cardImagesService.remove(this.kanbanId, this.ticketId, imageId);
      this.images.set(await this.cardImagesService.list(this.kanbanId, this.ticketId));
    } catch {
      this.error.set("Échec de la suppression de l'image.");
    }
  }

  private imageTag(image: CardImage): string {
    return `<img src="${image.data_url}" data-card-image-id="${image.id}" alt="" class="max-w-full rounded">`;
  }

  private async handleImagePaste(event: ClipboardEvent, onInsert: () => void): Promise<void> {
    const items = event.clipboardData?.items;
    if (!items) return;
    const imageItem = Array.from(items).find((item) => item.type.startsWith('image/'));
    if (!imageItem) return;
    const file = imageItem.getAsFile();
    if (!file) return;
    event.preventDefault();
    try {
      const image = await this.cardImagesService.upload(this.kanbanId, this.ticketId, file);
      document.execCommand('insertHTML', false, this.imageTag(image));
      onInsert();
      this.images.set(await this.cardImagesService.list(this.kanbanId, this.ticketId));
    } catch {
      this.error.set("Échec de l'ajout de l'image.");
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
      await this.commentsService.remove(this.kanbanId, this.ticketId, comment.id);
      this.comments.set(await this.commentsService.list(this.kanbanId, this.ticketId));
    } catch {
      this.error.set('Échec de la suppression du commentaire.');
    }
  }

  isCancelled(): boolean {
    return !!this.ticket()?.cancelled_at;
  }

  async deleteTicket(): Promise<void> {
    const ticket = this.ticket();
    if (!ticket) return;
    if (!confirm(`Supprimer le ticket "${ticket.title}" ?`)) return;
    try {
      await this.cardsService.remove(this.kanbanId, ticket.id);
      this.router.navigate(['/kanbans', this.kanbanId, 'tickets']);
    } catch {
      this.error.set('Échec de la suppression du ticket.');
    }
  }
}

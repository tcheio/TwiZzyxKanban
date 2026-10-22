import { Component, DestroyRef, ElementRef, HostListener, OnInit, ViewChild, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { CardsService } from '../../../services/tickets/cards.service';
import { ColumnsService } from '../../../services/board/columns.service';
import { UsersService } from '../../../services/account/users.service';
import { CommentsService } from '../../../services/tickets/comments.service';
import { CardLinksService } from '../../../services/tickets/card-links.service';
import { CardImagesService } from '../../../services/tickets/card-images.service';
import { CardAssigneesService } from '../../../services/tickets/card-assignees.service';
import { CardTagsService } from '../../../services/tickets/card-tags.service';
import { TagsService } from '../../../services/board/tags.service';
import { EpicsService } from '../../../services/board/epics.service';
import { AuthService } from '../../../core/auth.service';
import { Card, CardInput, Priority } from '../../../models/card.model';
import { Column } from '../../../models/column.model';
import { Kanban } from '../../../models/kanban.model';
import { UserLite } from '../../../models/user.model';
import { Comment } from '../../../models/comment.model';
import { CardLink, CardLinkType } from '../../../models/card-link.model';
import { CardImage } from '../../../models/card-image.model';
import { AssignmentInput, CardAssignee } from '../../../models/card-assignee.model';
import { CardAssignmentHistoryEntry } from '../../../models/card-assignment-history.model';
import { Tag } from '../../../models/tag.model';
import { Epic } from '../../../models/epic.model';
import { epicBadgeClass, epicDotClass } from '../../../shared/epic-colors';
import { tagBadgeClass } from '../../../shared/tag-colors';
import { stripCardImageSrc, hydrateCardImages } from '../../../shared/card-image-html';
import {
  RICH_TEXT_COLORS,
  applyRichTextCommand,
  openRichTextLinkOnClick,
  linkifyPastedUrl,
  insertLinkAtCursor,
  insertNodeAtCursor,
  RichTextCommand,
} from '../../../shared/rich-text';
import { SearchSelect, SearchSelectOption } from '../../../shared/search-select/search-select';
import { NewTicketDialog } from '../new-ticket-dialog/new-ticket-dialog';
import { AssignmentDialog } from '../assignment-dialog/assignment-dialog';
import { CANCELLED_STATUS_ID, CANCELLED_STATUS_LABEL, cancelledTitleClass } from '../../../shared/ticket-status';
import { PRIORITY_LABELS, PRIORITY_DOT_CLASSES } from '../../../shared/priority';
import { startAutoRefresh } from '../../../shared/auto-refresh';
import { formatDateTime } from '../../../shared/datetime';

const PRIORITY_OPTIONS: SearchSelectOption<Priority>[] = (['low', 'medium', 'high'] as Priority[]).map((p) => ({
  id: p,
  label: PRIORITY_LABELS[p],
  dotClass: PRIORITY_DOT_CLASSES[p],
}));

export interface LinkedTicket {
  linkId: number;
  card: Card;
}

@Component({
  selector: 'app-ticket-detail',
  imports: [RouterLink, FormsModule, SearchSelect, NewTicketDialog, AssignmentDialog],
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
  private readonly cardAssigneesService = inject(CardAssigneesService);
  private readonly cardTagsService = inject(CardTagsService);
  private readonly tagsService = inject(TagsService);
  private readonly epicsService = inject(EpicsService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly authService = inject(AuthService);

  @ViewChild('commentEditor') private commentEditorRef?: ElementRef<HTMLDivElement>;
  @ViewChild('descriptionEditor') private descriptionEditorRef?: ElementRef<HTMLDivElement>;
  @ViewChild('galleryFileInput') private galleryFileInputRef?: ElementRef<HTMLInputElement>;

  readonly richTextColors = RICH_TEXT_COLORS;

  readonly ticket = signal<Card | null>(null);
  readonly columns = signal<Column[]>([]);
  readonly users = signal<UserLite[]>([]);
  readonly tags = signal<Tag[]>([]);
  readonly epics = signal<Epic[]>([]);
  readonly comments = signal<Comment[]>([]);
  readonly links = signal<CardLink[]>([]);
  readonly images = signal<CardImage[]>([]);
  readonly cards = signal<Card[]>([]);
  readonly assignees = signal<CardAssignee[]>([]);
  readonly assignmentHistory = signal<CardAssignmentHistoryEntry[]>([]);
  readonly assignmentDialogOpen = signal(false);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  // descriptionHtml n'est modifié que par reload() (jamais par la saisie) pour que le
  // binding [innerHTML] ne réinitialise pas le curseur à chaque frappe.
  readonly descriptionHtml = signal('');
  readonly descriptionEditing = signal(false);
  readonly newCommentDraftHtml = signal('');
  readonly cloneDialogOpen = signal(false);
  readonly newLinkTargetId = signal<number | null>(null);
  readonly newLinkType = signal<CardLinkType>('before');
  readonly viewingImageUrl = signal<string | null>(null);

  protected get kanban(): Kanban {
    return this.route.snapshot.data['kanban'] as Kanban;
  }

  protected get kanbanId(): number {
    return this.kanban.id;
  }

  protected get kanbanCode(): string {
    return this.kanban.code;
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
    try {
      const [ticket, columns, users, tags, epics, comments, links, images, cards, assignees, assignmentHistory] =
        await Promise.all([
          this.cardsService.get(this.kanbanId, this.ticketId),
          this.columnsService.list(this.kanbanId),
          this.usersService.liteForKanban(this.kanbanId),
          this.tagsService.list(this.kanbanId),
          this.epicsService.list(this.kanbanId),
          this.commentsService.list(this.kanbanId, this.ticketId),
          this.cardLinksService.list(this.kanbanId, this.ticketId),
          this.cardImagesService.list(this.kanbanId, this.ticketId),
          this.cardsService.list(this.kanbanId),
          this.cardAssigneesService.list(this.kanbanId, this.ticketId),
          this.cardAssigneesService.history(this.kanbanId, this.ticketId),
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
      this.assignees.set(assignees);
      this.assignmentHistory.set(assignmentHistory);
      // En rafraîchissement silencieux, si l'édition de la description est ouverte, on ne
      // veut pas écraser la saisie de l'utilisateur en cours.
      if (!options.silent || !this.descriptionEditing()) {
        this.descriptionHtml.set(hydrateCardImages(ticket.description ?? '', images));
      }
      this.titleService.setTitle(`${ticket.title} - TwiZzyxKanban`);
    } catch {
      this.error.set('Ticket introuvable.');
    } finally {
      this.loading.set(false);
    }
  }

  primaryAssignee(): UserLite | null {
    const ticket = this.ticket();
    if (!ticket?.assigned_user_id) return null;
    return this.users().find((u) => u.id === ticket.assigned_user_id) ?? null;
  }

  assigneeUserIds(): number[] {
    return this.assignees().map((a) => a.user_id);
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

  primaryTag(): Tag | null {
    const ticket = this.ticket();
    if (!ticket?.tag_id) return null;
    return this.tags().find((t) => t.id === ticket.tag_id) ?? null;
  }

  extraTags(): Tag[] {
    const ticket = this.ticket();
    if (!ticket) return [];
    const ids = ticket.tag_ids ?? [];
    return this.tags().filter((t) => ids.includes(t.id));
  }

  tagChipClass(tag: Tag): string {
    return tagBadgeClass(tag.color);
  }

  addableTagOptions(): SearchSelectOption<number>[] {
    const ticket = this.ticket();
    if (!ticket) return [];
    const used = new Set([ticket.tag_id, ...(ticket.tag_ids ?? [])]);
    return this.tags()
      .filter((t) => !used.has(t.id))
      .map((t) => ({
        id: t.id,
        label: t.archived ? `${t.name} (archivé)` : t.name,
        badgeClass: tagBadgeClass(t.color),
        iconUrl: t.emote_url,
      }));
  }

  // Point d'entrée unique du picker "+ Ajouter" : si le ticket n'a pas encore de tag
  // principal, le nouveau tag le devient ; sinon il rejoint les tags additionnels.
  // Ça évite d'avoir deux contrôles séparés (un pour le tag principal, un pour les
  // autres) alors que pour l'utilisateur il s'agit juste d'"ajouter un tag".
  async addTag(tagId: number | null): Promise<void> {
    if (tagId === null) return;
    if (!(await this.confirmTagReactivationIfNeeded(tagId))) return;
    const ticket = this.ticket();
    if (!ticket) return;
    if (!ticket.tag_id) {
      await this.patch({ tag_id: tagId });
      return;
    }
    await this.addExtraTag(tagId);
  }

  // Un tag archivé reste choisissable (ex: tag d'un ticket cloné, ou choix explicite dans
  // le groupe "archivés" du picker), mais on demande confirmation avant de le réactiver
  // silencieusement pour tout le kanban.
  private async confirmTagReactivationIfNeeded(tagId: number | null | undefined): Promise<boolean> {
    const tag = tagId == null ? null : this.tags().find((t) => t.id === tagId);
    if (!tag?.archived) return true;
    if (!confirm(`Le tag "${tag.name}" est archivé. Le réactiver pour l'utiliser sur ce ticket ?`)) return false;
    try {
      await this.tagsService.update(this.kanbanId, tag.id, { archived: false });
      this.tags.update((list) => list.map((t) => (t.id === tag.id ? { ...t, archived: false } : t)));
      return true;
    } catch {
      this.error.set('Échec de la réactivation du tag.');
      return false;
    }
  }

  async addExtraTag(tagId: number | null): Promise<void> {
    if (tagId === null) return;
    const ticket = this.ticket();
    if (!ticket) return;
    try {
      this.ticket.set(await this.cardTagsService.add(this.kanbanId, ticket.id, tagId));
    } catch {
      this.error.set("Échec de l'ajout du tag.");
    }
  }

  async removeExtraTag(tagId: number): Promise<void> {
    const ticket = this.ticket();
    if (!ticket) return;
    try {
      this.ticket.set(await this.cardTagsService.remove(this.kanbanId, ticket.id, tagId));
    } catch {
      this.error.set('Échec du retrait du tag.');
    }
  }

  epicOptions(): SearchSelectOption<number>[] {
    return this.epics().map((e) => ({ id: e.id, label: e.name, badgeClass: epicBadgeClass(e.color), iconUrl: e.emote_url }));
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
    if (!(await this.confirmTagReactivationIfNeeded(input.tag_id))) return;
    try {
      const created = await this.cardsService.create(this.kanbanId, input);
      this.cloneDialogOpen.set(false);
      this.router.navigate(['/kanbans', `${this.kanbanCode}-${created.id}`]);
    } catch {
      this.error.set('Échec de la création du clone.');
    }
  }

  readonly formatDateTime = formatDateTime;

  private async patch(partial: {
    title?: string;
    assigned_user_id?: number | null;
    priority?: Priority;
    description?: string | null;
    tag_id?: number | null;
    epic_id?: number | null;
    due_date?: string | null;
  }): Promise<boolean> {
    const ticket = this.ticket();
    if (!ticket) return false;
    try {
      const updated = await this.cardsService.update(this.kanbanId, ticket.id, partial);
      this.ticket.set(updated);
      return true;
    } catch {
      this.error.set("Échec de l'enregistrement.");
      return false;
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

  updateTag(tagId: number | null): void {
    this.patch({ tag_id: tagId });
  }

  updateEpic(epicId: number | null): void {
    this.patch({ epic_id: epicId });
  }

  updateDueDate(value: string): void {
    this.patch({ due_date: value || null });
  }

  openAssignmentDialog(): void {
    this.assignmentDialogOpen.set(true);
  }

  async saveAssignment(input: AssignmentInput): Promise<void> {
    try {
      const updated = await this.cardAssigneesService.upsert(this.kanbanId, this.ticketId, input);
      this.ticket.set(updated);
      const [assignees, assignmentHistory] = await Promise.all([
        this.cardAssigneesService.list(this.kanbanId, this.ticketId),
        this.cardAssigneesService.history(this.kanbanId, this.ticketId),
      ]);
      this.assignees.set(assignees);
      this.assignmentHistory.set(assignmentHistory);
      this.assignmentDialogOpen.set(false);
    } catch {
      this.error.set("Échec de la mise à jour des responsables.");
    }
  }

  async removeAssignee(userId: number): Promise<void> {
    const reason = prompt('Raison du retrait de cette personne des responsables du ticket :')?.trim();
    if (!reason) return;
    try {
      await this.cardAssigneesService.remove(this.kanbanId, this.ticketId, userId, reason);
      const [assignees, assignmentHistory] = await Promise.all([
        this.cardAssigneesService.list(this.kanbanId, this.ticketId),
        this.cardAssigneesService.history(this.kanbanId, this.ticketId),
      ]);
      this.assignees.set(assignees);
      this.assignmentHistory.set(assignmentHistory);
    } catch {
      this.error.set("Échec du retrait du responsable.");
    }
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
      { id: CANCELLED_STATUS_ID, label: CANCELLED_STATUS_LABEL, dotClass: 'bg-danger' },
    ];
  }

  statusValue(): number {
    const ticket = this.ticket();
    if (!ticket) return CANCELLED_STATUS_ID;
    return this.isCancelled() ? CANCELLED_STATUS_ID : ticket.column_id;
  }

  statusTriggerClass(): string {
    const base = 'w-full justify-between rounded-full border px-3 py-1.5 font-semibold';
    if (this.isPublished()) return `${base} border-border bg-surface-muted text-text-muted`;
    if (this.isCancelled()) return `${base} border-danger bg-danger-soft text-danger`;
    return `${base} border-brand bg-brand-soft text-brand-soft-text`;
  }

  // Seuls les modérateurs du kanban et les responsables (principal ou additionnel) du
  // ticket peuvent changer son statut — reflète la règle appliquée côté backend
  // (cards.controller.js::move/cancel/restore).
  canChangeStatus(): boolean {
    if (this.kanban.is_moderator) return true;
    const ticket = this.ticket();
    const userId = this.authService.currentUser()?.id;
    if (!ticket || !userId) return false;
    return ticket.assigned_user_id === userId || (ticket.assignee_ids ?? []).includes(userId);
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

  // Dans un `contenteditable`, un clic simple sur un lien place juste le curseur au lieu
  // de naviguer : on l'ouvre nous-mêmes dans un nouvel onglet.
  onEditableContentClick(event: MouseEvent): void {
    openRichTextLinkOnClick(event);
  }

  async onDescriptionPaste(event: ClipboardEvent): Promise<void> {
    await this.handlePaste(event);
  }

  // La description est en lecture seule par défaut (pour éviter toute modification
  // accidentelle) ; ces trois méthodes gèrent le bascule vers/depuis le mode édition.
  startEditingDescription(): void {
    this.descriptionEditing.set(true);
  }

  cancelEditingDescription(): void {
    this.descriptionEditing.set(false);
  }

  async saveDescription(): Promise<void> {
    // Lit le DOM réel de l'éditeur : c'est ce qui est visiblement affiché à l'écran au
    // moment d'enregistrer qui doit être sauvegardé, point final.
    const html = this.descriptionEditorRef?.nativeElement.innerHTML ?? '';
    const saved = await this.patch({ description: stripCardImageSrc(html) || null });
    if (!saved) return;
    const ticket = this.ticket();
    this.descriptionHtml.set(hydrateCardImages(ticket?.description ?? '', this.images()));
    this.descriptionEditing.set(false);
  }

  formatDescription(command: RichTextCommand): void {
    const editor = this.descriptionEditorRef?.nativeElement;
    if (!editor) return;
    applyRichTextCommand(editor, command);
  }

  // Utilisé par le template (désactivation du bouton "Envoyer") : se base sur le signal,
  // c'est le seul endroit où on en a besoin pour réagir à chaque frappe sans relire le DOM.
  hasCommentContent(): boolean {
    return this.hasCommentContentIn(this.newCommentDraftHtml());
  }

  private hasCommentContentIn(html: string): boolean {
    if (/<img[\s>]/i.test(html)) return true;
    const container = document.createElement('div');
    container.innerHTML = html;
    return (container.textContent ?? '').trim().length > 0;
  }

  onCommentInput(event: Event): void {
    this.newCommentDraftHtml.set((event.target as HTMLElement).innerHTML);
  }

  formatComment(command: RichTextCommand): void {
    const editor = this.commentEditorRef?.nativeElement;
    if (!editor) return;
    applyRichTextCommand(editor, command);
    this.newCommentDraftHtml.set(editor.innerHTML);
  }

  async onCommentPaste(event: ClipboardEvent): Promise<void> {
    const onInsert = () => this.newCommentDraftHtml.set((event.target as HTMLElement).innerHTML);
    await this.handlePaste(event, onInsert);
  }

  async onCommentImageSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const image = await this.cardImagesService.upload(this.kanbanId, this.ticketId, file);
      this.commentEditorRef?.nativeElement.appendChild(this.imageNode(image));
      this.newCommentDraftHtml.set(this.commentEditorRef?.nativeElement.innerHTML ?? '');
      this.images.set(await this.cardImagesService.list(this.kanbanId, this.ticketId));
    } catch {
      this.error.set("Échec de l'ajout de l'image.");
    }
  }

  async addComment(): Promise<void> {
    // Même principe que saveDescription() : on lit le DOM réel de l'éditeur plutôt que
    // le signal `newCommentDraftHtml`, pour ne jamais dépendre de la fraîcheur du dernier
    // event input/paste reçu.
    const html = this.commentEditorRef?.nativeElement.innerHTML ?? this.newCommentDraftHtml();
    if (!this.hasCommentContentIn(html)) return;
    try {
      await this.commentsService.create(this.kanbanId, this.ticketId, html);
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

  private imageNode(image: CardImage): HTMLImageElement {
    const img = document.createElement('img');
    img.src = image.data_url;
    img.alt = '';
    img.className = 'max-w-full rounded';
    img.dataset['cardImageId'] = String(image.id);
    return img;
  }

  // Pure et synchrone (aucun `await`) : juste détecter une image dans le presse-papiers,
  // sans l'uploader. Sert à décider — et appeler event.preventDefault() — de façon
  // synchrone dans handlePaste(), avant toute opération asynchrone. Un handler
  // d'événement `async` ne bloque pas le navigateur : dès le premier `await` (même sur
  // une valeur déjà résolue), la main est rendue et le collage par défaut du navigateur
  // s'exécute si preventDefault() n'a pas déjà été appelé — ce qui, avant ce correctif,
  // dupliquait/écrasait le contenu existant lors du collage d'un lien dans une
  // description non vide.
  private extractPastedImageFile(event: ClipboardEvent): File | null {
    const items = event.clipboardData?.items;
    if (!items) return null;
    const imageItem = Array.from(items).find((item) => item.type.startsWith('image/'));
    return imageItem?.getAsFile() ?? null;
  }

  private async uploadAndInsertImage(file: File, editor: HTMLElement, onInsert?: () => void): Promise<void> {
    try {
      const image = await this.cardImagesService.upload(this.kanbanId, this.ticketId, file);
      insertNodeAtCursor(editor, this.imageNode(image));
      onInsert?.();
      this.images.set(await this.cardImagesService.list(this.kanbanId, this.ticketId));
    } catch {
      this.error.set("Échec de l'ajout de l'image.");
    }
  }

  // Décide de façon synchrone (image collée ou non) et appelle event.preventDefault()
  // avant toute opération asynchrone (cf commentaire d'extractPastedImageFile) ; seul
  // l'upload proprement dit, une fois la décision prise, est asynchrone.
  private async handlePaste(event: ClipboardEvent, onInsert?: () => void): Promise<void> {
    const imageFile = this.extractPastedImageFile(event);
    if (imageFile) {
      event.preventDefault();
      await this.uploadAndInsertImage(imageFile, event.target as HTMLElement, onInsert);
      return;
    }
    this.handleLinkPaste(event, onInsert);
  }

  // Si le texte collé est entièrement une URL, on l'insère directement comme lien cliquable
  // plutôt qu'en texte brut. Renvoie true si pris en charge (sinon le collage par défaut du
  // navigateur suit son cours, ex. pour un texte enrichi copié depuis une autre page).
  private handleLinkPaste(event: ClipboardEvent, onInsert?: () => void): boolean {
    const text = event.clipboardData?.getData?.('text/plain');
    if (!text) return false;
    const link = linkifyPastedUrl(text);
    if (!link) return false;
    event.preventDefault();
    insertLinkAtCursor(event.target as HTMLElement, link);
    onInsert?.();
    return true;
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
      this.router.navigate(['/kanbans', this.kanbanCode, 'tickets']);
    } catch {
      this.error.set('Échec de la suppression du ticket.');
    }
  }
}

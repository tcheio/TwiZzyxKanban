import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { KanbansService } from '../../../services/kanbans.service';
import { UsersService } from '../../../services/users.service';
import { AuthService } from '../../../core/auth.service';
import { KanbanMember } from '../../../models/kanban.model';
import { User } from '../../../models/user.model';
import { SearchSelect, SearchSelectOption } from '../../../shared/search-select/search-select';

@Component({
  selector: 'app-kanban-members',
  imports: [SearchSelect],
  templateUrl: './kanban-members.html',
})
export class KanbanMembers implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly kanbansService = inject(KanbansService);
  private readonly usersService = inject(UsersService);
  protected readonly authService = inject(AuthService);

  private readonly kanbanId = Number(this.route.snapshot.paramMap.get('kanbanId'));

  readonly members = signal<KanbanMember[]>([]);
  readonly allUsers = signal<User[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly selectedUserId = signal<number | null>(null);

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [members, allUsers] = await Promise.all([
        this.kanbansService.membersList(this.kanbanId),
        this.usersService.list(),
      ]);
      this.members.set(members);
      this.allUsers.set(allUsers);
    } catch {
      this.error.set('Impossible de charger les membres.');
    } finally {
      this.loading.set(false);
    }
  }

  addableUsers(): SearchSelectOption<number>[] {
    const memberIds = new Set(this.members().map((m) => m.id));
    return this.allUsers()
      .filter((u) => !memberIds.has(u.id))
      .map((u) => ({
        id: u.id,
        label: u.username,
        avatarUrl: u.avatar_url ?? null,
        avatarInitial: u.username.charAt(0).toUpperCase(),
      }));
  }

  private extractError(err: unknown, fallback: string): string {
    return (err as { error?: { error?: string } })?.error?.error ?? fallback;
  }

  async addMember(): Promise<void> {
    const userId = this.selectedUserId();
    if (!userId) return;
    try {
      await this.kanbansService.membersAdd(this.kanbanId, userId);
      this.selectedUserId.set(null);
      await this.reload();
    } catch (err: unknown) {
      this.error.set(this.extractError(err, "Échec de l'ajout du membre."));
    }
  }

  async removeMember(member: KanbanMember): Promise<void> {
    if (!confirm(`Retirer ${member.username} de ce kanban ?`)) return;
    try {
      await this.kanbansService.membersRemove(this.kanbanId, member.id);
      await this.reload();
    } catch (err: unknown) {
      this.error.set(this.extractError(err, 'Échec du retrait du membre.'));
    }
  }

  async toggleModerator(member: KanbanMember): Promise<void> {
    try {
      await this.kanbansService.membersSetModerator(this.kanbanId, member.id, !member.is_moderator);
      await this.reload();
    } catch (err: unknown) {
      this.error.set(this.extractError(err, 'Échec de la mise à jour du rôle.'));
    }
  }
}

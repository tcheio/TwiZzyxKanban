import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { UsersService, UserInput } from '../../services/users.service';
import { Role, User } from '../../models/user.model';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-admin-users',
  imports: [ReactiveFormsModule],
  templateUrl: './admin-users.html',
})
export class AdminUsers implements OnInit {
  private fb = inject(FormBuilder);
  private usersService = inject(UsersService);
  protected authService = inject(AuthService);

  readonly users = signal<User[]>([]);
  readonly error = signal<string | null>(null);
  readonly creating = signal(false);
  readonly editingId = signal<number | null>(null);

  readonly createForm = this.fb.group({
    username: ['', Validators.required],
    password: ['', [Validators.required, Validators.minLength(6)]],
    role: ['user' as Role, Validators.required],
  });

  readonly editForm = this.fb.group({
    username: ['', Validators.required],
    role: ['user' as Role, Validators.required],
    password: [''],
  });

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    try {
      this.users.set(await this.usersService.list());
    } catch {
      this.error.set('Impossible de charger les utilisateurs.');
    }
  }

  async createUser(): Promise<void> {
    if (this.createForm.invalid) return;
    const raw = this.createForm.getRawValue();
    try {
      await this.usersService.create({
        username: raw.username!,
        password: raw.password!,
        role: raw.role!,
      });
      this.createForm.reset({ username: '', password: '', role: 'user' });
      this.creating.set(false);
      await this.reload();
    } catch (err: any) {
      this.error.set(err?.error?.error ?? 'Échec de la création du compte.');
    }
  }

  startEdit(user: User): void {
    this.editingId.set(user.id);
    this.editForm.reset({ username: user.username, role: user.role, password: '' });
  }

  cancelEdit(): void {
    this.editingId.set(null);
  }

  async saveEdit(user: User): Promise<void> {
    if (this.editForm.invalid) return;
    const raw = this.editForm.getRawValue();
    const input: Partial<UserInput> = { username: raw.username!, role: raw.role! };
    if (raw.password) input.password = raw.password;

    try {
      await this.usersService.update(user.id, input);
      this.editingId.set(null);
      await this.reload();
    } catch (err: any) {
      this.error.set(err?.error?.error ?? 'Échec de la mise à jour.');
    }
  }

  async deleteUser(user: User): Promise<void> {
    if (!confirm(`Supprimer l'utilisateur "${user.username}" ?`)) return;
    try {
      await this.usersService.remove(user.id);
      await this.reload();
    } catch (err: any) {
      this.error.set(err?.error?.error ?? 'Échec de la suppression.');
    }
  }
}

import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { ProfileService, ProfileUpdateInput } from '../../services/profile.service';
import { resizeImageToDataUrl } from '../../shared/image-to-data-url';

@Component({
  selector: 'app-profile',
  imports: [RouterLink],
  templateUrl: './profile.html',
})
export class Profile implements OnInit {
  private readonly profileService = inject(ProfileService);
  protected readonly authService = inject(AuthService);

  readonly loading = signal(true);
  readonly avatarUrl = signal<string | null>(null);
  readonly username = signal('');
  readonly currentPassword = signal('');
  readonly newPassword = signal('');
  readonly confirmPassword = signal('');

  readonly savingUsername = signal(false);
  readonly savingPassword = signal(false);
  readonly savingAvatar = signal(false);

  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      const me = await this.profileService.me();
      this.username.set(me.username);
      this.avatarUrl.set(me.avatar_url ?? null);
    } catch {
      this.error.set('Impossible de charger le profil.');
    } finally {
      this.loading.set(false);
    }
  }

  async onAvatarSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.savingAvatar.set(true);
    this.error.set(null);
    this.success.set(null);
    try {
      const dataUrl = await resizeImageToDataUrl(file, 256, 0.85);
      const updated = await this.profileService.update({ avatar_url: dataUrl });
      this.avatarUrl.set(updated.avatar_url ?? null);
      this.authService.setCurrentUser(updated);
      this.success.set('Photo de profil mise à jour.');
    } catch {
      this.error.set("Impossible de traiter cette image.");
    } finally {
      this.savingAvatar.set(false);
    }
  }

  async saveUsername(): Promise<void> {
    const trimmed = this.username().trim();
    if (!trimmed) return;

    await this.save(
      { username: trimmed },
      this.savingUsername,
      'Nom d’utilisateur mis à jour.',
      'Échec de la mise à jour du nom d’utilisateur.'
    );
  }

  async savePassword(): Promise<void> {
    this.error.set(null);
    if (this.newPassword().length < 6) {
      this.error.set('Le nouveau mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    if (this.newPassword() !== this.confirmPassword()) {
      this.error.set('Les mots de passe ne correspondent pas.');
      return;
    }

    const ok = await this.save(
      { currentPassword: this.currentPassword(), password: this.newPassword() },
      this.savingPassword,
      'Mot de passe mis à jour.',
      'Échec du changement de mot de passe.'
    );
    if (ok) {
      this.currentPassword.set('');
      this.newPassword.set('');
      this.confirmPassword.set('');
    }
  }

  private async save(
    input: ProfileUpdateInput,
    savingSignal: ReturnType<typeof signal<boolean>>,
    successMessage: string,
    fallbackError: string
  ): Promise<boolean> {
    savingSignal.set(true);
    this.error.set(null);
    this.success.set(null);
    try {
      const updated = await this.profileService.update(input);
      this.authService.setCurrentUser(updated);
      this.success.set(successMessage);
      return true;
    } catch (err: any) {
      this.error.set(err?.error?.error ?? fallbackError);
      return false;
    } finally {
      savingSignal.set(false);
    }
  }
}

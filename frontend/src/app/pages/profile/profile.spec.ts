import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Profile } from './profile';
import { ProfileService } from '../../services/profile.service';
import { AuthService } from '../../core/auth.service';
import { User } from '../../models/user.model';

describe('Profile', () => {
  let component: Profile;
  let profileService: {
    me: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let setCurrentUser: ReturnType<typeof vi.fn>;

  const me: User = { id: 1, username: 'admin', role: 'admin', avatar_url: null };

  beforeEach(() => {
    profileService = {
      me: vi.fn().mockResolvedValue(me),
      update: vi.fn().mockResolvedValue({ ...me, username: 'newname' }),
    };
    setCurrentUser = vi.fn();

    TestBed.configureTestingModule({
      imports: [Profile],
      providers: [
        provideRouter([]),
        { provide: ProfileService, useValue: profileService },
        { provide: AuthService, useValue: { currentUser: () => me, setCurrentUser } },
      ],
    });
    component = TestBed.createComponent(Profile).componentInstance;
  });

  it('ngOnInit() charge le profil courant', async () => {
    await component.ngOnInit();

    expect(component.username()).toBe('admin');
    expect(component.avatarUrl()).toBeNull();
    expect(component.loading()).toBe(false);
  });

  it('saveUsername() ne fait rien si le champ est vide', async () => {
    component.username.set('   ');

    await component.saveUsername();

    expect(profileService.update).not.toHaveBeenCalled();
  });

  it("saveUsername() met à jour le pseudo et synchronise l'utilisateur courant", async () => {
    component.username.set('newname');

    await component.saveUsername();

    expect(profileService.update).toHaveBeenCalledWith({ username: 'newname' });
    expect(setCurrentUser).toHaveBeenCalledWith({ ...me, username: 'newname' });
    expect(component.success()).toBeTruthy();
  });

  it('savePassword() refuse un mot de passe trop court', async () => {
    component.currentPassword.set('oldpass1');
    component.newPassword.set('abc');
    component.confirmPassword.set('abc');

    await component.savePassword();

    expect(profileService.update).not.toHaveBeenCalled();
    expect(component.error()).toContain('6 caractères');
  });

  it('savePassword() refuse si la confirmation ne correspond pas', async () => {
    component.currentPassword.set('oldpass1');
    component.newPassword.set('newpass1');
    component.confirmPassword.set('different1');

    await component.savePassword();

    expect(profileService.update).not.toHaveBeenCalled();
    expect(component.error()).toContain('correspondent pas');
  });

  it('savePassword() envoie la mise à jour et réinitialise les champs en cas de succès', async () => {
    component.currentPassword.set('oldpass1');
    component.newPassword.set('newpass1');
    component.confirmPassword.set('newpass1');

    await component.savePassword();

    expect(profileService.update).toHaveBeenCalledWith({
      currentPassword: 'oldpass1',
      password: 'newpass1',
    });
    expect(component.currentPassword()).toBe('');
    expect(component.newPassword()).toBe('');
    expect(component.confirmPassword()).toBe('');
  });

  it("savePassword() garde les champs remplis si la requête échoue", async () => {
    profileService.update.mockRejectedValue({ error: { error: 'Mot de passe actuel incorrect' } });
    component.currentPassword.set('wrongpass');
    component.newPassword.set('newpass1');
    component.confirmPassword.set('newpass1');

    await component.savePassword();

    expect(component.error()).toBe('Mot de passe actuel incorrect');
    expect(component.currentPassword()).toBe('wrongpass');
  });
});

import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminUsers } from './admin-users';
import { UsersService } from '../../services/users.service';
import { AuthService } from '../../core/auth.service';
import { User } from '../../models/user.model';

describe('AdminUsers', () => {
  let component: AdminUsers;
  let usersService: {
    list: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };

  const baseUsers: User[] = [
    { id: 1, username: 'admin', role: 'admin' },
    { id: 2, username: 'alice', role: 'user' },
  ];

  beforeEach(() => {
    usersService = {
      list: vi.fn().mockResolvedValue(baseUsers),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      remove: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      imports: [AdminUsers],
      providers: [
        { provide: UsersService, useValue: usersService },
        {
          provide: AuthService,
          useValue: { currentUser: () => ({ id: 1, username: 'admin', role: 'admin' }) },
        },
      ],
    });
    component = TestBed.createComponent(AdminUsers).componentInstance;
  });

  it('reload() charge la liste des utilisateurs', async () => {
    await component.reload();
    expect(component.users()).toEqual(baseUsers);
  });

  it('createUser() crée un compte et réinitialise le formulaire', async () => {
    component.createForm.setValue({ username: 'bob', password: 'bobpass1', role: 'user' });

    await component.createUser();

    expect(usersService.create).toHaveBeenCalledWith({ username: 'bob', password: 'bobpass1', role: 'user' });
    expect(component.creating()).toBe(false);
  });

  it("createUser() ne fait rien si le formulaire est invalide", async () => {
    component.createForm.setValue({ username: '', password: '', role: 'user' });

    await component.createUser();

    expect(usersService.create).not.toHaveBeenCalled();
  });

  it("startEdit()/cancelEdit() pilotent le mode édition", () => {
    component.startEdit(baseUsers[1]);
    expect(component.editingId()).toBe(2);
    expect(component.editForm.value.username).toBe('alice');
    expect(component.editForm.value.role).toBe('user');

    component.cancelEdit();
    expect(component.editingId()).toBeNull();
  });

  it("saveEdit() met à jour sans mot de passe si le champ est vide", async () => {
    component.startEdit(baseUsers[1]);
    component.editForm.patchValue({ username: 'alice2', role: 'user', password: '' });

    await component.saveEdit(baseUsers[1]);

    expect(usersService.update).toHaveBeenCalledWith(2, { username: 'alice2', role: 'user' });
    expect(component.editingId()).toBeNull();
  });

  it('saveEdit() inclut le mot de passe quand il est renseigné', async () => {
    component.startEdit(baseUsers[1]);
    component.editForm.patchValue({ username: 'alice', role: 'user', password: 'newpass1' });

    await component.saveEdit(baseUsers[1]);

    expect(usersService.update).toHaveBeenCalledWith(2, {
      username: 'alice',
      role: 'user',
      password: 'newpass1',
    });
  });

  it('deleteUser() supprime après confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    await component.deleteUser(baseUsers[1]);

    expect(usersService.remove).toHaveBeenCalledWith(2);
  });

  it("deleteUser() n'appelle pas remove() si annulé", async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    await component.deleteUser(baseUsers[1]);

    expect(usersService.remove).not.toHaveBeenCalled();
  });
});

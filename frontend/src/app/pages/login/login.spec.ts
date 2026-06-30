import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Login } from './login';
import { AuthService } from '../../core/auth.service';

describe('Login', () => {
  let component: Login;
  let login: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    login = vi.fn();
    navigate = vi.fn();

    TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        { provide: AuthService, useValue: { login } },
        { provide: Router, useValue: { navigate } },
      ],
    });
    component = TestBed.createComponent(Login).componentInstance;
  });

  it('le formulaire est invalide quand vide', () => {
    expect(component.form.invalid).toBe(true);
  });

  it("submit() n'appelle pas login() si le formulaire est invalide", async () => {
    await component.submit();
    expect(login).not.toHaveBeenCalled();
  });

  it('submit() appelle login() et redirige vers /board en cas de succès', async () => {
    login.mockResolvedValue(undefined);
    component.form.setValue({ username: 'admin', password: 'admin123' });

    await component.submit();

    expect(login).toHaveBeenCalledWith('admin', 'admin123');
    expect(navigate).toHaveBeenCalledWith(['/board']);
    expect(component.error()).toBeNull();
    expect(component.loading()).toBe(false);
  });

  it("submit() affiche une erreur en cas d'échec de connexion", async () => {
    login.mockRejectedValue(new Error('401'));
    component.form.setValue({ username: 'admin', password: 'wrong' });

    await component.submit();

    expect(component.error()).toBe('Identifiants invalides');
    expect(navigate).not.toHaveBeenCalled();
    expect(component.loading()).toBe(false);
  });
});

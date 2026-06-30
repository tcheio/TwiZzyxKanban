import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authGuard } from './auth.guard';
import { AuthService } from './auth.service';

describe('authGuard', () => {
  let isLoggedIn: ReturnType<typeof vi.fn>;
  let parseUrl: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    isLoggedIn = vi.fn();
    parseUrl = vi.fn().mockReturnValue('PARSED_LOGIN_URL');

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { isLoggedIn } },
        { provide: Router, useValue: { parseUrl } },
      ],
    });
  });

  it('autorise l\'accès quand connecté', () => {
    isLoggedIn.mockReturnValue(true);

    const result = TestBed.runInInjectionContext(() => authGuard({} as any, {} as any));

    expect(result).toBe(true);
  });

  it('redirige vers /login quand non connecté', () => {
    isLoggedIn.mockReturnValue(false);

    const result = TestBed.runInInjectionContext(() => authGuard({} as any, {} as any));

    expect(parseUrl).toHaveBeenCalledWith('/login');
    expect(result).toBe('PARSED_LOGIN_URL');
  });
});

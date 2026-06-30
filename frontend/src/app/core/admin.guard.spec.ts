import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adminGuard } from './admin.guard';
import { AuthService } from './auth.service';

describe('adminGuard', () => {
  let isAdmin: ReturnType<typeof vi.fn>;
  let parseUrl: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    isAdmin = vi.fn();
    parseUrl = vi.fn().mockReturnValue('PARSED_BOARD_URL');

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { isAdmin } },
        { provide: Router, useValue: { parseUrl } },
      ],
    });
  });

  it('autorise l\'accès pour un admin', () => {
    isAdmin.mockReturnValue(true);

    const result = TestBed.runInInjectionContext(() => adminGuard({} as any, {} as any));

    expect(result).toBe(true);
  });

  it('redirige vers /board pour un non-admin', () => {
    isAdmin.mockReturnValue(false);

    const result = TestBed.runInInjectionContext(() => adminGuard({} as any, {} as any));

    expect(parseUrl).toHaveBeenCalledWith('/board');
    expect(result).toBe('PARSED_BOARD_URL');
  });
});

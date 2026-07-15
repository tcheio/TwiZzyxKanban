import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { KanbansService } from '../services/kanbans.service';

export const kanbanAccessGuard: CanActivateFn = async (route) => {
  const kanbansService = inject(KanbansService);
  const router = inject(Router);
  const kanbanId = Number(route.paramMap.get('kanbanId'));

  try {
    const kanbans = await kanbansService.list();
    if (kanbans.some((k) => k.id === kanbanId)) {
      return true;
    }
  } catch {
    // Ignore et redirige comme un accès refusé
  }
  return router.parseUrl('/kanbans');
};

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { KanbansService } from '../services/kanbans.service';

export const kanbanModeratorGuard: CanActivateFn = async (route) => {
  const kanbansService = inject(KanbansService);
  const router = inject(Router);
  const code = route.paramMap.get('kanbanCode');

  try {
    const kanbans = await kanbansService.list();
    const kanban = kanbans.find((k) => k.code === code);
    if (kanban?.is_moderator) {
      return true;
    }
    if (kanban) {
      return router.parseUrl(`/kanbans/${kanban.code}`);
    }
  } catch {
    // Ignore et redirige comme un accès refusé
  }
  return router.parseUrl('/kanbans');
};

import { inject } from '@angular/core';
import { RedirectCommand, ResolveFn, Router } from '@angular/router';
import { KanbansService } from '../services/kanbans.service';
import { Kanban } from '../models/kanban.model';

// Résout le segment :kanbanCode de l'URL (ex. "TK-TWIZZYX") vers le Kanban complet
// (avec son id numérique, utilisé pour les appels API). kanbansService.list() ne renvoie
// que les kanbans accessibles à l'utilisateur courant : si le code ne s'y trouve pas
// (kanban inexistant OU accès refusé), on redirige vers la liste des kanbans.
export const kanbanResolver: ResolveFn<Kanban | RedirectCommand> = async (route) => {
  const kanbansService = inject(KanbansService);
  const router = inject(Router);
  const code = route.paramMap.get('kanbanCode');

  try {
    const kanbans = await kanbansService.list();
    const kanban = kanbans.find((k) => k.code === code);
    if (kanban) {
      return kanban;
    }
  } catch {
    // tombe dans la redirection ci-dessous
  }
  return new RedirectCommand(router.parseUrl('/kanbans'));
};

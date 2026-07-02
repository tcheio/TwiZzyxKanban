import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { adminGuard } from './core/admin.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
  },
  {
    path: 'board',
    loadComponent: () => import('./pages/board/board').then((m) => m.Board),
    canActivate: [authGuard],
  },
  {
    path: 'board/settings',
    loadComponent: () =>
      import('./pages/board/board-settings/board-settings').then((m) => m.BoardSettings),
    canActivate: [authGuard, adminGuard],
  },
  {
    path: 'tickets',
    loadComponent: () =>
      import('./pages/tickets/tickets-list/tickets-list').then((m) => m.TicketsList),
    canActivate: [authGuard],
  },
  {
    path: 'tickets/:id',
    loadComponent: () =>
      import('./pages/tickets/ticket-detail/ticket-detail').then((m) => m.TicketDetail),
    canActivate: [authGuard],
  },
  {
    path: 'tags',
    loadComponent: () => import('./pages/tags/tags-list/tags-list').then((m) => m.TagsList),
    canActivate: [authGuard],
  },
  {
    path: 'tags/:id',
    loadComponent: () => import('./pages/tags/tag-detail/tag-detail').then((m) => m.TagDetail),
    canActivate: [authGuard],
  },
  {
    path: 'admin/users',
    loadComponent: () =>
      import('./pages/admin-users/admin-users').then((m) => m.AdminUsers),
    canActivate: [authGuard, adminGuard],
  },
  { path: '', pathMatch: 'full', redirectTo: 'board' },
  { path: '**', redirectTo: 'board' },
];

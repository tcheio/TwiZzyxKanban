import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { adminGuard } from './core/admin.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
    title: 'Connexion - TwiZzyxKanban',
  },
  {
    path: 'board',
    loadComponent: () => import('./pages/board/board').then((m) => m.Board),
    canActivate: [authGuard],
    title: 'Board - TwiZzyxKanban',
  },
  {
    path: 'profile',
    loadComponent: () => import('./pages/profile/profile').then((m) => m.Profile),
    canActivate: [authGuard],
    title: 'Profil - TwiZzyxKanban',
  },
  {
    path: 'board/settings',
    loadComponent: () =>
      import('./pages/board/board-settings/board-settings').then((m) => m.BoardSettings),
    canActivate: [authGuard, adminGuard],
    title: 'Paramètres du tableau - TwiZzyxKanban',
  },
  {
    path: 'tickets',
    loadComponent: () =>
      import('./pages/tickets/tickets-list/tickets-list').then((m) => m.TicketsList),
    canActivate: [authGuard],
    title: 'Tickets - TwiZzyxKanban',
  },
  {
    path: 'tickets/:id',
    loadComponent: () =>
      import('./pages/tickets/ticket-detail/ticket-detail').then((m) => m.TicketDetail),
    canActivate: [authGuard],
    title: 'Ticket - TwiZzyxKanban',
  },
  {
    path: 'tags',
    loadComponent: () => import('./pages/tags/tags-list/tags-list').then((m) => m.TagsList),
    canActivate: [authGuard],
    title: 'Tags - TwiZzyxKanban',
  },
  {
    path: 'tags/:id',
    loadComponent: () => import('./pages/tags/tag-detail/tag-detail').then((m) => m.TagDetail),
    canActivate: [authGuard],
    title: 'Tag - TwiZzyxKanban',
  },
  {
    path: 'epics',
    loadComponent: () => import('./pages/epics/epics-list/epics-list').then((m) => m.EpicsList),
    canActivate: [authGuard],
    title: 'EPICs - TwiZzyxKanban',
  },
  {
    path: 'epics/:id',
    loadComponent: () => import('./pages/epics/epic-detail/epic-detail').then((m) => m.EpicDetail),
    canActivate: [authGuard],
    title: 'EPIC - TwiZzyxKanban',
  },
  {
    path: 'admin/users',
    loadComponent: () =>
      import('./pages/admin-users/admin-users').then((m) => m.AdminUsers),
    canActivate: [authGuard, adminGuard],
    title: 'Utilisateurs - TwiZzyxKanban',
  },
  { path: '', pathMatch: 'full', redirectTo: 'board' },
  { path: '**', redirectTo: 'board' },
];

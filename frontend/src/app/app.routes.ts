import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { adminGuard } from './core/admin.guard';
import { kanbanAccessGuard } from './core/kanban-access.guard';
import { kanbanModeratorGuard } from './core/kanban-moderator.guard';
import { kanbanBoardMatcher, kanbanTicketMatcher } from './core/kanban-route-matchers';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
    title: 'Connexion - TwiZzyxKanban',
  },
  {
    path: 'kanbans',
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/kanbans/kanbans-list/kanbans-list').then((m) => m.KanbansList),
        canActivate: [authGuard],
        title: 'Mes Kanbans - TwiZzyxKanban',
      },
      {
        matcher: kanbanTicketMatcher,
        loadComponent: () =>
          import('./pages/tickets/ticket-detail/ticket-detail').then((m) => m.TicketDetail),
        canActivate: [authGuard, kanbanAccessGuard],
        title: 'Ticket - TwiZzyxKanban',
      },
      {
        matcher: kanbanBoardMatcher,
        loadComponent: () => import('./pages/board/board').then((m) => m.Board),
        canActivate: [authGuard, kanbanAccessGuard],
        title: 'Tableau - TwiZzyxKanban',
      },
      {
        path: ':kanbanId/settings',
        loadComponent: () =>
          import('./pages/board/board-settings/board-settings').then((m) => m.BoardSettings),
        canActivate: [authGuard, kanbanModeratorGuard],
        title: 'Paramètres du tableau - TwiZzyxKanban',
      },
      {
        path: ':kanbanId/members',
        loadComponent: () =>
          import('./pages/kanbans/kanban-members/kanban-members').then((m) => m.KanbanMembers),
        canActivate: [authGuard, kanbanModeratorGuard],
        title: 'Membres - TwiZzyxKanban',
      },
      {
        path: ':kanbanId/tickets',
        loadComponent: () =>
          import('./pages/tickets/tickets-list/tickets-list').then((m) => m.TicketsList),
        canActivate: [authGuard, kanbanAccessGuard],
        title: 'Tickets - TwiZzyxKanban',
      },
      {
        path: ':kanbanId/tags',
        loadComponent: () => import('./pages/tags/tags-list/tags-list').then((m) => m.TagsList),
        canActivate: [authGuard, kanbanAccessGuard],
        title: 'Tags - TwiZzyxKanban',
      },
      {
        path: ':kanbanId/tags/:id',
        loadComponent: () => import('./pages/tags/tag-detail/tag-detail').then((m) => m.TagDetail),
        canActivate: [authGuard, kanbanAccessGuard],
        title: 'Tag - TwiZzyxKanban',
      },
      {
        path: ':kanbanId/epics',
        loadComponent: () => import('./pages/epics/epics-list/epics-list').then((m) => m.EpicsList),
        canActivate: [authGuard, kanbanAccessGuard],
        title: 'EPICs - TwiZzyxKanban',
      },
      {
        path: ':kanbanId/epics/:id',
        loadComponent: () => import('./pages/epics/epic-detail/epic-detail').then((m) => m.EpicDetail),
        canActivate: [authGuard, kanbanAccessGuard],
        title: 'EPIC - TwiZzyxKanban',
      },
    ],
  },
  {
    path: 'profile',
    loadComponent: () => import('./pages/profile/profile').then((m) => m.Profile),
    canActivate: [authGuard],
    title: 'Profil - TwiZzyxKanban',
  },
  {
    path: 'admin/users',
    loadComponent: () =>
      import('./pages/admin-users/admin-users').then((m) => m.AdminUsers),
    canActivate: [authGuard, adminGuard],
    title: 'Utilisateurs - TwiZzyxKanban',
  },
  { path: '', pathMatch: 'full', redirectTo: 'kanbans' },
  { path: '**', redirectTo: 'kanbans' },
];

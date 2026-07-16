import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { adminGuard } from './core/admin.guard';
import { kanbanModeratorGuard } from './core/kanban-moderator.guard';
import { kanbanBoardMatcher, kanbanTicketMatcher } from './core/kanban-route-matchers';
import { kanbanResolver } from './core/kanban.resolver';

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
        canActivate: [authGuard],
        resolve: { kanban: kanbanResolver },
        title: 'Ticket - TwiZzyxKanban',
      },
      {
        matcher: kanbanBoardMatcher,
        loadComponent: () => import('./pages/board/board').then((m) => m.Board),
        canActivate: [authGuard],
        resolve: { kanban: kanbanResolver },
        title: 'Tableau - TwiZzyxKanban',
      },
      {
        path: ':kanbanCode/settings',
        loadComponent: () =>
          import('./pages/board/board-settings/board-settings').then((m) => m.BoardSettings),
        canActivate: [authGuard, kanbanModeratorGuard],
        resolve: { kanban: kanbanResolver },
        title: 'Paramètres du tableau - TwiZzyxKanban',
      },
      {
        path: ':kanbanCode/members',
        loadComponent: () =>
          import('./pages/kanbans/kanban-members/kanban-members').then((m) => m.KanbanMembers),
        canActivate: [authGuard, kanbanModeratorGuard],
        resolve: { kanban: kanbanResolver },
        title: 'Membres - TwiZzyxKanban',
      },
      {
        path: ':kanbanCode/tickets',
        loadComponent: () =>
          import('./pages/tickets/tickets-list/tickets-list').then((m) => m.TicketsList),
        canActivate: [authGuard],
        resolve: { kanban: kanbanResolver },
        title: 'Tickets - TwiZzyxKanban',
      },
      {
        path: ':kanbanCode/tags',
        loadComponent: () => import('./pages/tags/tags-list/tags-list').then((m) => m.TagsList),
        canActivate: [authGuard],
        resolve: { kanban: kanbanResolver },
        title: 'Tags - TwiZzyxKanban',
      },
      {
        path: ':kanbanCode/tags/:id',
        loadComponent: () => import('./pages/tags/tag-detail/tag-detail').then((m) => m.TagDetail),
        canActivate: [authGuard],
        resolve: { kanban: kanbanResolver },
        title: 'Tag - TwiZzyxKanban',
      },
      {
        path: ':kanbanCode/epics',
        loadComponent: () => import('./pages/epics/epics-list/epics-list').then((m) => m.EpicsList),
        canActivate: [authGuard],
        resolve: { kanban: kanbanResolver },
        title: 'EPICs - TwiZzyxKanban',
      },
      {
        path: ':kanbanCode/epics/:id',
        loadComponent: () => import('./pages/epics/epic-detail/epic-detail').then((m) => m.EpicDetail),
        canActivate: [authGuard],
        resolve: { kanban: kanbanResolver },
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

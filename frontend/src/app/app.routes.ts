import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { adminGuard } from './core/admin.guard';
import { kanbanAccessGuard } from './core/kanban-access.guard';
import { kanbanModeratorGuard } from './core/kanban-moderator.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
    title: 'Connexion - TwiZzyxKanban',
  },
  {
    path: 'kanbans',
    loadComponent: () => import('./pages/kanbans/kanbans-list/kanbans-list').then((m) => m.KanbansList),
    canActivate: [authGuard],
    title: 'Mes Kanbans - TwiZzyxKanban',
  },
  {
    path: 'kanbans/:kanbanId',
    loadComponent: () => import('./pages/kanbans/kanban-shell/kanban-shell').then((m) => m.KanbanShell),
    canActivate: [authGuard, kanbanAccessGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'board' },
      {
        path: 'board',
        loadComponent: () => import('./pages/board/board').then((m) => m.Board),
        title: 'Tableau - TwiZzyxKanban',
      },
      {
        path: 'board/settings',
        loadComponent: () =>
          import('./pages/board/board-settings/board-settings').then((m) => m.BoardSettings),
        canActivate: [kanbanModeratorGuard],
        title: 'Paramètres du tableau - TwiZzyxKanban',
      },
      {
        path: 'members',
        loadComponent: () =>
          import('./pages/kanbans/kanban-members/kanban-members').then((m) => m.KanbanMembers),
        canActivate: [kanbanModeratorGuard],
        title: 'Membres - TwiZzyxKanban',
      },
      {
        path: 'tickets',
        loadComponent: () =>
          import('./pages/tickets/tickets-list/tickets-list').then((m) => m.TicketsList),
        title: 'Tickets - TwiZzyxKanban',
      },
      {
        path: 'tickets/:id',
        loadComponent: () =>
          import('./pages/tickets/ticket-detail/ticket-detail').then((m) => m.TicketDetail),
        title: 'Ticket - TwiZzyxKanban',
      },
      {
        path: 'tags',
        loadComponent: () => import('./pages/tags/tags-list/tags-list').then((m) => m.TagsList),
        title: 'Tags - TwiZzyxKanban',
      },
      {
        path: 'tags/:id',
        loadComponent: () => import('./pages/tags/tag-detail/tag-detail').then((m) => m.TagDetail),
        title: 'Tag - TwiZzyxKanban',
      },
      {
        path: 'epics',
        loadComponent: () => import('./pages/epics/epics-list/epics-list').then((m) => m.EpicsList),
        title: 'EPICs - TwiZzyxKanban',
      },
      {
        path: 'epics/:id',
        loadComponent: () => import('./pages/epics/epic-detail/epic-detail').then((m) => m.EpicDetail),
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

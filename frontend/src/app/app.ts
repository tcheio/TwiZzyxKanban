import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from './core/auth.service';
import { EpicsService } from './services/board/epics.service';
import { Kanban } from './models/kanban.model';
import { Epic } from './models/epic.model';
import { epicDotClass } from './shared/epic-colors';
import { kanbanInitials } from './shared/kanban-initials';
import { kanbanLogoClass } from './shared/kanban-colors';
import { KanbansService } from './services/board/kanbans.service';
import { GlobalSearch } from './shared/global-search/global-search';
import { ThemeToggle } from './shared/theme-toggle/theme-toggle';
import { NotificationsBell } from './shared/notifications-bell/notifications-bell';
import { AnnouncementsBanner } from './shared/announcements-banner/announcements-banner';
import { APP_VERSION } from './shared/version';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, GlobalSearch, ThemeToggle, NotificationsBell, AnnouncementsBanner],
  templateUrl: './app.html',
})
export class App implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly epicsService = inject(EpicsService);
  private readonly kanbansService = inject(KanbansService);

  readonly sidebarCollapsed = signal(false);
  readonly epicDotClass = epicDotClass;
  readonly kanbanInitials = kanbanInitials;
  readonly kanbanLogoClass = kanbanLogoClass;
  readonly appVersion = APP_VERSION;

  readonly currentKanban = signal<Kanban | null>(null);
  readonly epics = signal<Epic[]>([]);

  constructor(
    protected readonly authService: AuthService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this.syncKanbanContext());
    this.syncKanbanContext();

    // Changement fait depuis les paramètres du tableau (ex. couleur du logo) : on met à
    // jour la barre latérale tout de suite, sans attendre une navigation.
    this.kanbansService.kanbanUpdated
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((updated) => {
        const current = this.currentKanban();
        if (current?.id === updated.id) {
          this.currentKanban.set({ ...current, ...updated, is_moderator: current.is_moderator });
        }
      });
  }

  private syncKanbanContext(): void {
    let route = this.route.root;
    while (route.firstChild) {
      route = route.firstChild;
    }
    const kanban = (route.snapshot.data['kanban'] as Kanban | undefined) ?? null;

    const sameKanban = kanban?.id === this.currentKanban()?.id;
    this.currentKanban.set(kanban);
    if (sameKanban) return;

    if (kanban === null) {
      this.epics.set([]);
      return;
    }

    this.epicsService.list(kanban.id).then((epics) => this.epics.set(epics));
  }

  goToKanbansList(): void {
    this.router.navigate(['/kanbans']);
  }

  toggleSidebar(): void {
    this.sidebarCollapsed.update((collapsed) => !collapsed);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  userInitial(): string {
    const username = this.authService.currentUser()?.username;
    return username ? username.charAt(0).toUpperCase() : '?';
  }
}

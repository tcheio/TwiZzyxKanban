import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from './core/auth.service';
import { EpicsService } from './services/epics.service';
import { Kanban } from './models/kanban.model';
import { Epic } from './models/epic.model';
import { epicDotClass } from './shared/epic-colors';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
})
export class App implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly epicsService = inject(EpicsService);

  readonly sidebarCollapsed = signal(false);
  readonly epicDotClass = epicDotClass;

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
  }

  private syncKanbanContext(): void {
    let route = this.route.root;
    while (route.firstChild) {
      route = route.firstChild;
    }
    const kanban = (route.snapshot.data['kanban'] as Kanban | undefined) ?? null;

    if (kanban?.id === this.currentKanban()?.id) return;
    this.currentKanban.set(kanban);

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

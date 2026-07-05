import { Component, effect, signal } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from './core/auth.service';
import { EpicsService } from './services/epics.service';
import { Epic } from './models/epic.model';
import { epicDotClass } from './shared/epic-colors';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
})
export class App {
  readonly epics = signal<Epic[]>([]);
  readonly epicDotClass = epicDotClass;

  constructor(
    protected readonly authService: AuthService,
    private readonly router: Router,
    private readonly epicsService: EpicsService
  ) {
    effect(() => {
      if (this.authService.isLoggedIn()) {
        this.epicsService.list().then((epics) => this.epics.set(epics));
      }
    });
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

import { Component, signal } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from './core/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
})
export class App {
  readonly sidebarCollapsed = signal(false);

  constructor(
    protected readonly authService: AuthService,
    private readonly router: Router
  ) {}

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

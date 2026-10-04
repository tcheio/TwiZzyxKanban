import { Component, HostListener, inject, signal } from '@angular/core';
import { ThemeMode, ThemeService } from '../../core/theme.service';

interface ThemeOption {
  mode: ThemeMode;
  label: string;
  icon: string;
}

const THEME_OPTIONS: ThemeOption[] = [
  { mode: 'light', label: 'Jour', icon: '☀️' },
  { mode: 'dark', label: 'Nuit', icon: '🌙' },
  { mode: 'system', label: "Système", icon: '🖥️' },
  { mode: 'schedule', label: 'Automatique', icon: '🕒' },
];

@Component({
  selector: 'app-theme-toggle',
  imports: [],
  templateUrl: './theme-toggle.html',
})
export class ThemeToggle {
  protected readonly themeService = inject(ThemeService);

  readonly open = signal(false);
  readonly options = THEME_OPTIONS;

  toggle(): void {
    this.open.set(!this.open());
  }

  select(mode: ThemeMode): void {
    this.themeService.setMode(mode);
    this.open.set(false);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.open.set(false);
  }
}

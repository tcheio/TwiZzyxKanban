import { Injectable, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system' | 'schedule';

const STORAGE_KEY = 'kanban_theme_mode';
const DEFAULT_MODE: ThemeMode = 'light';

// "Horaire" : jour de 8h (inclus) à 19h (exclu), nuit le reste du temps.
const DAY_START_HOUR = 8;
const DAY_END_HOUR = 19;
const SCHEDULE_CHECK_INTERVAL_MS = 60_000;

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system' || value === 'schedule';
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly modeSignal = signal<ThemeMode>(this.readStoredMode());
  readonly mode = this.modeSignal.asReadonly();

  // Thème réellement appliqué (résolu depuis le mode) : utile pour l'icône du bouton.
  readonly isDark = signal(document.documentElement.classList.contains('dark'));

  private mediaQuery: MediaQueryList | null = null;
  private scheduleInterval: ReturnType<typeof setInterval> | null = null;
  private readonly onSystemChange = (event: MediaQueryListEvent): void => this.setDark(event.matches);

  constructor() {
    this.applyMode(this.modeSignal());
  }

  setMode(mode: ThemeMode): void {
    this.modeSignal.set(mode);
    localStorage.setItem(STORAGE_KEY, mode);
    this.applyMode(mode);
  }

  private applyMode(mode: ThemeMode): void {
    this.teardownWatchers();
    switch (mode) {
      case 'light':
        this.setDark(false);
        return;
      case 'dark':
        this.setDark(true);
        return;
      case 'system':
        this.watchSystem();
        return;
      case 'schedule':
        this.watchSchedule();
        return;
    }
  }

  private watchSystem(): void {
    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.setDark(this.mediaQuery.matches);
    this.mediaQuery.addEventListener('change', this.onSystemChange);
  }

  private watchSchedule(): void {
    this.updateFromSchedule();
    // Se recale tout seul si l'onglet reste ouvert au moment où on franchit 8h/19h.
    this.scheduleInterval = setInterval(() => this.updateFromSchedule(), SCHEDULE_CHECK_INTERVAL_MS);
  }

  private updateFromSchedule(): void {
    const hour = new Date().getHours();
    const isDaytime = hour >= DAY_START_HOUR && hour < DAY_END_HOUR;
    this.setDark(!isDaytime);
  }

  private teardownWatchers(): void {
    if (this.mediaQuery) {
      this.mediaQuery.removeEventListener('change', this.onSystemChange);
      this.mediaQuery = null;
    }
    if (this.scheduleInterval) {
      clearInterval(this.scheduleInterval);
      this.scheduleInterval = null;
    }
  }

  private setDark(dark: boolean): void {
    this.isDark.set(dark);
    document.documentElement.classList.toggle('dark', dark);
  }

  private readStoredMode(): ThemeMode {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isThemeMode(stored) ? stored : DEFAULT_MODE;
  }
}

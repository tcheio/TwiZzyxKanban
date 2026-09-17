import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let mediaQueryListeners: Array<(event: MediaQueryListEvent) => void>;
  let matches: boolean;

  function createService(): ThemeService {
    TestBed.resetTestingModule();
    return TestBed.inject(ThemeService);
  }

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    mediaQueryListeners = [];
    matches = false;
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches,
        media: query,
        addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
          mediaQueryListeners.push(listener);
        },
        removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
          mediaQueryListeners = mediaQueryListeners.filter((l) => l !== listener);
        },
      }))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    document.documentElement.classList.remove('dark');
  });

  it('démarre en mode "light" par défaut (aucune préférence enregistrée)', () => {
    const service = createService();

    expect(service.mode()).toBe('light');
    expect(service.isDark()).toBe(false);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('reprend le mode précédemment enregistré au démarrage', () => {
    localStorage.setItem('kanban_theme_mode', 'dark');

    const service = createService();

    expect(service.mode()).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('ignore une valeur invalide en localStorage et retombe sur "light"', () => {
    localStorage.setItem('kanban_theme_mode', 'sepia');

    const service = createService();

    expect(service.mode()).toBe('light');
  });

  it('setMode("dark") applique la classe .dark et persiste le choix', () => {
    const service = createService();

    service.setMode('dark');

    expect(service.isDark()).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('kanban_theme_mode')).toBe('dark');
  });

  it('setMode("light") retire la classe .dark', () => {
    const service = createService();
    service.setMode('dark');

    service.setMode('light');

    expect(service.isDark()).toBe(false);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('setMode("system") suit la préférence système, y compris ses changements ultérieurs', () => {
    matches = true;
    const service = createService();

    service.setMode('system');
    expect(service.isDark()).toBe(true);

    mediaQueryListeners.forEach((listener) => listener({ matches: false } as MediaQueryListEvent));
    expect(service.isDark()).toBe(false);
  });

  it('setMode("schedule") applique le clair de 8h à 19h et le sombre en dehors', () => {
    const service = createService();
    vi.useFakeTimers();

    vi.setSystemTime(new Date('2026-01-01T12:00:00'));
    service.setMode('schedule');
    expect(service.isDark()).toBe(false);

    // La vérification périodique (chaque minute) doit rattraper un changement d'heure
    // pendant que l'onglet reste ouvert, sans qu'on ait besoin de rappeler setMode().
    vi.setSystemTime(new Date('2026-01-01T22:00:00'));
    vi.advanceTimersByTime(60_000);
    expect(service.isDark()).toBe(true);

    vi.setSystemTime(new Date('2026-01-02T08:00:00'));
    vi.advanceTimersByTime(60_000);
    expect(service.isDark()).toBe(false);
  });

  it('changer de mode désabonne les écouteurs du mode "system" précédent', () => {
    const service = createService();
    service.setMode('system');
    expect(mediaQueryListeners.length).toBe(1);

    service.setMode('light');
    expect(mediaQueryListeners.length).toBe(0);
  });
});

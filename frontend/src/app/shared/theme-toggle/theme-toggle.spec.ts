import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ThemeToggle } from './theme-toggle';
import { ThemeService } from '../../core/theme.service';

describe('ThemeToggle', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<ThemeToggle>>;
  let component: ThemeToggle;
  let setMode: ReturnType<typeof vi.fn>;
  let mode: ReturnType<typeof vi.fn>;
  let isDark: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setMode = vi.fn();
    mode = vi.fn().mockReturnValue('light');
    isDark = vi.fn().mockReturnValue(false);

    TestBed.configureTestingModule({
      imports: [ThemeToggle],
      providers: [{ provide: ThemeService, useValue: { setMode, mode, isDark } }],
    });
    fixture = TestBed.createComponent(ThemeToggle);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('le panneau est fermé par défaut', () => {
    expect(component.open()).toBe(false);
  });

  it('toggle() ouvre puis referme le panneau', () => {
    component.toggle();
    expect(component.open()).toBe(true);

    component.toggle();
    expect(component.open()).toBe(false);
  });

  it('select() applique le mode choisi et referme le panneau', () => {
    component.toggle();

    component.select('dark');

    expect(setMode).toHaveBeenCalledWith('dark');
    expect(component.open()).toBe(false);
  });

  it('un clic en dehors (document) referme le panneau', () => {
    component.toggle();
    expect(component.open()).toBe(true);

    component.onDocumentClick();

    expect(component.open()).toBe(false);
  });

  it('expose les 4 options de thème', () => {
    expect(component.options.map((o) => o.mode)).toEqual(['light', 'dark', 'system', 'schedule']);
  });
});

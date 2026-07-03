import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SearchSelect, SearchSelectOption } from './search-select';

describe('SearchSelect', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<SearchSelect<number>>>;
  let component: SearchSelect<number>;

  const options: SearchSelectOption<number>[] = [
    { id: 1, label: 'Minecraft', badgeClass: 'bg-sky-50 text-sky-700' },
    { id: 2, label: 'Pokémon', badgeClass: 'bg-emerald-50 text-emerald-700' },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SearchSelect] });
    fixture = TestBed.createComponent(SearchSelect<number>);
    component = fixture.componentInstance;
    component.options = options;
    component.nullLabel = '— Aucun tag —';
    fixture.detectChanges();
  });

  it('selected est undefined tant que value est null et affiche le libellé nul', () => {
    expect(component.value).toBeNull();
    expect(component.selected).toEqual({ id: null, label: '— Aucun tag —' });
  });

  it('selected résout l\'option correspondant à value', () => {
    component.value = 2;
    expect(component.selected?.label).toBe('Pokémon');
  });

  it('filteredEntries() inclut l\'option "aucun" par défaut et filtre selon la recherche', () => {
    expect(component.filteredEntries().map((e) => e.label)).toEqual([
      '— Aucun tag —',
      'Minecraft',
      'Pokémon',
    ]);

    component.query.set('pok');
    expect(component.filteredEntries().map((e) => e.label)).toEqual(['Pokémon']);
  });

  it('filteredEntries() masque l\'option "aucun" quand allowNull est false', () => {
    component.allowNull = false;
    expect(component.filteredEntries().map((e) => e.label)).toEqual(['Minecraft', 'Pokémon']);
  });

  it('toggle() ouvre et ferme le panneau, et réinitialise la recherche à l\'ouverture', () => {
    component.query.set('poke');
    expect(component.open()).toBe(false);

    component.toggle();
    expect(component.open()).toBe(true);
    expect(component.query()).toBe('');

    component.toggle();
    expect(component.open()).toBe(false);
  });

  it('choose() émet l\'id sélectionné et ferme le panneau', () => {
    const emitted: (number | null)[] = [];
    component.valueChange.subscribe((v) => emitted.push(v));
    component.toggle();

    component.choose({ id: 2, label: 'Pokémon' });

    expect(emitted).toEqual([2]);
    expect(component.open()).toBe(false);
  });

  it('choose() avec l\'entrée "aucun" émet null', () => {
    const emitted: (number | null)[] = [];
    component.valueChange.subscribe((v) => emitted.push(v));

    component.choose({ id: null, label: component.nullLabel });

    expect(emitted).toEqual([null]);
  });

  it('onEscape() ferme le panneau', () => {
    component.toggle();
    expect(component.open()).toBe(true);

    component.onEscape();
    expect(component.open()).toBe(false);
  });

  it('onDocumentClick() ferme le panneau pour un clic en dehors du composant', () => {
    component.toggle();
    const outsideTarget = document.createElement('div');
    document.body.appendChild(outsideTarget);

    component.onDocumentClick({ target: outsideTarget } as unknown as MouseEvent);

    expect(component.open()).toBe(false);
    outsideTarget.remove();
  });

  it('onDocumentClick() ne ferme pas le panneau pour un clic à l\'intérieur du composant', () => {
    component.toggle();
    const insideTarget = fixture.nativeElement.querySelector('button') as HTMLElement;

    component.onDocumentClick({ target: insideTarget } as unknown as MouseEvent);

    expect(component.open()).toBe(true);
  });

  it('toggle() place le focus sur le champ de recherche à l\'ouverture', async () => {
    vi.useFakeTimers();
    component.toggle();
    fixture.detectChanges();

    vi.runAllTimers();
    vi.useRealTimers();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(document.activeElement).toBe(input);
  });
});

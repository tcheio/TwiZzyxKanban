import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

// Sélecteur de période réutilisable (presets + 2 dates) : le composant n'a pas d'état
// propre, il se contente d'émettre `from`/`to` (format "YYYY-MM-DD") — à l'appelant de
// décider quoi en faire (filtrer des données déjà chargées, ou relancer une requête).
@Component({
  selector: 'app-period-filter',
  imports: [FormsModule],
  templateUrl: './period-filter.html',
})
export class PeriodFilter {
  @Input() from: string | null = null;
  @Input() to: string | null = null;
  @Output() fromChange = new EventEmitter<string | null>();
  @Output() toChange = new EventEmitter<string | null>();

  setFrom(value: string): void {
    this.fromChange.emit(value || null);
  }

  setTo(value: string): void {
    this.toChange.emit(value || null);
  }

  applyPreset(days: number | null): void {
    if (days === null) {
      this.fromChange.emit(null);
      this.toChange.emit(null);
      return;
    }
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    this.toChange.emit(this.toDateInputValue(to));
    this.fromChange.emit(this.toDateInputValue(from));
  }

  // Année civile en cours entière (1er janvier → 31 décembre), pas "les 365 derniers
  // jours" — contrairement aux presets 7j/30j/90j qui se terminent aujourd'hui.
  applyCurrentYear(): void {
    const year = new Date().getFullYear();
    this.fromChange.emit(`${year}-01-01`);
    this.toChange.emit(`${year}-12-31`);
  }

  private toDateInputValue(date: Date): string {
    return date.toISOString().slice(0, 10);
  }
}

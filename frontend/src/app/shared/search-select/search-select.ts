import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface SearchSelectOption<T> {
  id: T;
  label: string;
  badgeClass?: string;
  dotClass?: string;
  avatarUrl?: string | null;
  avatarInitial?: string;
}

interface SearchSelectEntry<T> {
  id: T | null;
  label: string;
  badgeClass?: string;
  dotClass?: string;
  avatarUrl?: string | null;
  avatarInitial?: string;
}

@Component({
  selector: 'app-search-select',
  imports: [FormsModule],
  templateUrl: './search-select.html',
})
export class SearchSelect<T extends string | number> {
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  @Input() options: SearchSelectOption<T>[] = [];
  @Input() value: T | null = null;
  @Input() nullLabel = '— Aucun —';
  @Input() allowNull = true;
  @Input() disabled = false;
  @Input() fullWidth = false;
  @Input() searchPlaceholder = 'Rechercher...';
  @Input() triggerClass?: string;
  @Input() panelClass = 'w-56';
  @Output() valueChange = new EventEmitter<T | null>();

  readonly defaultTriggerClass = 'max-w-full rounded px-1.5 py-1 text-gray-800 hover:bg-gray-100';

  @ViewChild('searchInput') private searchInputRef?: ElementRef<HTMLInputElement>;

  readonly open = signal(false);
  readonly query = signal('');

  get selected(): SearchSelectEntry<T> | undefined {
    if (this.value === null) {
      return this.allowNull ? { id: null, label: this.nullLabel } : undefined;
    }
    return this.options.find((o) => o.id === this.value);
  }

  filteredEntries(): SearchSelectEntry<T>[] {
    const entries: SearchSelectEntry<T>[] = this.allowNull
      ? [{ id: null, label: this.nullLabel }, ...this.options]
      : this.options;
    const q = this.query().trim().toLowerCase();
    return q ? entries.filter((e) => e.label.toLowerCase().includes(q)) : entries;
  }

  toggle(): void {
    if (this.disabled) return;
    if (this.open()) {
      this.close();
      return;
    }
    this.open.set(true);
    this.query.set('');
    setTimeout(() => this.searchInputRef?.nativeElement.focus());
  }

  close(): void {
    this.open.set(false);
  }

  choose(entry: SearchSelectEntry<T>): void {
    this.valueChange.emit(entry.id);
    this.close();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.elementRef.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }
}

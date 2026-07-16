import { Component, ElementRef, HostListener, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SearchService } from '../../services/search.service';
import { TicketSearchResult } from '../../models/search-result.model';

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;

@Component({
  selector: 'app-global-search',
  imports: [FormsModule],
  templateUrl: './global-search.html',
})
export class GlobalSearch {
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly searchService = inject(SearchService);
  private readonly router = inject(Router);
  private debounceHandle: ReturnType<typeof setTimeout> | null = null;
  private requestId = 0;

  readonly query = signal('');
  readonly results = signal<TicketSearchResult[]>([]);
  readonly loading = signal(false);
  readonly open = signal(false);

  onQueryChange(value: string): void {
    this.query.set(value);
    this.open.set(true);

    if (this.debounceHandle) {
      clearTimeout(this.debounceHandle);
    }

    const trimmed = value.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      this.results.set([]);
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.debounceHandle = setTimeout(() => this.runSearch(trimmed), DEBOUNCE_MS);
  }

  private async runSearch(query: string): Promise<void> {
    const currentRequestId = ++this.requestId;
    try {
      const results = await this.searchService.searchTickets(query);
      if (currentRequestId !== this.requestId) return;
      this.results.set(results);
    } catch {
      if (currentRequestId !== this.requestId) return;
      this.results.set([]);
    } finally {
      if (currentRequestId === this.requestId) {
        this.loading.set(false);
      }
    }
  }

  onFocus(): void {
    if (this.query().trim().length >= MIN_QUERY_LENGTH) {
      this.open.set(true);
    }
  }

  select(result: TicketSearchResult): void {
    this.close();
    this.query.set('');
    this.results.set([]);
    this.router.navigate(['/kanbans', result.key]);
  }

  private close(): void {
    this.open.set(false);
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

import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnInit,
  Output,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { Emote, EmotesService } from '../../services/emotes.service';

@Component({
  selector: 'app-emote-picker',
  imports: [],
  templateUrl: './emote-picker.html',
})
export class EmotePicker implements OnInit {
  private readonly emotesService = inject(EmotesService);
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  @Input() value: string | null = null;
  @Output() valueChange = new EventEmitter<string | null>();

  @ViewChild('trigger') private readonly triggerRef?: ElementRef<HTMLButtonElement>;

  readonly emotes = signal<Emote[]>([]);
  readonly open = signal(false);
  // Position calculée dynamiquement (position: fixed) plutôt qu'un simple `absolute` :
  // le picker est utilisé dans des listes avec `overflow-hidden` (lignes de tags/EPICs)
  // qui, sinon, rognent le panneau déroulant au lieu de le laisser dépasser.
  readonly panelPosition = signal({ top: 0, left: 0 });

  async ngOnInit(): Promise<void> {
    try {
      this.emotes.set(await this.emotesService.list());
    } catch {
      this.emotes.set([]);
    }
  }

  get selectedLabel(): string | null {
    return this.emotes().find((e) => e.path === this.value)?.label ?? null;
  }

  toggle(): void {
    if (!this.open()) {
      const rect = this.triggerRef?.nativeElement.getBoundingClientRect();
      if (rect) {
        this.panelPosition.set({ top: rect.bottom + 4, left: rect.left });
      }
    }
    this.open.update((o) => !o);
  }

  choose(path: string | null): void {
    this.value = path;
    this.valueChange.emit(path);
    this.open.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.elementRef.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.open.set(false);
  }
}

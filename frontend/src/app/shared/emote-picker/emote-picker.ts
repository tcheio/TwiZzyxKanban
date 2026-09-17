import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnInit,
  Output,
  inject,
  signal,
} from '@angular/core';
import { TagEmote, TagEmotesService } from '../../services/tag-emotes.service';

@Component({
  selector: 'app-emote-picker',
  imports: [],
  templateUrl: './emote-picker.html',
})
export class EmotePicker implements OnInit {
  private readonly tagEmotesService = inject(TagEmotesService);
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  @Input() value: string | null = null;
  @Output() valueChange = new EventEmitter<string | null>();

  readonly emotes = signal<TagEmote[]>([]);
  readonly open = signal(false);

  async ngOnInit(): Promise<void> {
    try {
      this.emotes.set(await this.tagEmotesService.list());
    } catch {
      this.emotes.set([]);
    }
  }

  get selectedLabel(): string | null {
    return this.emotes().find((e) => e.path === this.value)?.label ?? null;
  }

  toggle(): void {
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

import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  effect,
  inject,
} from '@angular/core';
import { Chart, ChartType, registerables } from 'chart.js';
import { ThemeService } from '../../core/theme.service';

Chart.register(...registerables);

const PALETTE = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7', '#84cc16', '#ec4899'];
// Chart.js ne connaît pas nos variables CSS : ces deux couleurs de texte/grille doivent
// rester alignées "à la main" avec --color-text-muted et --color-border (styles.css).
const TEXT_COLOR = { light: '#6b7280', dark: '#a1a1aa' };
const GRID_COLOR = { light: '#e5e7eb', dark: '#35353f' };

@Component({
  selector: 'app-chart',
  imports: [],
  templateUrl: './chart.html',
  host: { class: 'block relative max-w-xs' },
})
export class ChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  private readonly themeService = inject(ThemeService);

  @Input({ required: true }) type: ChartType = 'bar';
  @Input({ required: true }) labels: string[] = [];
  @Input({ required: true }) data: number[] = [];
  @Input() label = '';

  @ViewChild('canvas') private readonly canvasRef!: ElementRef<HTMLCanvasElement>;

  private chart: Chart | null = null;
  private viewReady = false;

  constructor() {
    // Redessine le graphique quand le thème change, pour que le texte/la grille restent
    // lisibles (Chart.js peint sur un <canvas>, il ne suit pas les variables CSS seul).
    effect(() => {
      this.themeService.isDark();
      if (this.viewReady) this.render();
    });
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.render();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.viewReady) return;
    if (changes['type'] || changes['labels'] || changes['data'] || changes['label']) {
      this.render();
    }
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private render(): void {
    this.chart?.destroy();
    const dark = this.themeService.isDark();
    const textColor = dark ? TEXT_COLOR.dark : TEXT_COLOR.light;
    const gridColor = dark ? GRID_COLOR.dark : GRID_COLOR.light;

    this.chart = new Chart(this.canvasRef.nativeElement, {
      type: this.type,
      data: {
        labels: this.labels,
        datasets: [
          {
            label: this.label,
            data: this.data,
            backgroundColor: this.labels.map((_, i) => PALETTE[i % PALETTE.length]),
          },
        ],
      },
      options: {
        responsive: true,
        color: textColor,
        plugins: {
          legend: { display: this.type !== 'bar', labels: { color: textColor } },
        },
        scales:
          this.type === 'bar'
            ? {
                x: { ticks: { color: textColor }, grid: { color: gridColor } },
                y: { beginAtZero: true, ticks: { stepSize: 1, color: textColor }, grid: { color: gridColor } },
              }
            : undefined,
      },
    });
  }
}

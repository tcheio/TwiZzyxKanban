import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { Chart, ChartType, registerables } from 'chart.js';

Chart.register(...registerables);

const PALETTE = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7', '#84cc16', '#ec4899'];

@Component({
  selector: 'app-chart',
  imports: [],
  templateUrl: './chart.html',
  styleUrl: './chart.css',
})
export class ChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) type: ChartType = 'bar';
  @Input({ required: true }) labels: string[] = [];
  @Input({ required: true }) data: number[] = [];
  @Input() label = '';

  @ViewChild('canvas') private canvasRef!: ElementRef<HTMLCanvasElement>;

  private chart: Chart | null = null;
  private viewReady = false;

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
        plugins: {
          legend: { display: this.type !== 'bar' },
        },
        scales: this.type === 'bar' ? { y: { beginAtZero: true, ticks: { stepSize: 1 } } } : undefined,
      },
    });
  }
}

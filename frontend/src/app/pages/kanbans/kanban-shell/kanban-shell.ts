import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { KanbansService } from '../../../services/kanbans.service';
import { EpicsService } from '../../../services/epics.service';
import { Kanban } from '../../../models/kanban.model';
import { Epic } from '../../../models/epic.model';
import { epicDotClass } from '../../../shared/epic-colors';

@Component({
  selector: 'app-kanban-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './kanban-shell.html',
})
export class KanbanShell implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly kanbansService = inject(KanbansService);
  private readonly epicsService = inject(EpicsService);

  readonly epicDotClass = epicDotClass;
  readonly kanbanId = Number(this.route.snapshot.paramMap.get('kanbanId'));
  readonly kanban = signal<Kanban | null>(null);
  readonly epics = signal<Epic[]>([]);

  async ngOnInit(): Promise<void> {
    const kanbans = await this.kanbansService.list();
    const kanban = kanbans.find((k) => k.id === this.kanbanId) ?? null;
    if (!kanban) {
      this.router.navigate(['/kanbans']);
      return;
    }
    this.kanban.set(kanban);
    this.epics.set(await this.epicsService.list(this.kanbanId));
  }
}

import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimelineService } from '../../../../core/services/timeline.service';
import { TimelineEntry } from '../../../../core/models/sentinel.models';

@Component({
  selector: 'app-machine-timeline',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="timeline">
      <div class="entry" *ngFor="let e of entries.slice(0, visibleCount)">
        <span class="entry__dot entry__dot--{{ dotClass(e.category) }}"></span>
        <div class="entry__body">
          <div class="entry__head">
            <strong>{{ e.title }}</strong>
            <time>{{ e.timestamp | date:'short' }}</time>
          </div>
          <p *ngIf="e.description">{{ e.description }}</p>
          <span class="entry__actor" *ngIf="e.actor">{{ e.actor }}</span>
        </div>
      </div>
      <p class="empty" *ngIf="!isLoading && entries.length === 0">No activity recorded yet.</p>
      <button type="button" class="more" *ngIf="entries.length > visibleCount" (click)="visibleCount = visibleCount + 10">
        Show more
      </button>
    </div>
  `,
  styles: [`
    .timeline { display: flex; flex-direction: column; gap: 10px; max-height: 420px; overflow-y: auto; }
    .entry { display: flex; gap: 8px; }
    .entry__dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 5px; flex-shrink: 0; background: #94a3b8; }
    .entry__dot--maintenance { background: #4f7cff; }
    .entry__dot--alert { background: #f97066; }
    .entry__dot--audit { background: #a78bfa; }
    .entry__dot--comment { background: #22c55e; }
    .entry__body { flex: 1; min-width: 0; }
    .entry__head { display: flex; justify-content: space-between; gap: 8px; }
    .entry__head strong { font-size: 12px; color: var(--text-primary); }
    .entry__head time { font-size: 10px; color: var(--text-tertiary); white-space: nowrap; }
    .entry__body p { margin: 2px 0 0; font-size: 11.5px; color: var(--text-secondary); }
    .entry__actor { font-size: 10px; color: var(--text-tertiary); }
    .empty { font-size: 12px; color: var(--text-tertiary); margin: 0; }
    .more { align-self: center; background: none; border: none; color: var(--accent, #4f7cff); font-size: 11px; font-weight: 600; cursor: pointer; }
  `],
})
export class MachineTimelineComponent implements OnChanges {
  @Input() machineId!: number;

  entries: TimelineEntry[] = [];
  isLoading = true;
  visibleCount = 10;

  constructor(private timelineService: TimelineService) {}

  ngOnChanges(): void {
    if (this.machineId) this.load();
  }

  private load(): void {
    this.isLoading = true;
    this.timelineService.forMachine(this.machineId).subscribe({
      next: (entries) => { this.entries = entries; this.isLoading = false; },
      error: () => { this.isLoading = false; },
    });
  }

  dotClass(category: string): string {
    if (category.startsWith('MAINTENANCE')) return 'maintenance';
    if (category === 'ALERT') return 'alert';
    if (category === 'AUDIT') return 'audit';
    if (category === 'COMMENT') return 'comment';
    return 'default';
  }
}

import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { TwinTimelineEvent } from '../digital-twin.types';

@Component({
  selector: 'app-twin-event-timeline',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div class="timeline">
      <p class="timeline__title">Machine Event Timeline</p>
      <div class="timeline__track">
        <div class="timeline__line"></div>
        <div class="timeline__event" *ngFor="let e of events" [class]="'timeline__event--' + e.kind">
          <span class="timeline__dot"><lucide-icon [name]="iconFor(e.kind)" [size]="11"></lucide-icon></span>
          <div class="timeline__card">
            <span class="timeline__time">{{ e.timeLabel }}</span>
            <strong class="timeline__event-title">{{ e.title }}</strong>
            <p class="timeline__desc">{{ e.description }}</p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .timeline__title {
      margin: 0 0 12px;
      font-size: 10.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-tertiary);
    }

    .timeline__track {
      position: relative;
      display: flex;
      gap: 18px;
      overflow-x: auto;
      padding-bottom: 6px;
      scrollbar-width: thin;
    }

    .timeline__line {
      position: absolute;
      left: 0;
      right: 0;
      top: 11px;
      height: 2px;
      background: linear-gradient(90deg, var(--border-bright), var(--border-dim));
    }

    .timeline__event {
      position: relative;
      flex: 0 0 200px;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }

    .timeline__dot {
      position: relative;
      z-index: 1;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg-panel);
      border: 2px solid var(--accent-cyan);
      color: var(--accent-cyan);
    }

    .timeline__event--start .timeline__dot { border-color: var(--accent-green); color: var(--accent-green); }
    .timeline__event--warning .timeline__dot { border-color: var(--accent-amber); color: var(--accent-amber); }
    .timeline__event--anomaly .timeline__dot { border-color: var(--accent-danger); color: var(--accent-danger); }
    .timeline__event--stabilized .timeline__dot { border-color: var(--accent-green); color: var(--accent-green); }
    .timeline__event--maintenance .timeline__dot { border-color: var(--accent-violet); color: var(--accent-violet); }

    .timeline__card {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .timeline__time {
      font-family: var(--font-mono);
      font-size: 10px;
      color: var(--text-tertiary);
    }

    .timeline__event-title {
      font-size: 11.5px;
      color: var(--text-primary);
    }

    .timeline__desc {
      margin: 0;
      font-size: 10.5px;
      color: var(--text-secondary);
      line-height: 1.4;
    }
  `],
})
export class TwinEventTimelineComponent {
  @Input() events: TwinTimelineEvent[] = [];

  iconFor(kind: TwinTimelineEvent['kind']): string {
    switch (kind) {
      case 'start': return 'circle-play';
      case 'warning': return 'triangle-alert';
      case 'anomaly': return 'circle-alert';
      case 'stabilized': return 'circle-check';
      case 'maintenance': return 'wrench';
      default: return 'info';
    }
  }
}

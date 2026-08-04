import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-progress-ring',
  standalone: true,
  imports: [CommonModule],
  template: `
    <svg [attr.width]="size" [attr.height]="size" [attr.viewBox]="'0 0 ' + size + ' ' + size" class="progress-ring">
      <circle
        [attr.cx]="size / 2" [attr.cy]="size / 2" [attr.r]="radius"
        fill="none" [attr.stroke]="trackColor" [attr.stroke-width]="strokeWidth"
      ></circle>
      <circle
        [attr.cx]="size / 2" [attr.cy]="size / 2" [attr.r]="radius"
        fill="none" [attr.stroke]="color" [attr.stroke-width]="strokeWidth"
        stroke-linecap="round"
        [attr.stroke-dasharray]="circumference"
        [attr.stroke-dashoffset]="dashOffset"
        class="progress-ring__value"
      ></circle>
    </svg>
  `,
  styles: [`
    :host { display: inline-flex; flex-shrink: 0; }
    .progress-ring { transform: rotate(-90deg); }
    .progress-ring__value { transition: stroke-dashoffset 0.8s cubic-bezier(0.34, 1.56, 0.64, 1); }
  `],
})
export class ProgressRingComponent {
  @Input() percent = 0;
  @Input() size = 56;
  @Input() strokeWidth = 6;
  @Input() color = '#3B82F6';
  @Input() trackColor = 'rgba(255,255,255,0.08)';

  get radius(): number {
    return (this.size - this.strokeWidth) / 2;
  }

  get circumference(): number {
    return 2 * Math.PI * this.radius;
  }

  get dashOffset(): number {
    const clamped = Math.max(0, Math.min(100, this.percent));
    return this.circumference * (1 - clamped / 100);
  }
}

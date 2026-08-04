import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CameraViewMode, ComponentTone, MachineArchetype, TwinComponentKey } from '../../digital-twin.types';

@Component({
  selector: 'app-machine-illustration',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './machine-illustration.component.html',
  styleUrl: './machine-illustration.component.scss',
})
export class MachineIllustrationComponent {
  @Input() archetype: MachineArchetype = 'generic';
  @Input() viewMode: CameraViewMode = 'digitalTwin';
  @Input() heatmapOn = false;
  @Input() isRunning = true;
  @Input() highlightedComponent: TwinComponentKey | null = null;
  @Input() componentTones: Partial<Record<TwinComponentKey, ComponentTone>> = {};
  @Input() componentTemps: Partial<Record<TwinComponentKey, number>> = {};

  @Output() componentClick = new EventEmitter<TwinComponentKey>();

  onPartClick(key: TwinComponentKey): void {
    this.componentClick.emit(key);
  }

  isHighlighted(key: TwinComponentKey): boolean {
    return this.highlightedComponent === key;
  }

  toneColor(key: TwinComponentKey): string {
    switch (this.componentTones[key]) {
      case 'red':
        return 'var(--accent-danger)';
      case 'amber':
        return 'var(--accent-amber)';
      case 'blue':
        return 'var(--accent-cyan)';
      case 'purple':
        return 'var(--accent-violet)';
      default:
        return 'var(--accent-green)';
    }
  }

  heatColor(key: TwinComponentKey): string {
    const temp = this.componentTemps[key] ?? 45;
    if (temp < 35) return '#3b82f6';
    if (temp < 55) return '#22c55e';
    if (temp < 70) return '#f59e0b';
    if (temp < 85) return '#f97316';
    return '#ef4444';
  }

  partStyle(key: TwinComponentKey): Record<string, string> {
    return {
      '--part-color': this.heatmapOn ? this.heatColor(key) : this.toneColor(key),
    };
  }
}

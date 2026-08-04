import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { AnatomyMode, CameraViewMode } from '../digital-twin.types';

interface ModeOption<T extends string> {
  key: T;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-twin-controls',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div class="twin-controls">
      <nav class="anatomy-tabs" aria-label="Machine anatomy view">
        <button
          type="button"
          *ngFor="let tab of anatomyTabs"
          class="anatomy-tab"
          [class.anatomy-tab--active]="anatomyMode === tab.key"
          (click)="anatomyModeChange.emit(tab.key)"
        >
          <lucide-icon [name]="tab.icon" [size]="13"></lucide-icon>
          {{ tab.label }}
        </button>
      </nav>

      <div class="camera-controls">
        <label class="heatmap-toggle">
          <input type="checkbox" [checked]="heatmapOn" (change)="heatmapToggle.emit(!heatmapOn)"/>
          <span class="heatmap-toggle__track"><span class="heatmap-toggle__thumb"></span></span>
          Heat Map
        </label>

        <div class="camera-modes" role="group" aria-label="Camera view">
          <button
            type="button"
            *ngFor="let mode of cameraModes"
            class="camera-mode"
            [class.camera-mode--active]="cameraMode === mode.key"
            [attr.title]="mode.label"
            (click)="cameraModeChange.emit(mode.key)"
          >
            <lucide-icon [name]="mode.icon" [size]="14"></lucide-icon>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .twin-controls {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }

    .anatomy-tabs {
      display: flex;
      gap: 4px;
      background: rgba(148, 163, 184, 0.06);
      border: 1px solid var(--border-dim);
      border-radius: 11px;
      padding: 4px;
      flex-wrap: wrap;
    }

    .anatomy-tab {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 6px 10px;
      border-radius: 8px;
      border: none;
      background: transparent;
      color: var(--text-tertiary);
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
      white-space: nowrap;

      &:hover {
        color: var(--text-secondary);
      }
    }

    .anatomy-tab--active {
      background: rgba(156, 163, 175, 0.16);
      color: var(--text-primary);
      box-shadow: inset 0 0 0 1px var(--border-bright);
    }

    .camera-controls {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .heatmap-toggle {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      font-size: 11px;
      font-weight: 600;
      color: var(--text-secondary);
      cursor: pointer;
      user-select: none;

      input {
        position: absolute;
        opacity: 0;
        width: 0;
        height: 0;
      }
    }

    .heatmap-toggle__track {
      width: 30px;
      height: 17px;
      border-radius: 999px;
      background: rgba(148, 163, 184, 0.2);
      border: 1px solid var(--border-mid);
      position: relative;
      transition: background 0.2s ease;
    }

    .heatmap-toggle__thumb {
      position: absolute;
      top: 1px;
      left: 1px;
      width: 13px;
      height: 13px;
      border-radius: 50%;
      background: var(--text-secondary);
      transition: transform 0.2s ease, background 0.2s ease;
    }

    .heatmap-toggle input:checked + .heatmap-toggle__track {
      background: rgba(245, 158, 11, 0.35);
      border-color: var(--accent-amber);
    }

    .heatmap-toggle input:checked + .heatmap-toggle__track .heatmap-toggle__thumb {
      transform: translateX(13px);
      background: var(--accent-amber);
    }

    .camera-modes {
      display: flex;
      gap: 3px;
      background: rgba(148, 163, 184, 0.06);
      border: 1px solid var(--border-dim);
      border-radius: 11px;
      padding: 4px;
    }

    .camera-mode {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      border: none;
      background: transparent;
      color: var(--text-tertiary);
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover {
        color: var(--text-secondary);
      }
    }

    .camera-mode--active {
      background: rgba(126, 34, 206, 0.16);
      color: var(--accent-violet);
      box-shadow: inset 0 0 0 1px rgba(126, 34, 206, 0.4);
    }

    @media (max-width: 900px) {
      .anatomy-tab span { display: none; }
    }
  `],
})
export class TwinControlsComponent {
  @Input() anatomyMode: AnatomyMode = 'physical';
  @Input() cameraMode: CameraViewMode = 'digitalTwin';
  @Input() heatmapOn = false;

  @Output() anatomyModeChange = new EventEmitter<AnatomyMode>();
  @Output() cameraModeChange = new EventEmitter<CameraViewMode>();
  @Output() heatmapToggle = new EventEmitter<boolean>();

  readonly anatomyTabs: ModeOption<AnatomyMode>[] = [
    { key: 'physical', label: 'Physical', icon: 'box' },
    { key: 'electrical', label: 'Electrical', icon: 'zap' },
    { key: 'hydraulic', label: 'Hydraulic', icon: 'droplets' },
    { key: 'thermal', label: 'Thermal', icon: 'thermometer' },
    { key: 'sensor', label: 'Sensor', icon: 'radio' },
    { key: 'maintenance', label: 'Maintenance', icon: 'wrench' },
  ];

  readonly cameraModes: ModeOption<CameraViewMode>[] = [
    { key: 'physical', label: 'Physical', icon: 'eye' },
    { key: 'wireframe', label: 'Wireframe', icon: 'layers' },
    { key: 'exploded', label: 'Exploded View', icon: 'boxes' },
    { key: 'crossSection', label: 'Cross Section', icon: 'scissors' },
    { key: 'xray', label: 'X-Ray', icon: 'scan' },
    { key: 'thermal', label: 'Thermal', icon: 'flame' },
    { key: 'digitalTwin', label: 'Digital Twin', icon: 'sparkles' },
  ];
}

import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardPreferencesService } from '../../core/services/dashboard-preferences.service';

export interface DashboardWidgetOption {
  id: string;
  label: string;
}

/**
 * Drop-in "Customize" control for a dashboard: lets the user show/hide
 * widget sections, persisted per-user via DashboardPreferencesService.
 * The host dashboard wraps each widget section in
 * *ngIf="!hidden.has('widgetId')" using the emitted set.
 */
@Component({
  selector: 'app-dashboard-customize-bar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="customize-bar">
      <button type="button" class="toggle" (click)="open = !open">⚙ Customize</button>
      <div class="panel" *ngIf="open">
        <p class="panel__title">Show widgets</p>
        <label class="option" *ngFor="let widget of widgets">
          <input type="checkbox" [checked]="!hidden.has(widget.id)" (change)="toggle(widget.id)" />
          {{ widget.label }}
        </label>
      </div>
    </div>
  `,
  styles: [`
    .customize-bar { position: relative; }
    .toggle {
      padding: 0.45rem 0.9rem; border-radius: 8px; border: 1px solid var(--color-border, #3a3f4b);
      background: var(--color-bg-sunken, transparent); color: var(--color-text-primary, inherit);
      font-size: 0.82rem; font-weight: 600; cursor: pointer;
    }
    .panel {
      position: absolute; right: 0; top: calc(100% + 6px); z-index: 20; min-width: 200px;
      background: var(--color-bg-elevated, #1c1f26); border: 1px solid var(--color-border, #3a3f4b);
      border-radius: 10px; padding: 0.75rem; box-shadow: 0 8px 24px rgba(0,0,0,0.25);
    }
    .panel__title { margin: 0 0 0.5rem; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--color-text-muted, #9aa1ac); }
    .option { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; padding: 0.3rem 0; color: var(--color-text-primary, inherit); cursor: pointer; }
  `],
})
export class DashboardCustomizeBarComponent implements OnChanges {
  @Input() widgets: DashboardWidgetOption[] = [];
  @Input() dashboardKey!: string;
  @Output() hiddenChange = new EventEmitter<Set<string>>();

  open = false;
  hidden = new Set<string>();

  constructor(private dashboardPreferencesService: DashboardPreferencesService) {}

  ngOnChanges(): void {
    if (!this.dashboardKey) return;
    this.dashboardPreferencesService.getHiddenWidgets(this.dashboardKey).subscribe((hidden) => {
      this.hidden = hidden;
      this.hiddenChange.emit(this.hidden);
    });
  }

  toggle(widgetId: string): void {
    const next = new Set(this.hidden);
    if (next.has(widgetId)) next.delete(widgetId); else next.add(widgetId);
    this.hidden = next;
    this.hiddenChange.emit(next);
    this.dashboardPreferencesService.setHiddenWidgets(this.dashboardKey, next).subscribe();
  }
}

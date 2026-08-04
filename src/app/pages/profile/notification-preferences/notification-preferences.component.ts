import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PreferenceService } from '../../../core/services/preference.service';
import { NotificationPreferences } from '../../../core/models/sentinel.models';

const PREF_KEY = 'notifications';
const RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

@Component({
  selector: 'app-notification-preferences',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="notif-prefs">
      <h3>🔔 Notification Preferences</h3>
      <p class="hint">Choose which risk levels show up in your notification bell.</p>

      <label class="toggle-row">
        <input type="checkbox" [(ngModel)]="prefs.inAppEnabled" (ngModelChange)="save()" />
        In-app notifications enabled
      </label>

      <div class="risk-levels" [class.disabled]="!prefs.inAppEnabled">
        <span class="risk-levels__label">Muted risk levels</span>
        <label class="chip" *ngFor="let level of riskLevels">
          <input type="checkbox" [checked]="isMuted(level)" (change)="toggleMuted(level)" [disabled]="!prefs.inAppEnabled" />
          {{ level }}
        </label>
      </div>

      <p class="saved" *ngIf="justSaved">Saved.</p>
    </section>
  `,
  styles: [`
    .notif-prefs {
      background: var(--color-bg-elevated);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md, 14px);
      padding: 1.25rem 1.5rem;
      margin-top: 1.5rem;
    }
    h3 { margin: 0 0 0.3rem; font-size: 1.05rem; color: var(--color-text-primary); }
    .hint { margin: 0 0 1rem; font-size: 0.85rem; color: var(--color-text-secondary); }
    .toggle-row { display: flex; align-items: center; gap: 0.6rem; font-size: 0.9rem; color: var(--color-text-primary); margin-bottom: 1rem; cursor: pointer; }
    .risk-levels { display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem; }
    .risk-levels.disabled { opacity: 0.5; }
    .risk-levels__label { font-size: 0.82rem; font-weight: 600; color: var(--color-text-secondary); margin-right: 0.4rem; }
    .chip {
      display: flex; align-items: center; gap: 0.35rem; padding: 0.3rem 0.7rem; border-radius: 999px;
      background: var(--color-bg-sunken); border: 1px solid var(--color-border); font-size: 0.82rem; color: var(--color-text-primary); cursor: pointer;
    }
    .saved { margin: 0.75rem 0 0; font-size: 0.8rem; color: var(--status-success-text, #2f7d5c); }
  `],
})
export class NotificationPreferencesComponent implements OnInit {
  prefs: NotificationPreferences = { inAppEnabled: true, mutedRiskLevels: [] };
  readonly riskLevels = RISK_LEVELS;
  justSaved = false;
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(private preferenceService: PreferenceService) {}

  ngOnInit(): void {
    this.preferenceService.get(PREF_KEY).subscribe({
      next: (raw) => {
        if (!raw) return;
        try {
          this.prefs = { ...this.prefs, ...JSON.parse(raw) };
        } catch {
          // ignore malformed stored value, keep defaults
        }
      },
      error: () => {},
    });
  }

  isMuted(level: string): boolean {
    return this.prefs.mutedRiskLevels.includes(level);
  }

  toggleMuted(level: string): void {
    this.prefs.mutedRiskLevels = this.isMuted(level)
      ? this.prefs.mutedRiskLevels.filter((l) => l !== level)
      : [...this.prefs.mutedRiskLevels, level];
    this.save();
  }

  save(): void {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.preferenceService.set(PREF_KEY, JSON.stringify(this.prefs)).subscribe({
        next: () => { this.justSaved = true; setTimeout(() => (this.justSaved = false), 2000); },
        error: () => {},
      });
    }, 300);
  }
}

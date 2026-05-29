import { signal } from '@angular/core';

export interface DashboardKpiCard {
  label: string;
  value: string | number;
  note?: string;
  tone: 'good' | 'warning' | 'critical' | 'info';
}

export interface DashboardBarRow {
  label: string;
  value: number;
  display: string;
  tone: 'good' | 'warning' | 'critical' | 'info';
}

export interface DashboardTableCell {
  label: string;
  value: string;
}

export abstract class BaseDashboardComponent {
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly lastRefreshAt = signal<Date | null>(null);

  abstract loadDashboardData(): void;
  abstract refresh(): void;

  protected beginLoad(): void {
    this.loading.set(true);
    this.error.set(null);
  }

  protected endLoad(): void {
    this.loading.set(false);
    this.lastRefreshAt.set(new Date());
  }

  protected fail(message: string): void {
    this.error.set(message);
    this.loading.set(false);
  }
}

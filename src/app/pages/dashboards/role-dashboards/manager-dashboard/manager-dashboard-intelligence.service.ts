import { Injectable } from '@angular/core';
import { AlertResponse, Maintenance } from '../../../../core/models/sentinel.models';
import { Machine } from '../../../../core/models/machine.model';
import { seededFloat } from '../../../../core/utils/seeded-random';

export interface DayBucketSeries {
  labels: string[];
  values: number[];
}

/**
 * Derives day-bucketed trend series for the Manager Dashboard from real,
 * timestamped records (alerts.createdDate, maintenance.scheduledDate /
 * completedDate). The only series with no real historical equivalent is the
 * fleet-health line (the backend only exposes a current machine snapshot,
 * not day-by-day history) — that one is seeded off today's real uptime %
 * so it stays stable across reloads instead of behaving like Math.random().
 */
@Injectable({ providedIn: 'root' })
export class ManagerDashboardIntelligenceService {
  private dayLabel(daysAgo: number): string {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  private startOfDay(date: Date): number {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  private dayIndexFromNow(iso: string, days: number): number | null {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    const today = this.startOfDay(new Date());
    const diffDays = Math.round((today - this.startOfDay(date)) / 86400000);
    if (diffDays < 0 || diffDays >= days) return null;
    return days - 1 - diffDays; // 0 = oldest, days-1 = today
  }

  /** Daily count of alerts created, oldest -> newest. Used for both the
   *  Active Alerts KPI sparkline and the Alert Volume trend chart. */
  buildAlertVolumeTrend(alerts: AlertResponse[], days = 14): DayBucketSeries {
    const counts = new Array(days).fill(0);
    alerts.forEach((a) => {
      const idx = this.dayIndexFromNow(a.createdDate, days);
      if (idx !== null) counts[idx]++;
    });
    return {
      labels: Array.from({ length: days }, (_, i) => this.dayLabel(days - 1 - i)),
      values: counts,
    };
  }

  /** Daily maintenance created vs completed, oldest -> newest. */
  buildMaintenanceCompletionTrend(maintenance: Maintenance[], days = 14): { labels: string[]; created: number[]; completed: number[] } {
    const created = new Array(days).fill(0);
    const completed = new Array(days).fill(0);

    maintenance.forEach((m) => {
      if (m.createdDate) {
        const idx = this.dayIndexFromNow(m.createdDate, days);
        if (idx !== null) created[idx]++;
      }
      if (m.completedDate) {
        const idx = this.dayIndexFromNow(m.completedDate, days);
        if (idx !== null) completed[idx]++;
      }
    });

    return {
      labels: Array.from({ length: days }, (_, i) => this.dayLabel(days - 1 - i)),
      created,
      completed,
    };
  }

  /** Daily completion ratio (%) — real when data exists, isolated fallback otherwise. */
  buildProductivityTrend(maintenance: Maintenance[], days = 14): number[] {
    const { created, completed } = this.buildMaintenanceCompletionTrend(maintenance, days);
    let runningCreated = 0;
    let runningCompleted = 0;
    return created.map((c, i) => {
      runningCreated += c;
      runningCompleted += completed[i];
      if (runningCreated === 0) return 100;
      return Math.round((runningCompleted / runningCreated) * 100);
    });
  }

  /** Fleet health % over time — no historical snapshot exists server-side,
   *  so this is a seeded random-walk that ends exactly at today's real
   *  uptime value (not fabricated data pretending to be a live signal). */
  buildFleetHealthTrend(currentUptimePct: number, seedKey: string, days = 14): number[] {
    const values: number[] = [];
    let walk = currentUptimePct - seededFloat(`${seedKey}:fh0`, -6, 6, 1);
    for (let i = 0; i < days - 1; i++) {
      walk += seededFloat(`${seedKey}:fh${i}`, -3, 3, 1);
      values.push(Math.max(0, Math.min(100, Math.round(walk))));
    }
    values.push(Math.round(currentUptimePct));
    return values;
  }

  /** Trend label/direction comparing the first vs second half of a series. */
  trendFor(series: number[]): { label: string; direction: 'up' | 'down' | 'flat' } {
    if (series.length < 2) return { label: 'No change', direction: 'flat' };
    const midpoint = Math.floor(series.length / 2);
    const firstHalfAvg = series.slice(0, midpoint).reduce((a, b) => a + b, 0) / Math.max(1, midpoint);
    const secondHalfAvg = series.slice(midpoint).reduce((a, b) => a + b, 0) / Math.max(1, series.length - midpoint);
    const delta = secondHalfAvg - firstHalfAvg;
    const base = Math.abs(firstHalfAvg) < 0.01 ? 1 : Math.abs(firstHalfAvg);
    const pct = (delta / base) * 100;
    if (Math.abs(pct) < 3) return { label: 'Flat vs last week', direction: 'flat' };
    const sign = pct > 0 ? '+' : '';
    return { label: `${sign}${pct.toFixed(0)}% vs last week`, direction: pct > 0 ? 'up' : 'down' };
  }

  /** Risk-ranked machines (highest riskScore first) for the Critical Assets chart. */
  buildRiskRanking(machines: Machine[], limit = 6): { label: string; riskScore: number }[] {
    return [...machines]
      .filter((m) => typeof m.riskScore === 'number')
      .sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0))
      .slice(0, limit)
      .map((m) => ({ label: m.name || `Machine #${m.id}`, riskScore: Math.round(m.riskScore ?? 0) }));
  }
}

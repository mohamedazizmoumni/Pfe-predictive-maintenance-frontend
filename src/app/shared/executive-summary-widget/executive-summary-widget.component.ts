import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ExecutiveSummaryService } from '../../core/services/executive-summary.service';
import { ExecutiveSummary } from '../../core/models/sentinel.models';

/**
 * Self-contained executive KPI rollup, embedded into Super Admin / Admin
 * dashboards. "Plant Director" responsibilities expressed as a dashboard
 * widget rather than a new role (2026-08-01 scope reorientation). Fetches
 * its own data so it can be dropped into any dashboard template with a
 * single tag, without restructuring the host dashboard's existing state.
 */
@Component({
  selector: 'app-executive-summary-widget',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './executive-summary-widget.component.html',
  styleUrl: './executive-summary-widget.component.scss',
})
export class ExecutiveSummaryWidgetComponent implements OnInit {
  summary: ExecutiveSummary | null = null;
  isLoading = true;
  error = false;

  constructor(private executiveSummaryService: ExecutiveSummaryService) {}

  ngOnInit(): void {
    this.executiveSummaryService.getSummary().subscribe({
      next: (summary) => { this.summary = summary; this.isLoading = false; },
      error: () => { this.error = true; this.isLoading = false; },
    });
  }

  healthClass(health: number | null): string {
    if (health == null) return 'kpi-neutral';
    if (health >= 70) return 'kpi-good';
    if (health >= 40) return 'kpi-warn';
    return 'kpi-critical';
  }

  budgetClass(pct: number | null): string {
    if (pct == null) return 'kpi-neutral';
    if (pct >= 90) return 'kpi-critical';
    if (pct >= 75) return 'kpi-warn';
    return 'kpi-good';
  }

  /** A fleet leaning corrective (reactive) over preventive is the warning signal; no completions yet is neutral, not bad. */
  preventiveRatioClass(preventive: number, corrective: number): string {
    const total = preventive + corrective;
    if (total === 0) return 'kpi-neutral';
    return corrective > preventive ? 'kpi-warn' : 'kpi-good';
  }
}

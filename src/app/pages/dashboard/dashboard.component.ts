import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardService } from '../../core/services/dashboard.service';
import {
  DashboardOverview,
  MachineStatusSummary,
  PredictionHealth,
  MaintenancePipeline,
} from '../../core/models/sentinel.models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  overview$ = this.dashboardService.overview$;
  machineStatus$ = this.dashboardService.machineStatus$;
  predictionHealth$ = this.dashboardService.predictionHealth$;
  maintenancePipeline$ = this.dashboardService.maintenancePipeline$;
  isLoading$ = this.dashboardService.isLoading$;
  error$ = this.dashboardService.error$;

  statusSegments: Array<{
    key: keyof MachineStatusSummary;
    label: string;
    tone: 'text-success' | 'text-amber' | 'text-danger';
    hint: string;
  }> = [
    { key: 'operational', label: 'Operational', tone: 'text-success', hint: 'Stable output' },
    { key: 'maintenance', label: 'Maintenance', tone: 'text-amber', hint: 'Planned tickets' },
    { key: 'faulty', label: 'Faulty', tone: 'text-danger', hint: 'Requires attention' },
    { key: 'inactive', label: 'Inactive', tone: 'text-amber', hint: 'Standby assets' },
  ];

  pipelineStages: Array<{
    key: keyof MaintenancePipeline;
    label: string;
    caption: string;
  }> = [
    { key: 'scheduled', label: 'Scheduled', caption: 'Next 24h' },
    { key: 'inProgress', label: 'In Progress', caption: 'Active crews' },
    { key: 'completed', label: 'Completed', caption: 'Cleared work orders' },
    { key: 'cancelled', label: 'Cancelled', caption: 'Deferred tasks' },
  ];

  constructor(private dashboardService: DashboardService) {}

  ngOnInit(): void {
    this.dashboardService.loadDashboard();
  }

  getPercentageColor(percentage: number): string {
    if (percentage >= 95) return 'good';
    if (percentage >= 80) return 'warning';
    return 'danger';
  }

  getPipelineFill(value: number, pipeline: MaintenancePipeline): number {
    const total = this.getPipelineTotal(pipeline);
    if (!total) {
      return 0;
    }
    return Math.round((value / total) * 100);
  }

  private getPipelineTotal(pipeline: MaintenancePipeline): number {
    return (
      (pipeline?.scheduled || 0) +
      (pipeline?.inProgress || 0) +
      (pipeline?.completed || 0) +
      (pipeline?.cancelled || 0)
    );
  }
}
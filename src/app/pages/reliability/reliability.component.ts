import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReliabilityService } from '../../core/services/reliability.service';
import { MaintenanceService } from '../../core/services/maintenance.service';
import { FailureRecord, MachineReliabilitySummary } from '../../core/models/sentinel.models';

@Component({
  selector: 'app-reliability',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reliability.component.html',
  styleUrl: './reliability.component.scss',
})
export class ReliabilityComponent implements OnInit {
  machines: MachineReliabilitySummary[] = [];
  failures: FailureRecord[] = [];
  isLoading = true;
  error: string | null = null;

  selectedMachineId: number | null = null;
  editingRootCauseFor: number | null = null;
  rootCauseDraft = '';
  isSavingRootCause = false;

  constructor(
    private reliabilityService: ReliabilityService,
    private maintenanceService: MaintenanceService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading = true;
    this.reliabilityService.getFleetReliability().subscribe({
      next: (machines) => { this.machines = machines; this.isLoading = false; },
      error: () => { this.error = 'Could not load reliability data.'; this.isLoading = false; },
    });
    this.loadFailures();
  }

  loadFailures(): void {
    this.reliabilityService.getFailureRecords(this.selectedMachineId ?? undefined).subscribe({
      next: (failures) => { this.failures = failures; },
      error: () => {},
    });
  }

  filterByMachine(machineId: number | null): void {
    this.selectedMachineId = machineId;
    this.loadFailures();
  }

  reliabilityClass(mtbfHours: number | null): string {
    if (mtbfHours == null) return 'rel-unknown';
    if (mtbfHours >= 720) return 'rel-good'; // 30+ days between failures
    if (mtbfHours >= 168) return 'rel-warn'; // 7-30 days
    return 'rel-critical'; // under a week between failures
  }

  formatHours(hours: number | null): string {
    if (hours == null) return '—';
    if (hours < 48) return `${hours.toFixed(1)}h`;
    return `${(hours / 24).toFixed(1)}d`;
  }

  startEditRootCause(failure: FailureRecord): void {
    this.editingRootCauseFor = failure.maintenanceId;
    this.rootCauseDraft = failure.rootCause || '';
  }

  cancelEditRootCause(): void {
    this.editingRootCauseFor = null;
    this.rootCauseDraft = '';
  }

  saveRootCause(failure: FailureRecord): void {
    this.isSavingRootCause = true;
    this.maintenanceService.updateMaintenance(String(failure.maintenanceId), { rootCause: this.rootCauseDraft }).subscribe({
      next: () => {
        failure.rootCause = this.rootCauseDraft;
        this.isSavingRootCause = false;
        this.cancelEditRootCause();
      },
      error: () => { this.isSavingRootCause = false; },
    });
  }
}

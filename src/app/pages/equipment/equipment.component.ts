import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { EquipmentService } from '../../core/services/equipment.service';
import { Machine, CreateMachineRequest } from '../../core/models/sentinel.models';
import { PredictiveApiService } from '../../core/services/predictive-api.service';
import {
  MachineFailureReport,
  MachineSimulatedReading,
  NormalizedApiError,
} from '../../core/models/predictive.models';
import { forkJoin } from 'rxjs';

interface StatusFilter {
  label: string;
  value: string;
}

interface MachinePredictiveSummary {
  loading: boolean;
  error: string | null;
  reading: MachineSimulatedReading | null;
  failureReport: MachineFailureReport | null;
}

@Component({
  selector: 'app-equipment',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './equipment.component.html',
  styleUrls: ['./equipment.component.scss']
})
export class EquipmentComponent implements OnInit {
  machines$ = this.equipmentService.machines$;
  isLoading$ = this.equipmentService.isLoading$;
  error$ = this.equipmentService.error$;

  page = 0;
  size = 10;
  selectedStatus = '';

  formMode: 'create' | 'edit' | null = null;
  machineForm!: FormGroup;
  activeMachineId: string | null = null;
  showForm = false;
  deleteConfirmId: string | null = null;
  expandedPredictiveMachineId: string | null = null;
  predictiveSummaryByMachine: Record<string, MachinePredictiveSummary> = {};

  readonly statuses: StatusFilter[] = [
    { label: 'All statuses', value: '' },
    { label: 'Operational', value: 'OPERATIONAL' },
    { label: 'Maintenance', value: 'MAINTENANCE' },
    { label: 'Faulty', value: 'FAULTY' },
    { label: 'Inactive', value: 'INACTIVE' }
  ];

  constructor(
    private readonly equipmentService: EquipmentService,
    private readonly fb: FormBuilder,
    private readonly predictiveApi: PredictiveApiService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.machineForm = this.fb.group({
      name: [''],
      serialNumber: ['', Validators.required],
      model: ['', Validators.required],
      manufacturer: ['', Validators.required],
      location: ['', Validators.required],
      installationYear: [new Date().getFullYear()],
      status: ['OPERATIONAL', Validators.required],
      description: [''],
    });

    this.loadMachines();
  }

  loadMachines(page: number = 0): void {
    this.page = page;
    this.equipmentService.loadMachines(page, this.size, this.selectedStatus || undefined);
  }

  handleStatusChange(event: Event): void {
    const { value } = event.target as HTMLSelectElement;
    this.selectedStatus = value;
    this.loadMachines(0);
  }

  refresh(): void {
    this.loadMachines(this.page);
  }

  openCreate(): void {
    this.formMode = 'create';
    this.activeMachineId = null;
    this.machineForm.reset({
      name: '',
      serialNumber: '',
      model: '',
      manufacturer: '',
      location: '',
      installationYear: new Date().getFullYear(),
      status: 'OPERATIONAL',
      description: '',
    });
    this.showForm = true;
  }

  openEdit(machine: Machine): void {
    this.formMode = 'edit';
    this.activeMachineId = machine.id;
    this.machineForm.reset({
      name: machine.name ?? '',
      serialNumber: machine.serialNumber,
      model: machine.model,
      manufacturer: machine.manufacturer,
      location: machine.location,
      installationYear: machine.installationYear ?? new Date().getFullYear(),
      status: machine.status ?? 'OPERATIONAL',
      description: machine.description ?? '',
    });
    this.showForm = true;
  }

  closeForm(): void {
    this.showForm = false;
    this.formMode = null;
    this.activeMachineId = null;
  }

  submitForm(): void {
    if (!this.formMode || this.machineForm.invalid) {
      this.machineForm.markAllAsTouched();
      return;
    }

    const payload = this.machineForm.value as CreateMachineRequest;

    if (this.formMode === 'create') {
      this.equipmentService.createMachine(payload).subscribe(() => {
        this.closeForm();
      });
    } else if (this.formMode === 'edit' && this.activeMachineId) {
      this.equipmentService.updateMachine(this.activeMachineId, payload).subscribe(() => {
        this.closeForm();
      });
    }
  }

  requestDelete(machine: Machine): void {
    this.deleteConfirmId = machine.id;
  }

  cancelDelete(): void {
    this.deleteConfirmId = null;
  }

  confirmDelete(): void {
    if (!this.deleteConfirmId) {
      return;
    }
    const id = this.deleteConfirmId;
    this.equipmentService.deleteMachine(id).subscribe(() => {
      if (this.page > 0) {
        this.loadMachines(this.page);
      }
      if (this.expandedPredictiveMachineId === id) {
        this.expandedPredictiveMachineId = null;
      }
      this.deleteConfirmId = null;
    });
  }

  togglePredictivePanel(machine: Machine): void {
    if (this.expandedPredictiveMachineId === machine.id) {
      this.expandedPredictiveMachineId = null;
      return;
    }

    this.expandedPredictiveMachineId = machine.id;

    if (!this.predictiveSummaryByMachine[machine.id]) {
      this.loadPredictiveSummary(machine);
    }
  }

  refreshPredictivePanel(machine: Machine): void {
    this.loadPredictiveSummary(machine);
  }

  openPredictiveDashboard(machineId: string): void {
    this.router.navigate(['/predictive-dashboard'], {
      queryParams: {
        machineId,
        page: 0,
        size: 20,
        sort: 'createdAt,desc',
      },
    });
  }

  openMachineVisual(machine: Machine): void {
    this.router.navigate(['/equipment', machine.id, 'visual']);
  }

  getPredictiveSummary(machineId: string): MachinePredictiveSummary | undefined {
    return this.predictiveSummaryByMachine[machineId];
  }

  getRiskClass(risk: number): string {
    if (risk >= 0.7) {
      return 'risk risk--high';
    }

    if (risk >= 0.4) {
      return 'risk risk--medium';
    }

    return 'risk risk--low';
  }

  exportCsv(): void {
    this.machines$.subscribe((machines) => {
      const rows = [
        ['Serial', 'Model', 'Location', 'Manufacturer', 'Status', 'Installation Year'],
        ...machines.map((m) => [
          m.serialNumber,
          m.model,
          m.location,
          m.manufacturer,
          m.status,
          m.installationYear?.toString() ?? '',
        ]),
      ];

      const csv = rows
        .map((row) => row.map((cell) => `"${(cell ?? '').toString().replace(/"/g, '""')}"`).join(','))
        .join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'equipment-export.csv';
      a.click();
      URL.revokeObjectURL(url);
    }).unsubscribe();
  }

  trackByMachine(_: number, machine: Machine): string {
    return machine.id;
  }

  private loadPredictiveSummary(machine: Machine): void {
    const machineId = Number(machine.id);

    this.predictiveSummaryByMachine[machine.id] = {
      loading: true,
      error: null,
      reading: null,
      failureReport: null,
    };

    if (!Number.isFinite(machineId)) {
      this.predictiveSummaryByMachine[machine.id] = {
        loading: false,
        error: 'Machine ID is not numeric, predictive APIs require a numeric machine identifier.',
        reading: null,
        failureReport: null,
      };
      return;
    }

    forkJoin({
      readings: this.predictiveApi.getSimulatedReadings(),
      reports: this.predictiveApi.getFailureReports({
        machineId,
        page: 0,
        size: 1,
        sort: 'createdAt,desc',
      }),
    }).subscribe({
      next: ({ readings, reports }) => {
        const latestReading = readings
          .filter((reading) => reading.machineId === machineId)
          .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))[0] ?? null;

        this.predictiveSummaryByMachine[machine.id] = {
          loading: false,
          error: null,
          reading: latestReading,
          failureReport: reports.content[0] ?? null,
        };
      },
      error: (error: NormalizedApiError) => {
        this.predictiveSummaryByMachine[machine.id] = {
          loading: false,
          error: error.message,
          reading: null,
          failureReport: null,
        };
      },
    });
  }
}

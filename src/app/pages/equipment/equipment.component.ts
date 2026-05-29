import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { EquipmentService, MACHINE_CATEGORIES } from '../../core/services/equipment.service';
import { Machine, CreateMachineRequest, User } from '../../core/models/sentinel.models';
import { PredictiveApiService } from '../../core/services/predictive-api.service';
import { AuthService } from '../../core/services/auth.service';
import { DashboardRoutingService } from '../dashboards/dashboard-routing.service';
import {
  MachineFailureReport,
  MachineSimulatedReading,
  NormalizedApiError,
} from '../../core/models/predictive.models';
import { forkJoin } from 'rxjs';
import { normalizeRoleName } from '../../core/utils/role.utils';

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
  currentUser: User | null = null;
  isTechnician = false;
  canCreateMachine = false;

  formMode: 'create' | 'edit' | null = null;
  machineForm!: FormGroup;
  activeMachineId: number | null = null;
  showForm = false;
  deleteConfirmId: number | null = null;
  expandedPredictiveMachineId: number | null = null;
  predictiveSummaryByMachine: Record<string, MachinePredictiveSummary> = {};
  selectedPhoto: File | null = null;

  /** Available top-level categories for the machine form dropdown. */
  readonly categories = Object.keys(MACHINE_CATEGORIES);
  /** Subcategories filtered based on the selected category. */
  subCategories: string[] = [];

  readonly statuses: StatusFilter[] = [
    { label: 'All statuses', value: '' },
    { label: 'Operational', value: 'OPERATIONAL' },
    { label: 'Maintenance', value: 'MAINTENANCE' },
    { label: 'Faulty', value: 'FAULTY' },
    { label: 'Decommissioned', value: 'DECOMMISSIONED' }
  ];

  constructor(
    private readonly equipmentService: EquipmentService,
    private readonly fb: FormBuilder,
    private readonly predictiveApi: PredictiveApiService,
    private readonly authService: AuthService,
    private readonly dashboardRoutingService: DashboardRoutingService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.machineForm = this.fb.group({
      name: ['', Validators.required],
      serialNumber: ['', Validators.required],
      model: ['', Validators.required],
      manufacturer: [''],
      location: ['', Validators.required],
      category: [''],
      subCategory: [''],
      installationYear: [new Date().getFullYear()],
      status: ['OPERATIONAL'],
      description: [''],
    });

    // Check user role
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (user && user.roles) {
        this.isTechnician = user.roles.some(role => normalizeRoleName(role.name) === 'TECHNICIAN');
        this.canCreateMachine = !this.isTechnician; // Technicians cannot create machines
      }
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

  /**
   * Called when the user selects a category in the machine form.
   * Dynamically loads the matching subcategories and resets the subCategory field.
   */
  onCategoryChange(event: Event): void {
    const categoryName = (event.target as HTMLSelectElement).value;
    this.equipmentService.getSubCategories(categoryName).subscribe((subs) => {
      this.subCategories = subs;
      this.machineForm.patchValue({ subCategory: '' });
    });
  }

  refresh(): void {
    this.loadMachines(this.page);
  }

  openCreate(): void {
    if (this.isTechnician) {
      alert('❌ Technicians cannot create machines. Please contact an administrator.');
      return;
    }
    
    this.formMode = 'create';
    this.activeMachineId = null;
    this.selectedPhoto = null;
    this.machineForm.reset({
      name: '',
      serialNumber: '',
      model: '',
      manufacturer: '',
      location: '',
      category: '',
      subCategory: '',
      installationYear: new Date().getFullYear(),
      status: 'OPERATIONAL',
      description: '',
    });
    this.showForm = true;
  }

  openEdit(machine: Machine): void {
    this.formMode = 'edit';
    this.activeMachineId = machine.id;
    // Pre-populate subcategories for the selected category
    if (machine.category) {
      this.equipmentService.getSubCategories(machine.category).subscribe((subs) => {
        this.subCategories = subs;
      });
    } else {
      this.subCategories = [];
    }
    this.machineForm.reset({
      name: machine.name ?? '',
      serialNumber: machine.serialNumber,
      model: machine.model,
      manufacturer: machine.manufacturer ?? '',
      location: machine.location,
      category: machine.category ?? '',
      subCategory: machine.subCategory ?? '',
      installationYear: this.resolveInstallationYear(machine) ?? new Date().getFullYear(),
      status: machine.status ?? 'OPERATIONAL',
      description: machine.description ?? '',
    });
    this.showForm = true;
  }

  closeForm(): void {
    this.showForm = false;
    this.formMode = null;
    this.activeMachineId = null;
    this.selectedPhoto = null;
  }

  submitForm(): void {
    if (!this.formMode || this.machineForm.invalid) {
      this.machineForm.markAllAsTouched();
      return;
    }

    const payload = this.machineForm.value as CreateMachineRequest;

    if (this.formMode === 'create') {
      this.equipmentService.createMachine(payload, this.selectedPhoto).subscribe(() => {
        this.closeForm();
      });
    } else if (this.formMode === 'edit' && this.activeMachineId) {
      this.equipmentService.updateMachine(this.activeMachineId, payload).subscribe(() => {
        this.closeForm();
      });
    }
  }

  handlePhotoChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedPhoto = input.files && input.files.length ? input.files[0] : null;
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

  openPredictiveDashboard(machineId: number): void {
    this.router.navigate([this.dashboardRoutingService.getDashboardRouteForCurrentUser(this.currentUser)], {
      queryParams: {
        machineId,
        page: 0,
        size: 20,
        sort: 'createdAt,desc',
      },
    });
  }

  openMachineVisual(machine: Machine): void {
    console.log('🔍 Navigating to machine visualization:', machine.id);
    this.router.navigate(['/equipment', machine.id, 'visual']).then(
      success => {
        if (success) {
          console.log('✅ Navigation successful');
        } else {
          console.error('❌ Navigation failed');
        }
      },
      error => {
        console.error('❌ Navigation error:', error);
      }
    );
  }

  getPredictiveSummary(machineId: number): MachinePredictiveSummary | undefined {
    return this.predictiveSummaryByMachine[String(machineId)];
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
          this.resolveInstallationYear(m)?.toString() ?? '',
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

  trackByMachine(_: number, machine: Machine): number {
    return machine.id;
  }

  getInstallationYear(machine: Machine): number | null {
    return this.resolveInstallationYear(machine);
  }

  private resolveInstallationYear(machine: Machine): number | null {
    if (!machine.installationDate) {
      return null;
    }

    const year = new Date(machine.installationDate).getFullYear();
    return Number.isFinite(year) ? year : null;
  }

  private loadPredictiveSummary(machine: Machine): void {
    const machineId = Number(machine.id);

    const machineKey = String(machine.id);

    this.predictiveSummaryByMachine[machineKey] = {
      loading: true,
      error: null,
      reading: null,
      failureReport: null,
    };

    if (!Number.isFinite(machineId)) {
      this.predictiveSummaryByMachine[machineKey] = {
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

        this.predictiveSummaryByMachine[machineKey] = {
          loading: false,
          error: null,
          reading: latestReading,
          failureReport: reports.content[0] ?? null,
        };
      },
      error: (error: NormalizedApiError) => {
        this.predictiveSummaryByMachine[machineKey] = {
          loading: false,
          error: error.message,
          reading: null,
          failureReport: null,
        };
      },
    });
  }
}

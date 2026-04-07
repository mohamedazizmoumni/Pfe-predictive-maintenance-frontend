import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { EquipmentService } from '../../core/services/equipment.service';
import { Machine, CreateMachineRequest } from '../../core/models/sentinel.models';

interface StatusFilter {
  label: string;
  value: string;
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

  readonly statuses: StatusFilter[] = [
    { label: 'All statuses', value: '' },
    { label: 'Operational', value: 'OPERATIONAL' },
    { label: 'Maintenance', value: 'MAINTENANCE' },
    { label: 'Faulty', value: 'FAULTY' },
    { label: 'Inactive', value: 'INACTIVE' }
  ];

  constructor(
    private readonly equipmentService: EquipmentService,
    private readonly fb: FormBuilder
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
    const value = (event.target as HTMLSelectElement).value;
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
      this.deleteConfirmId = null;
    });
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
}

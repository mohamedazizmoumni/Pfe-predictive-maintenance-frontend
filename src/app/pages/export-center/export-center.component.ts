import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { catchError, of } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { MachineService } from '../../core/services/machine.service';
import { MaintenanceService } from '../../core/services/maintenance.service';
import { AlertApiService } from '../../core/services/alert.service';
import { InventoryService } from '../../core/services/inventory.service';
import { FinanceService } from '../../core/services/finance.service';
import { exportToCsv } from '../../shared/utils/csv-export.util';

interface ExportOption {
  id: string;
  label: string;
  description: string;
  roles: string[];
  run: () => void;
}

@Component({
  selector: 'app-export-center',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './export-center.component.html',
  styleUrl: './export-center.component.scss',
})
export class ExportCenterComponent implements OnInit {
  options: ExportOption[] = [];
  exportingId: string | null = null;

  constructor(
    private authService: AuthService,
    private machineService: MachineService,
    private maintenanceService: MaintenanceService,
    private alertService: AlertApiService,
    private inventoryService: InventoryService,
    private financeService: FinanceService,
  ) {}

  ngOnInit(): void {
    const allOptions: ExportOption[] = [
      {
        id: 'machines',
        label: 'Machines',
        description: 'Full equipment registry with status and health.',
        roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TECHNICIAN', 'STOCK_MANAGER', 'FINANCE_MANAGER'],
        run: () => this.run('machines', () =>
          this.machineService.getAll().pipe(catchError(() => of([]))).subscribe((machines) =>
            this.finish(exportToCsv('machines', machines as unknown as Record<string, unknown>[])))),
      },
      {
        id: 'maintenance',
        label: 'Maintenance History',
        description: 'All work orders — scheduled, in progress, completed.',
        roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TECHNICIAN'],
        run: () => this.run('maintenance', () =>
          this.maintenanceService.getAllMaintenanceTasks(0, 1000).pipe(catchError(() => of({ content: [] } as any))).subscribe((page) =>
            this.finish(exportToCsv('maintenance-history', page.content as unknown as Record<string, unknown>[])))),
      },
      {
        id: 'alerts',
        label: 'Alerts',
        description: 'Incident log across the fleet.',
        roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TECHNICIAN'],
        run: () => this.run('alerts', () =>
          this.alertService.list({ size: 1000 }).pipe(catchError(() => of({ content: [] } as any))).subscribe((page) =>
            this.finish(exportToCsv('alerts', page.content as unknown as Record<string, unknown>[])))),
      },
      {
        id: 'parts',
        label: 'Inventory Parts',
        description: 'Stock levels, thresholds, and supplier info.',
        roles: ['SUPER_ADMIN', 'ADMIN', 'STOCK_MANAGER', 'MANAGER'],
        run: () => this.run('parts', () =>
          this.inventoryService.getParts(0, 1000).pipe(catchError(() => of({ content: [] } as any))).subscribe((page) =>
            this.finish(exportToCsv('inventory-parts', (page.content ?? page) as unknown as Record<string, unknown>[])))),
      },
      {
        id: 'expenses',
        label: 'Expenses',
        description: 'Submitted expense reports and approval status.',
        roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER'],
        run: () => this.run('expenses', () =>
          this.financeService.getAllExpenses().pipe(catchError(() => of([]))).subscribe((expenses) =>
            this.finish(exportToCsv('expenses', expenses as unknown as Record<string, unknown>[])))),
      },
    ];

    const roles = (this.authService.getCurrentUser()?.roles ?? []).map((r) => r.name);
    this.options = allOptions.filter((option) => option.roles.some((role) => roles.includes(role)));
  }

  private run(id: string, action: () => void): void {
    this.exportingId = id;
    action();
  }

  private finish(_: void): void {
    this.exportingId = null;
  }
}

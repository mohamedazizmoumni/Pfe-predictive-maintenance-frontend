import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, take } from 'rxjs';
import { map } from 'rxjs/operators';
import { MaintenanceListComponent } from './components/maintenance-list/maintenance-list.component';
import { MaintenanceDetailComponent } from './components/maintenance-detail/maintenance-detail.component';
import { MaintenanceCreateComponent } from './components/maintenance-create/maintenance-create.component';
import { MaintenanceService } from '../../core/services/maintenance.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { EquipmentService } from '../../core/services/equipment.service';
import { UserService } from '../../core/services/user.service';
import { CreateMaintenanceRequest } from '../../core/models/sentinel.models';
import { normalizeRoleName } from '../../core/utils/role.utils';

@Component({
  selector: 'app-maintenance',
  standalone: true,
  imports: [CommonModule, MaintenanceListComponent, MaintenanceDetailComponent, MaintenanceCreateComponent],
  templateUrl: './maintenance.component.html',
  styleUrl: './maintenance.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MaintenanceComponent implements OnInit {
  maintenance$ = this.maintenanceService.maintenance$;
  isLoading$ = this.maintenanceService.isLoading$;
  error$ = this.maintenanceService.error$;
  currentMaintenance$ = this.maintenanceService.currentMaintenance$;
  pagination$ = this.maintenanceService.pagination$;

  pipeline$ = this.dashboardService.maintenancePipeline$;
  machines$ = this.equipmentService.machines$;
  technicians$ = this.userService.users$.pipe(
    map((users) =>
      users.filter((user) =>
        user.roles?.some((role) => normalizeRoleName(role.name) === 'TECHNICIAN')
      )
    )
  );

  selectedTaskId: string | null = null;
  statusFilter?: string;
  priorityFilter?: string;
  pageSize = 10;
  showCreateModal = false;
  isCreating = false;

  constructor(
    private maintenanceService: MaintenanceService,
    private dashboardService: DashboardService,
    private equipmentService: EquipmentService,
    private userService: UserService
  ) {}

  ngOnInit(): void {
    this.maintenanceService.loadMaintenanceTasks();
    this.dashboardService.getMaintenancePipeline().pipe(take(1)).subscribe();
    this.equipmentService.loadMachines(0, 50);
    this.userService.loadUsers(0, 100);
  }

  handleFiltersChange(filters: { status?: string; priority?: string }): void {
    this.statusFilter = filters.status;
    this.priorityFilter = filters.priority;
    this.selectedTaskId = null;
    this.maintenanceService.loadMaintenanceTasks(0, this.pageSize, this.statusFilter, this.priorityFilter);
  }

  handlePageChange(page: number): void {
    this.maintenanceService.loadMaintenanceTasks(page, this.pageSize, this.statusFilter, this.priorityFilter);
  }

  handleSelect(taskId: string): void {
    this.selectedTaskId = taskId;
    this.maintenanceService.getMaintenance(taskId).pipe(take(1)).subscribe();
  }

  handleRefresh(): void {
    this.maintenanceService.refreshCurrentQuery();
    this.refreshPipeline();
  }

  openCreateModal(): void {
    this.showCreateModal = true;
  }

  handleCreate(payload: CreateMaintenanceRequest): void {
    this.isCreating = true;
    this.maintenanceService
      .scheduleMaintenance(payload)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.isCreating = false;
          this.showCreateModal = false;
          this.refreshPipeline();
        },
        error: () => {
          this.isCreating = false;
        },
      });
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
  }

  handleStart(id: string): void {
    this.runAndRefresh(this.maintenanceService.startMaintenance(id));
  }

  handleComplete(id: string): void {
    this.runAndRefresh(this.maintenanceService.completeMaintenance(id));
  }

  handleApprove(id: string): void {
    this.runAndRefresh(this.maintenanceService.approveMaintenance(id));
  }

  handleCancel(id: string): void {
    this.runAndRefresh(this.maintenanceService.cancelMaintenance(id));
  }

  handleDelete(id: string): void {
    this.runAndRefresh(this.maintenanceService.deleteMaintenance(id));
    if (this.selectedTaskId === id) {
      this.selectedTaskId = null;
    }
  }

  private runAndRefresh<T>(observable: Observable<T>): void {
    observable
      .pipe(take(1))
      .subscribe({
        next: () => this.refreshPipeline(),
        error: () => {},
      });
  }

  private refreshPipeline(): void {
    this.dashboardService.getMaintenancePipeline().pipe(take(1)).subscribe();
  }
}

import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, combineLatest, take } from 'rxjs';
import { map, tap } from 'rxjs/operators';

import { MaintenanceListComponent } from './components/maintenance-list/maintenance-list.component';
import { MaintenanceDetailComponent } from './components/maintenance-detail/maintenance-detail.component';
import { MaintenanceCreateComponent } from './components/maintenance-create/maintenance-create.component';

import { MaintenanceService } from '../../core/services/maintenance.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { EquipmentService } from '../../core/services/equipment.service';
import { UserService } from '../../core/services/user.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { normalizeApiError } from '../../core/http/api-error';

import { CreateTaskRequest, Maintenance, User } from '../../core/models/sentinel.models';
import { normalizeRoleName } from '../../core/utils/role.utils';

@Component({
  selector: 'app-maintenance',
  standalone: true,
  imports: [
    CommonModule,
    MaintenanceListComponent,
    MaintenanceDetailComponent,
    MaintenanceCreateComponent,
  ],
  templateUrl: './maintenance.component.html',
  styleUrl: './maintenance.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MaintenanceComponent implements OnInit {

  maintenance$ = this.maintenanceService.maintenance$;

  // ✅ No client-side filtering needed — the backend already scoped
  // results to the technician via getTechnicianTasks(). Filtering here
  // again was the reason assigned tasks disappeared after a refresh.
  visibleMaintenance$ = this.maintenanceService.maintenance$.pipe(
    tap(tasks => {
      console.log('📋 visibleMaintenance$ emitting tasks:', {
        count: tasks?.length,
        tasks: tasks?.map(t => ({ id: t.id, description: t.description, assignedTechnicianId: t.assignedTechnicianId }))
      });
    })
  );

  isLoading$ = this.maintenanceService.isLoading$;
  error$ = this.maintenanceService.error$;
  currentMaintenance$ = this.maintenanceService.currentMaintenance$;
  pagination$ = this.maintenanceService.pagination$;

  pipeline$ = this.dashboardService.maintenancePipeline$;
  machines$ = this.equipmentService.machines$;

  technicians$ = this.userService.users$.pipe(
    map(users =>
      users.filter(user =>
        user.roles?.some(
          role => normalizeRoleName(role.name) === 'TECHNICIAN'
        )
      )
    )
  );

  selectedTaskId: string | null = null;
  statusFilter?: string;
  priorityFilter?: string;
  pageSize = 10;

  showCreateModal = false;
  isCreating = false;
  canCreateMaintenance = true;

  // ✅ Track whether current user is a technician and their ID,
  // so filter/page changes can route to the right loading method.
  private currentTechnicianId: string | null = null;

  constructor(
    private maintenanceService: MaintenanceService,
    private dashboardService: DashboardService,
    private equipmentService: EquipmentService,
    private userService: UserService,
    private authService: AuthService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$.pipe(take(1)).subscribe(user => {
      if (!user) {
        this.maintenanceService.loadMaintenanceTasks();
        return;
      }

      this.canCreateMaintenance = !this.isTechnician(user);

      if (this.isTechnician(user)) {
        // ✅ Store the technician ID so page/filter changes reuse it
        this.currentTechnicianId = user.id || user.username || null;

        if (!this.currentTechnicianId) {
          this.maintenanceService.loadMaintenanceTasks();
          return;
        }

        this.maintenanceService
          .getTechnicianTasks(this.currentTechnicianId, 0, this.pageSize)
          .subscribe({
            error: () => this.maintenanceService.loadMaintenanceTasks(),
          });

      } else {
        this.maintenanceService.loadMaintenanceTasks();
      }
    });

    this.dashboardService.getMaintenancePipeline().pipe(take(1)).subscribe();
    this.equipmentService.loadMachines(0, 50);
    this.userService.loadUsers(0, 100);
  }

  private isTechnician(user: User): boolean {
    return user.roles?.some(
      role => normalizeRoleName(role.name) === 'TECHNICIAN'
    ) ?? false;
  }

  // ===================== UI EVENTS =====================

  handleFiltersChange(filters: { status?: string; priority?: string }): void {
    this.statusFilter = filters.status;
    this.priorityFilter = filters.priority;
    this.selectedTaskId = null;
    // ✅ Technicians must stay scoped to their own tasks when filtering
    this.loadTasksForCurrentUser(0);
  }

  handlePageChange(page: number): void {
    // ✅ Technicians must stay scoped to their own tasks when paging
    this.loadTasksForCurrentUser(page);
  }

  // ✅ Single method that routes to the right loader based on role
  private loadTasksForCurrentUser(page: number): void {
    if (this.currentTechnicianId) {
      this.maintenanceService
        .getTechnicianTasks(this.currentTechnicianId, page, this.pageSize)
        .subscribe({
          error: () =>
            this.maintenanceService.loadMaintenanceTasks(
              page, this.pageSize, this.statusFilter, this.priorityFilter
            ),
        });
    } else {
      this.maintenanceService.loadMaintenanceTasks(
        page, this.pageSize, this.statusFilter, this.priorityFilter
      );
    }
  }

  handleSelect(taskId: string): void {
    this.selectedTaskId = taskId;
    this.maintenanceService.getMaintenance(taskId).pipe(take(1)).subscribe();
  }

  handleRefresh(): void {
    // ✅ refreshCurrentQuery() would call loadMaintenanceTasks() internally,
    // which forgets the technician scope — use loadTasksForCurrentUser instead.
    this.loadTasksForCurrentUser(
      this.maintenanceService['lastQuery']?.page ?? 0
    );
    this.dashboardService.getMaintenancePipeline().pipe(take(1)).subscribe();
  }

  openCreateModal(): void {
    if (!this.canCreateMaintenance) return;
    this.showCreateModal = true;
  }

  handleCreate(payload: CreateTaskRequest): void {
    if (!this.canCreateMaintenance) return;
    this.isCreating = true;
    this.maintenanceService.createTask(payload)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.isCreating = false;
          this.showCreateModal = false;
          this.toastService.success('Task assigned successfully. Notification email flow was triggered.');
          this.handleRefresh();
        },
        error: (err) => {
          this.isCreating = false;
          const normalized = normalizeApiError(err, 'Task creation failed.');
          this.toastService.error(normalized.message);
        },
      });
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
  }

  // ===================== ACTIONS =====================

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
    if (this.selectedTaskId === id) this.selectedTaskId = null;
  }

  private runAndRefresh<T>(obs: Observable<T>): void {
    obs.pipe(take(1)).subscribe({
      next: () => {
        console.log('✅ Action completed successfully');
        this.dashboardService.getMaintenancePipeline().pipe(take(1)).subscribe();
      },
      error: (err) => {
        console.error('❌ Action failed:', err);
        const errorMessage = err?.error?.message || err?.message || 'Action failed';
        alert(`Error: ${errorMessage}`);
      },
    });
  }
}
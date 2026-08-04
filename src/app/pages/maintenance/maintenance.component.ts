import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { Observable, combineLatest, firstValueFrom, take } from 'rxjs';
import { map } from 'rxjs/operators';

import { MaintenanceListComponent } from './components/maintenance-list/maintenance-list.component';
import { MaintenanceDetailComponent } from './components/maintenance-detail/maintenance-detail.component';
import { MaintenanceCreateComponent, MaintenanceCreatePrefill } from './components/maintenance-create/maintenance-create.component';
import { TaskCompletionModalComponent } from '../technician-dashboard/components/task-completion-modal.component';

import { MaintenanceService } from '../../core/services/maintenance.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { EquipmentService } from '../../core/services/equipment.service';
import { UserService } from '../../core/services/user.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { RapportService } from '../../core/services/rapport.service';
import { AttachmentService } from '../../core/services/attachment.service';
import { normalizeApiError } from '../../core/http/api-error';

import { CreateTaskRequest, Maintenance, MaintenanceRapportRequest, User } from '../../core/models/sentinel.models';
import { normalizeRoleName } from '../../core/utils/role.utils';

@Component({
  selector: 'app-maintenance',
  standalone: true,
  imports: [
    CommonModule,
    LucideAngularModule,
    MaintenanceListComponent,
    MaintenanceDetailComponent,
    MaintenanceCreateComponent,
    TaskCompletionModalComponent,
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
  visibleMaintenance$ = this.maintenanceService.maintenance$;

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
  /** Manager/Admin/Super Admin — may accept any task, matching the backend's privileged check. */
  isPrivilegedApprover = false;
  /** Technician viewer — combined with currentUserId in MaintenanceDetailComponent to self-accept their own task. */
  isTechnicianRole = false;
  currentUserId: string | null = null;
  /** Mirrors backend PERM_MAINTENANCE_DELETE — Admin/Super Admin only. */
  canDeleteMaintenance = false;
  /** Set when arriving here via a "Schedule maintenance" quick action from Alerts or an AI recommendation. */
  createPrefill: MaintenanceCreatePrefill | null = null;

  // ✅ Track whether current user is a technician and their ID,
  // so filter/page changes can route to the right loading method.
  private currentTechnicianId: string | null = null;

  showCompletionModal = false;
  completingTask: Maintenance | null = null;

  constructor(
    private maintenanceService: MaintenanceService,
    private dashboardService: DashboardService,
    private equipmentService: EquipmentService,
    private userService: UserService,
    private authService: AuthService,
    private toastService: ToastService,
    private confirmDialog: ConfirmDialogService,
    private rapportService: RapportService,
    private attachmentService: AttachmentService,
    private location: Location
  ) {}

  ngOnInit(): void {
    const navigationState = this.location.getState() as { prefill?: MaintenanceCreatePrefill } | null;
    if (navigationState?.prefill) {
      this.createPrefill = navigationState.prefill;
      this.showCreateModal = true;
    }

    this.authService.currentUser$.pipe(take(1)).subscribe(user => {
      if (!user) {
        this.maintenanceService.loadMaintenanceTasks();
        return;
      }

      this.canCreateMaintenance = !this.isTechnician(user);
      this.isPrivilegedApprover = this.hasAnyRole(user, ['MANAGER', 'ADMIN', 'SUPER_ADMIN']);
      this.isTechnicianRole = this.isTechnician(user);
      this.currentUserId = user.id || user.username || null;
      this.canDeleteMaintenance = this.hasAnyRole(user, ['ADMIN', 'SUPER_ADMIN']);

      if (this.createPrefill && !this.canCreateMaintenance) {
        this.toastService.error('You do not have permission to assign maintenance tasks.');
        this.closeCreateModal();
      }

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
    const normalizedRoles = user.roles?.map(role => normalizeRoleName(role.name)) ?? [];

    // ✅ SUPER_ADMIN always has full access, even if their account also
    // carries a TECHNICIAN role — otherwise they get silently scoped down
    // to "their own" tasks and blocked from creating new ones.
    if (normalizedRoles.includes('SUPER_ADMIN')) {
      return false;
    }

    return normalizedRoles.includes('TECHNICIAN');
  }

  private hasAnyRole(user: User, roles: string[]): boolean {
    const normalizedRoles = user.roles?.map(role => normalizeRoleName(role.name)) ?? [];
    return roles.some(role => normalizedRoles.includes(role));
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
    if (!this.canCreateMaintenance) {
      this.toastService.error('You do not have permission to assign maintenance tasks.');
      return;
    }
    this.showCreateModal = true;
  }

  handleCreate(payload: CreateTaskRequest): void {
    if (!this.canCreateMaintenance) {
      this.toastService.error('You do not have permission to assign maintenance tasks.');
      this.showCreateModal = false;
      return;
    }
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
    this.createPrefill = null;
  }

  // ===================== ACTIONS =====================

  handleStart(id: string): void {
    this.runAndRefresh(this.maintenanceService.startMaintenance(id));
  }

  /**
   * Completing a task isn't a one-click status flip — the technician must
   * file a rapport (checklist, evidence photos, parts used, labor) before
   * the work order can close. That rapport is what Manager, then Finance,
   * actually approve on the Rapport Approvals page — completing here
   * without it would silently skip that whole chain.
   */
  async handleComplete(id: string): Promise<void> {
    const current = await firstValueFrom(this.currentMaintenance$.pipe(take(1)));
    if (current?.id !== id) {
      this.toastService.error('Could not find that task — refresh and try again.');
      return;
    }
    this.completingTask = current;
    this.showCompletionModal = true;
  }

  closeCompletionModal(): void {
    this.showCompletionModal = false;
    this.completingTask = null;
  }

  handleTaskCompletion(data: any): void {
    if (!data?.taskId) return;

    this.maintenanceService.completeMaintenance(data.taskId).subscribe({
      next: () => {
        this.submitRapport(data);
        this.closeCompletionModal();
        this.handleRefresh();
        this.toastService.success('Task completed — rapport submitted for manager approval.');
      },
      error: (err) => {
        const normalized = normalizeApiError(err, 'Failed to complete task.');
        this.toastService.error(normalized.message);
      },
    });
  }

  private submitRapport(data: any): void {
    const machineId = Number(data.expense?.machineId);
    if (!machineId) return;

    const request: MaintenanceRapportRequest = {
      taskId: data.taskId,
      machineId,
      title: data.expense?.title || `Task #${data.taskId} completion rapport`,
      description: [data.rapport?.issuesFound, data.rapport?.recommendations].filter(Boolean).join(' | ') || undefined,
      workPerformed: data.rapport?.workPerformed || '',
      partsReplaced: (data.partsUsed || []).map((p: any) => p.name).filter(Boolean).join(', ') || undefined,
      laborHours: Number(data.rapport?.timeSpent) || 0,
      laborCost: Number(data.expense?.laborCost) || 0,
      parts: (data.partsUsed || [])
        .filter((p: any) => p.name)
        .map((p: any) => ({
          partName: p.name,
          quantity: Number(p.quantity) || 1,
          unitCost: Number(p.unitCost) || 0,
        })),
      checklistItems: (data.checklistItems || []).map((c: any) => ({
        description: c.description,
        passed: !!c.passed,
        notes: c.notes || undefined,
      })),
    };

    this.rapportService.createRapport(request).subscribe({
      next: (rapport) => this.uploadEvidencePhotos(rapport.id, data.attachmentFiles),
      error: (err) => console.error('Failed to submit maintenance rapport:', err),
    });
  }

  private uploadEvidencePhotos(rapportId: number, files: File[] | undefined): void {
    if (!files || files.length === 0) return;
    for (const file of files) {
      this.attachmentService.upload(file, 'MaintenanceRapport', rapportId).subscribe({
        next: () => {},
        error: (err) => console.error(`Failed to upload evidence photo "${file.name}":`, err),
      });
    }
  }

  handleApprove(id: string): void {
    this.runAndRefresh(this.maintenanceService.approveMaintenance(id));
  }

  async handleCancel(id: string): Promise<void> {
    const label = await this.describeTask(id);
    const confirmed = await this.confirmDialog.confirmDanger(
      'Cancel maintenance task',
      `Cancel ${label}? The technician will be notified and the work order will stop.`,
      'Cancel task'
    );
    if (!confirmed) {
      return;
    }
    this.runAndRefresh(this.maintenanceService.cancelMaintenance(id));
  }

  async handleDelete(id: string): Promise<void> {
    const label = await this.describeTask(id);
    const confirmed = await this.confirmDialog.confirmDanger(
      'Delete maintenance task',
      `Delete ${label}? This cannot be undone.`
    );
    if (!confirmed) {
      return;
    }
    this.runAndRefresh(this.maintenanceService.deleteMaintenance(id));
    if (this.selectedTaskId === id) this.selectedTaskId = null;
  }

  private async describeTask(id: string): Promise<string> {
    const current = await firstValueFrom(this.currentMaintenance$.pipe(take(1)));
    return current?.id === id ? `"${current.description}"` : `task #${id}`;
  }

  private runAndRefresh<T>(obs: Observable<T>): void {
    obs.pipe(take(1)).subscribe({
      next: () => {
        this.dashboardService.getMaintenancePipeline().pipe(take(1)).subscribe();
      },
      error: (err) => {
        const errorMessage = err?.error?.message || err?.message || 'Action failed';
        this.toastService.error(errorMessage);
      },
    });
  }
}
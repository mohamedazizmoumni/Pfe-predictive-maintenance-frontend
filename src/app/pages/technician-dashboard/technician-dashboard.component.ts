import { Component, OnInit, signal, computed, HostBinding } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MaintenanceService } from '../../core/services/maintenance.service';
import { AlertApiService } from '../../core/services/alert.service';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services';
import { Maintenance } from '../../core/models/sentinel.models';
import { TaskCompletionModalComponent } from './components/task-completion-modal.component';

interface TaskLog {
  description: string;
  partsUsed: string[];
  timeSpent: number;
}

@Component({
  selector: 'app-technician-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, TaskCompletionModalComponent],
  templateUrl: './technician-dashboard.component.html',
  styleUrl: './technician-dashboard.component.scss',
})
export class TechnicianDashboardComponent implements OnInit {
  // Signals
  todaysTasks = signal<Maintenance[]>([]);
  allTasks = signal<Maintenance[]>([]);
  selectedTask = signal<Maintenance | null>(null);
  alerts = signal<any[]>([]);
  selectedAlert = signal<any | null>(null);
  isDarkMode = computed(() => this.themeService.theme() === 'dark');

  // Host binding for dark mode class
  @HostBinding('class.dark-mode')
  get darkModeClass() {
    return this.isDarkMode();
  }

  // UI State
  activeTab = signal<'tasks' | 'equipment' | 'inventory'>('tasks');
  showLogModal = signal(false);
  showHistoryModal = signal(false);
  showCompletionModal = signal(false);

  // Forms
  logForm!: FormGroup;

  // Statistics
  stats = computed(() => {
    const tasks = this.todaysTasks();
    return {
      totalTasks: tasks.length,
      urgentTasks: tasks.filter(t => t.priority === 'CRITICAL' || t.priority === 'HIGH').length,
      completedTasks: tasks.filter(t => t.status === 'COMPLETED').length,
    };
  });

  constructor(
    private maintenanceService: MaintenanceService,
    private alertService: AlertApiService,
    private authService: AuthService,
    private themeService: ThemeService,
    private fb: FormBuilder,
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    this.loadData();
    this.themeService.initializeTheme();
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  private initializeForm(): void {
    this.logForm = this.fb.group({
      description: ['', [Validators.required, Validators.minLength(10)]],
      partsUsed: ['', Validators.required],
      timeSpent: ['', [Validators.required, Validators.min(1)]],
    });
  }

  loadData(): void {
    const user = this.authService.getCurrentUser();
    if (!user?.username) {
      console.error('❌ User not authenticated or missing username');
      return;
    }

    console.log('👤 Loading tasks for technician:', {
      id: user.id,
      username: user.username,
      roles: user.roles?.map(r => r.name),
    });

    // First, load ALL tasks to see what's in the database
    console.log('📋 Loading ALL tasks for debugging...');
    this.maintenanceService.getAllMaintenanceTasks(0, 100).subscribe({
      next: (allResponse: any) => {
        const allTasks = allResponse.content || allResponse.data || [];
        console.log(`📊 Total tasks in database: ${allTasks.length}`);
        
        // Now try loading with technician ID
        this.maintenanceService.getTechnicianTasks(user.id || user.username, 0, 100).subscribe({
          next: (response: any) => {
            console.log('📦 API Response for technician:', response);
            const tasks = response.content || response.data || [];
            console.log(`📊 Tasks returned for technician: ${tasks.length}`);
            
            if (tasks.length === 0) {
              console.warn('⚠️ No tasks returned from API. Trying with username as fallback...');
              // Try again with username if ID didn't work
              if (user.id !== user.username) {
                this.maintenanceService.getTechnicianTasks(user.username, 0, 100).subscribe({
                  next: (fallbackResponse: any) => {
                    const fallbackTasks = fallbackResponse.content || fallbackResponse.data || [];
                    console.log(`📊 Fallback: ${fallbackTasks.length} tasks with username`);
                    this.processTasks(fallbackTasks);
                  },
                  error: (err: any) => {
                    console.error('❌ Fallback error:', err);
                    this.todaysTasks.set([]);
                  },
                });
              } else {
                // If still no tasks, try client-side filtering of all tasks
                console.log('🔍 Attempting client-side filtering of all tasks...');
                const clientFiltered = allTasks.filter((task: any) => {
                  return task.assignedTechnicianId === user.id || task.assignedTechnicianId === user.username;
                });
                console.log(`📊 Client-side filtered: ${clientFiltered.length} tasks`);
                this.processTasks(clientFiltered);
              }
            } else {
              this.processTasks(tasks);
            }
          },
          error: (err: any) => {
            console.error('❌ Error loading technician tasks:', err);
            this.todaysTasks.set([]);
          },
        });
      },
      error: (err: any) => {
        console.error('❌ Error loading all tasks:', err);
      },
    });

    // Load alerts
    this.alertService.list({ size: 10 }).subscribe({
      next: (response: any) => {
        const alertsList = response.content || response.data || [];
        console.log('🚨 Alerts loaded:', alertsList.length);
        this.alerts.set(alertsList);
      },
      error: (err: any) => console.error('❌ Error loading alerts:', err),
    });
  }

  private processTasks(tasks: any[]): void {
    this.allTasks.set(tasks);
    
    // Filter tasks for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todaysTasks = tasks.filter((task: any) => {
      try {
        const taskDate = new Date(task.scheduledDate);
        taskDate.setHours(0, 0, 0, 0);
        return taskDate.getTime() === today.getTime();
      } catch (e) {
        console.warn('⚠️ Error parsing task date:', task.scheduledDate);
        return false;
      }
    });
    
    console.log(`📅 Today's tasks: ${todaysTasks.length}`);
    
    // If no tasks today, show all upcoming tasks
    if (todaysTasks.length === 0) {
      const upcomingTasks = tasks.filter((task: any) => {
        try {
          const taskDate = new Date(task.scheduledDate);
          return taskDate >= today && task.status !== 'COMPLETED';
        } catch (e) {
          return false;
        }
      }).sort((a: any, b: any) => {
        return new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime();
      });
      
      console.log(`📅 Upcoming tasks: ${upcomingTasks.length}`);
      this.todaysTasks.set(upcomingTasks.slice(0, 10));
    } else {
      this.todaysTasks.set(todaysTasks);
    }
  }

  selectTask(task: Maintenance): void {
    this.selectedTask.set(task);
  }

  openCompletionModal(task: Maintenance): void {
    this.selectedTask.set(task);
    this.showCompletionModal.set(true);
  }

  closeCompletionModal(): void {
    this.showCompletionModal.set(false);
    this.selectedTask.set(null);
  }

  handleTaskCompletion(data: any): void {
    console.log('📋 Task completion data:', data);

    // Mark task as completed
    if (data.taskId) {
      this.maintenanceService.completeMaintenance(data.taskId).subscribe({
        next: () => {
          console.log('✅ Task marked as completed');
          this.showCompletionModal.set(false);
          this.selectedTask.set(null);
          this.loadData();
          
          // Show success message
          alert('✅ Task completed successfully!');
        },
        error: (err: any) => {
          console.error('❌ Error completing task:', err);
          alert('Task completion failed. Please try again.');
        },
      });
    }
  }

  markAsCompleted(task: Maintenance): void {
    // Open the new completion modal instead
    this.openCompletionModal(task);
  }

  openLogModal(task: Maintenance): void {
    this.selectedTask.set(task);
    this.logForm.reset();
    this.showLogModal.set(true);
  }

  submitLog(): void {
    if (!this.logForm.valid || !this.selectedTask()) return;

    const formValue = this.logForm.value;
    const task = this.selectedTask()!;

    // Submit the log and mark task as completed
    this.maintenanceService.completeMaintenance(task.id).subscribe({
      next: () => {
        this.loadData();
        this.showLogModal.set(false);
        this.logForm.reset();
        this.selectedTask.set(null);
      },
      error: (err: any) => console.error('Error submitting log:', err),
    });
  }

  selectAlert(alert: any): void {
    this.selectedAlert.set(alert);
  }

  acknowledgeAlert(alert: any): void {
    if (!alert.id) return;
    this.alertService.acknowledge(alert.id).subscribe({
      next: () => {
        this.loadData();
        this.selectedAlert.set(null);
      },
      error: (err: any) => console.error('Error acknowledging alert:', err),
    });
  }

  closeModals(): void {
    this.showLogModal.set(false);
    this.showHistoryModal.set(false);
    this.showCompletionModal.set(false);
  }

  getTaskPriorityClass(priority: string): string {
    const priorityMap: { [key: string]: string } = {
      CRITICAL: 'priority-critical',
      HIGH: 'priority-high',
      MEDIUM: 'priority-medium',
      LOW: 'priority-low',
    };
    return priorityMap[priority] || 'priority-medium';
  }

  getTaskStatusClass(status: string): string {
    const statusMap: { [key: string]: string } = {
      SCHEDULED: 'status-scheduled',
      IN_PROGRESS: 'status-in-progress',
      COMPLETED: 'status-completed',
      APPROVED: 'status-approved',
      CANCELLED: 'status-cancelled',
    };
    return statusMap[status] || 'status-scheduled';
  }

  getAlertSeverityClass(severity: string): string {
    const severityMap: { [key: string]: string } = {
      CRITICAL: 'severity-critical',
      HIGH: 'severity-high',
      MEDIUM: 'severity-medium',
      LOW: 'severity-low',
    };
    return severityMap[severity] || 'severity-medium';
  }

  formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateString;
    }
  }

  formatTime(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  }

  getTaskImage(task: Maintenance): string {
    // Return a placeholder image based on machine type
    return 'https://via.placeholder.com/200x150?text=Equipment';
  }

  getScheduledTime(task: Maintenance): string {
    try {
      const date = new Date(task.scheduledDate);
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'N/A';
    }
  }

  getTimeAgo(dateString: string): string {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      return `${diffDays}d ago`;
    } catch {
      return 'N/A';
    }
  }
}

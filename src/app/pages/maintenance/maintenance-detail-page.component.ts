import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MaintenanceService } from '../../core/services/maintenance.service';
import { Maintenance } from '../../core/models/sentinel.models';
import { TaskCompletionModalComponent } from '../technician-dashboard/components/task-completion-modal.component';

@Component({
  selector: 'app-maintenance-detail-page',
  standalone: true,
  imports: [CommonModule, RouterLink, TaskCompletionModalComponent],
  template: `
    <div class="detail-page">
      <div class="page-header">
        <button class="btn-back" (click)="goBack()">
          ← Back
        </button>
        <h1>Maintenance Task Details</h1>
      </div>

      <div *ngIf="task(); else loading" class="task-detail-container">
        <!-- Task Header -->
        <div class="task-header" data-card>
          <div class="header-content">
            <div class="task-title-section">
              <h2>{{ task()?.description }}</h2>
              <div class="task-meta">
                <span class="badge" [class]="getStatusClass(task()?.status || '')">
                  {{ task()?.status }}
                </span>
                <span class="badge" [class]="getPriorityClass(task()?.priority || '')">
                  {{ task()?.priority }}
                </span>
                <span class="badge type">{{ task()?.type }}</span>
              </div>
            </div>
            <div class="task-actions">
              <!-- Approve Button (SCHEDULED status) -->
              <button 
                *ngIf="task()?.status === 'SCHEDULED'"
                class="btn-approve"
                (click)="approveTask()"
              >
                ✓ Approve Task
              </button>

              <!-- Start Button (APPROVED status) -->
              <button 
                *ngIf="task()?.status === 'APPROVED'"
                class="btn-start"
                (click)="startTask()"
              >
                ▶ Start Task
              </button>

              <!-- Complete Button (IN_PROGRESS status) -->
              <button 
                *ngIf="task()?.status === 'IN_PROGRESS'"
                class="btn-primary"
                (click)="openCompletionModal()"
              >
                ✓ Complete Task
              </button>
            </div>
          </div>
        </div>

        <!-- Timer Card (only show when IN_PROGRESS) -->
        <div *ngIf="task()?.status === 'IN_PROGRESS'" class="timer-card" data-card>
          <div class="timer-content">
            <div class="timer-info">
              <h3>⏱️ Task Timer</h3>
              <p class="timer-subtitle">Time elapsed since task started</p>
            </div>
            
            <div class="timer-display-section">
              <div class="timer-main">
                <span class="timer-value" [class.overtime]="isOvertime()">
                  {{ timerDisplay() }}
                </span>
                <span class="timer-label">Elapsed Time</span>
              </div>
              
              <div class="timer-estimated">
                <span class="estimated-label">Estimated:</span>
                <span class="estimated-value">{{ task()?.estimatedDuration }} hours</span>
              </div>
            </div>

            <div class="timer-progress">
              <div class="progress-bar">
                <div 
                  class="progress-fill" 
                  [style.width.%]="timerPercentage()"
                  [class.overtime]="isOvertime()"
                ></div>
              </div>
              <div class="progress-info">
                <span>{{ timerPercentage().toFixed(0) }}% of estimated time</span>
                <span *ngIf="isOvertime()" class="overtime-badge">⚠️ Overtime</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Task Information Grid -->
        <div class="info-grid">
          <!-- Basic Information -->
          <div class="info-card" data-card>
            <h3>📋 Basic Information</h3>
            <div class="info-list">
              <div class="info-item">
                <span class="label">Task ID:</span>
                <span class="value">{{ task()?.id }}</span>
              </div>
              <div class="info-item">
                <span class="label">Machine ID:</span>
                <span class="value">{{ task()?.machineId }}</span>
              </div>
              <div class="info-item">
                <span class="label">Type:</span>
                <span class="value">{{ task()?.type }}</span>
              </div>
              <div class="info-item">
                <span class="label">Priority:</span>
                <span class="value priority" [class]="getPriorityClass(task()?.priority || '')">
                  {{ task()?.priority }}
                </span>
              </div>
            </div>
          </div>

          <!-- Schedule Information -->
          <div class="info-card" data-card>
            <h3>📅 Schedule</h3>
            <div class="info-list">
              <div class="info-item">
                <span class="label">Scheduled Date:</span>
                <span class="value">{{ formatDate(task()?.scheduledDate) }}</span>
              </div>
              <div class="info-item">
                <span class="label">Estimated Duration:</span>
                <span class="value">{{ task()?.estimatedDuration }} hours</span>
              </div>
              <div class="info-item" *ngIf="task()?.startDate">
                <span class="label">Start Date:</span>
                <span class="value">{{ formatDate(task()?.startDate) }}</span>
              </div>
              <div class="info-item" *ngIf="task()?.completedDate">
                <span class="label">Completed Date:</span>
                <span class="value">{{ formatDate(task()?.completedDate) }}</span>
              </div>
            </div>
          </div>

          <!-- Assignment Information -->
          <div class="info-card" data-card>
            <h3>👤 Assignment</h3>
            <div class="info-list">
              <div class="info-item">
                <span class="label">Assigned Technician:</span>
                <span class="value">{{ task()?.assignedTechnicianId || 'Not assigned' }}</span>
              </div>
              <div class="info-item" *ngIf="task()?.approvedBy">
                <span class="label">Approved By:</span>
                <span class="value">{{ task()?.approvedBy }}</span>
              </div>
              <div class="info-item" *ngIf="task()?.approvedDate">
                <span class="label">Approved Date:</span>
                <span class="value">{{ formatDate(task()?.approvedDate) }}</span>
              </div>
            </div>
          </div>

          <!-- Status Information -->
          <div class="info-card" data-card>
            <h3>📊 Status</h3>
            <div class="info-list">
              <div class="info-item">
                <span class="label">Current Status:</span>
                <span class="value status" [class]="getStatusClass(task()?.status || '')">
                  {{ task()?.status }}
                </span>
              </div>
              <div class="info-item">
                <span class="label">Created Date:</span>
                <span class="value">{{ formatDate(task()?.createdDate) }}</span>
              </div>
              <div class="info-item" *ngIf="task()?.lastModifiedDate">
                <span class="label">Last Modified:</span>
                <span class="value">{{ formatDate(task()?.lastModifiedDate) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Description -->
        <div class="description-card" data-card>
          <h3>📝 Description</h3>
          <p>{{ task()?.description }}</p>
        </div>

        <!-- Notes -->
        <div class="notes-card" data-card *ngIf="task()?.notes">
          <h3>📌 Notes</h3>
          <p>{{ task()?.notes }}</p>
        </div>
      </div>

      <ng-template #loading>
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Loading task details...</p>
        </div>
      </ng-template>

      <!-- Task Completion Modal -->
      <app-task-completion-modal
        *ngIf="showCompletionModal()"
        [task]="task()"
        (completed)="handleTaskCompletion($event)"
        (cancelled)="closeCompletionModal()"
      />
    </div>
  `,
  styles: [`
    .detail-page {
      padding: 2rem;
      background: #0f172a;
      min-height: 100vh;
      color: #f1f5f9;
    }

    .page-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 2rem;

      .btn-back {
        padding: 0.75rem 1.5rem;
        background: #1e293b;
        border: 1px solid #475569;
        border-radius: 6px;
        color: #f1f5f9;
        cursor: pointer;
        transition: all 0.2s ease;

        &:hover {
          background: #334155;
        }
      }

      h1 {
        margin: 0;
        font-size: 2rem;
        color: #f1f5f9;
      }
    }

    .task-detail-container {
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }

    .task-header {
      padding: 2rem;
      background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.1);

      .header-content {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 2rem;
      }

      .task-title-section {
        flex: 1;

        h2 {
          margin: 0 0 1rem 0;
          font-size: 1.8rem;
          color: white;
        }

        .task-meta {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
        }
      }

      .task-actions {
        display: flex;
        gap: 1rem;

        .btn-primary, .btn-approve, .btn-start {
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;

          &:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
          }
        }

        .btn-primary {
          background: white;
          color: #3b82f6;
        }

        .btn-approve {
          background: #10b981;
          color: white;
        }

        .btn-start {
          background: #f59e0b;
          color: white;
        }
      }
    }

    .timer-card {
      padding: 2rem;
      background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%);
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      animation: pulse 2s ease-in-out infinite;

      .timer-content {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
      }

      .timer-info {
        h3 {
          margin: 0 0 0.5rem 0;
          font-size: 1.5rem;
          color: white;
        }

        .timer-subtitle {
          margin: 0;
          color: rgba(255, 255, 255, 0.9);
          font-size: 0.95rem;
        }
      }

      .timer-display-section {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 2rem;
      }

      .timer-main {
        display: flex;
        flex-direction: column;
        align-items: center;

        .timer-value {
          font-size: 3.5rem;
          font-weight: 700;
          color: white;
          font-family: 'Courier New', monospace;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);

          &.overtime {
            color: #fca5a5;
            animation: blink 1s ease-in-out infinite;
          }
        }

        .timer-label {
          font-size: 0.9rem;
          color: rgba(255, 255, 255, 0.8);
          margin-top: 0.5rem;
        }
      }

      .timer-estimated {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        padding: 1rem;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 8px;

        .estimated-label {
          font-size: 0.85rem;
          color: rgba(255, 255, 255, 0.8);
        }

        .estimated-value {
          font-size: 1.5rem;
          font-weight: 600;
          color: white;
        }
      }

      .timer-progress {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;

        .progress-bar {
          width: 100%;
          height: 12px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 6px;
          overflow: hidden;

          .progress-fill {
            height: 100%;
            background: white;
            transition: width 0.3s ease;
            border-radius: 6px;

            &.overtime {
              background: #fca5a5;
            }
          }
        }

        .progress-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.9rem;
          color: rgba(255, 255, 255, 0.9);

          .overtime-badge {
            padding: 0.25rem 0.75rem;
            background: rgba(239, 68, 68, 0.3);
            border-radius: 12px;
            font-weight: 600;
            animation: blink 1s ease-in-out infinite;
          }
        }
      }
    }

    @keyframes pulse {
      0%, 100% {
        box-shadow: 0 0 20px rgba(245, 158, 11, 0.3);
      }
      50% {
        box-shadow: 0 0 40px rgba(245, 158, 11, 0.5);
      }
    }

    @keyframes blink {
      0%, 100% {
        opacity: 1;
      }
      50% {
        opacity: 0.6;
      }
    }

    .badge {
      padding: 0.5rem 1rem;
      border-radius: 20px;
      font-size: 0.85rem;
      font-weight: 600;
      text-transform: uppercase;
      background: rgba(255, 255, 255, 0.2);
      color: white;

      &.status-scheduled { background: rgba(59, 130, 246, 0.3); }
      &.status-in-progress { background: rgba(245, 158, 11, 0.3); }
      &.status-completed { background: rgba(16, 185, 129, 0.3); }
      &.status-approved { background: rgba(16, 185, 129, 0.3); }
      &.status-cancelled { background: rgba(239, 68, 68, 0.3); }

      &.priority-critical { background: rgba(239, 68, 68, 0.3); }
      &.priority-high { background: rgba(245, 158, 11, 0.3); }
      &.priority-medium { background: rgba(59, 130, 246, 0.3); }
      &.priority-low { background: rgba(100, 116, 139, 0.3); }

      &.type { background: rgba(139, 92, 246, 0.3); }
    }

    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 1.5rem;
    }

    .info-card {
      padding: 1.5rem;
      background: #1e293b;
      border: 1px solid #475569;
      border-radius: 12px;

      h3 {
        margin: 0 0 1.5rem 0;
        font-size: 1.2rem;
        color: #f1f5f9;
      }

      .info-list {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .info-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-bottom: 0.75rem;
        border-bottom: 1px solid #334155;

        &:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }

        .label {
          font-size: 0.9rem;
          color: #cbd5e1;
          font-weight: 600;
        }

        .value {
          font-size: 0.95rem;
          color: #f1f5f9;
          text-align: right;

          &.priority {
            padding: 0.25rem 0.75rem;
            border-radius: 12px;
            font-weight: 600;
            font-size: 0.85rem;
          }

          &.priority-critical {
            background: rgba(239, 68, 68, 0.2);
            color: #fca5a5;
          }

          &.priority-high {
            background: rgba(245, 158, 11, 0.2);
            color: #fcd34d;
          }

          &.priority-medium {
            background: rgba(59, 130, 246, 0.2);
            color: #93c5fd;
          }

          &.priority-low {
            background: rgba(100, 116, 139, 0.2);
            color: #cbd5e1;
          }

          &.status {
            padding: 0.25rem 0.75rem;
            border-radius: 12px;
            font-weight: 600;
            font-size: 0.85rem;
          }

          &.status-scheduled {
            background: rgba(59, 130, 246, 0.2);
            color: #93c5fd;
          }

          &.status-in-progress {
            background: rgba(245, 158, 11, 0.2);
            color: #fcd34d;
          }

          &.status-completed, &.status-approved {
            background: rgba(16, 185, 129, 0.2);
            color: #86efac;
          }

          &.status-cancelled {
            background: rgba(239, 68, 68, 0.2);
            color: #fca5a5;
          }
        }
      }
    }

    .description-card, .notes-card {
      padding: 1.5rem;
      background: #1e293b;
      border: 1px solid #475569;
      border-radius: 12px;

      h3 {
        margin: 0 0 1rem 0;
        font-size: 1.2rem;
        color: #f1f5f9;
      }

      p {
        margin: 0;
        line-height: 1.6;
        color: #cbd5e1;
      }
    }

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4rem 2rem;
      gap: 1rem;

      .spinner {
        width: 50px;
        height: 50px;
        border: 4px solid #334155;
        border-top-color: #3b82f6;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      p {
        color: #cbd5e1;
        font-size: 1.1rem;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    }

    @media (max-width: 768px) {
      .detail-page {
        padding: 1rem;
      }

      .page-header {
        h1 {
          font-size: 1.5rem;
        }
      }

      .task-header .header-content {
        flex-direction: column;
      }

      .info-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class MaintenanceDetailPageComponent implements OnInit, OnDestroy {
  task = signal<Maintenance | null>(null);
  showCompletionModal = signal(false);
  
  // Timer state
  timerRunning = signal(false);
  elapsedSeconds = signal(0);
  estimatedSeconds = signal(0);
  timerDisplay = signal('00:00:00');
  timerPercentage = signal(0);
  isOvertime = signal(false);
  
  private timerInterval: any = null;
  private readonly TIMER_STORAGE_KEY = 'task_timer_';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private maintenanceService: MaintenanceService
  ) {}

  ngOnInit(): void {
    const taskId = this.route.snapshot.paramMap.get('id');
    if (taskId) {
      this.loadTask(taskId);
    }
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }

  loadTask(id: string): void {
    this.maintenanceService.getMaintenance(id).subscribe({
      next: (task: Maintenance) => {
        this.task.set(task);
        
        // Initialize timer if task is in progress
        if (task.status === 'IN_PROGRESS' && task.startDate) {
          this.initializeTimer(task);
        }
        
        // Calculate estimated seconds
        if (task.estimatedDuration) {
          this.estimatedSeconds.set(task.estimatedDuration * 3600); // hours to seconds
        }
      },
      error: (err: any) => {
        console.error('Error loading task:', err);
        alert('Failed to load task details');
        this.goBack();
      }
    });
  }

  private initializeTimer(task: Maintenance): void {
    if (!task.startDate) return;
    
    const startTime = new Date(task.startDate).getTime();
    const now = Date.now();
    const elapsed = Math.floor((now - startTime) / 1000);
    
    this.elapsedSeconds.set(elapsed);
    this.startTimer();
  }

  private startTimer(): void {
    if (this.timerInterval) return;
    
    this.timerRunning.set(true);
    this.timerInterval = setInterval(() => {
      this.elapsedSeconds.update(s => s + 1);
      this.updateTimerDisplay();
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.timerRunning.set(false);
  }

  private updateTimerDisplay(): void {
    const elapsed = this.elapsedSeconds();
    const estimated = this.estimatedSeconds();
    
    // Calculate hours, minutes, seconds
    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    const seconds = elapsed % 60;
    
    // Format display
    const display = `${this.pad(hours)}:${this.pad(minutes)}:${this.pad(seconds)}`;
    this.timerDisplay.set(display);
    
    // Calculate percentage and overtime
    if (estimated > 0) {
      const percentage = Math.min((elapsed / estimated) * 100, 100);
      this.timerPercentage.set(percentage);
      this.isOvertime.set(elapsed > estimated);
    }
  }

  private pad(num: number): string {
    return num.toString().padStart(2, '0');
  }

  approveTask(): void {
    const task = this.task();
    if (!task) return;
    
    if (confirm('Approve this task? This will allow you to start working on it.')) {
      this.maintenanceService.approveMaintenance(task.id).subscribe({
        next: () => {
          console.log('✅ Task approved');
          this.loadTask(task.id);
          alert('✅ Task approved! You can now start working on it.');
        },
        error: (err: any) => {
          console.error('❌ Error approving task:', err);
          alert('Failed to approve task. Please try again.');
        }
      });
    }
  }

  startTask(): void {
    const task = this.task();
    if (!task) return;
    
    if (confirm('Start this task? The timer will begin counting.')) {
      this.maintenanceService.startMaintenance(task.id).subscribe({
        next: (updatedTask) => {
          console.log('✅ Task started');
          this.task.set(updatedTask);
          this.elapsedSeconds.set(0);
          this.startTimer();
          alert('✅ Task started! Timer is now running.');
        },
        error: (err: any) => {
          console.error('❌ Error starting task:', err);
          alert('Failed to start task. Please try again.');
        }
      });
    }
  }

  openCompletionModal(): void {
    this.showCompletionModal.set(true);
  }

  closeCompletionModal(): void {
    this.showCompletionModal.set(false);
  }

  handleTaskCompletion(data: any): void {
    console.log('📋 Task completion data:', data);

    // Stop the timer
    this.stopTimer();

    // Mark task as completed (expense submission removed - simple finance module deleted)
    if (data.taskId) {
      this.maintenanceService.completeMaintenance(data.taskId).subscribe({
        next: () => {
          console.log('✅ Task marked as completed');
          this.showCompletionModal.set(false);
          this.loadTask(data.taskId);
          
          const elapsed = this.timerDisplay();
          alert(`✅ Task completed successfully!\nTime taken: ${elapsed}`);
        },
        error: (err: any) => {
          console.error('❌ Error completing task:', err);
          alert('Task completion failed. Please try again.');
        },
      });
    }
  }

  goBack(): void {
    this.router.navigate(['/technician-calendar']);
  }

  getStatusClass(status: string): string {
    return `status-${status.toLowerCase().replace('_', '-')}`;
  }

  getPriorityClass(priority: string): string {
    return `priority-${priority.toLowerCase()}`;
  }

  formatDate(dateString: string | undefined): string {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  }
}

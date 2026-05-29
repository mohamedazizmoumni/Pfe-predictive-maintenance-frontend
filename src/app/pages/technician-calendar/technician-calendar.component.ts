import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { MaintenanceService } from '../../core/services/maintenance.service';
import { AlertApiService } from '../../core/services/alert.service';
import { User, Maintenance, AlertResponse } from '../../core/models/sentinel.models';

interface CalendarDay {
  date: Date;
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  tasks: Maintenance[];
  alerts: AlertResponse[];
  hasEvents: boolean;
}

interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  type: 'TASK' | 'ALERT' | 'MEETING';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: string;
  description?: string;
}

@Component({
  selector: 'app-technician-calendar',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './technician-calendar.component.html',
  styleUrls: ['./technician-calendar.component.scss']
})
export class TechnicianCalendarComponent implements OnInit {
  // State
  readonly currentUser = signal<User | null>(null);
  readonly currentDate = signal(new Date());
  readonly selectedDate = signal<Date | null>(null);
  readonly tasks = signal<Maintenance[]>([]);
  readonly alerts = signal<AlertResponse[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  // UI State
  readonly selectedEvent = signal<CalendarEvent | null>(null);
  readonly showEventModal = signal(false);
  readonly viewMode = signal<'month' | 'week' | 'day'>('month');

  // Filters
  readonly filterType = signal<'ALL' | 'TASK' | 'ALERT' | 'MEETING'>('ALL');
  readonly filterPriority = signal<'ALL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('ALL');
  readonly filterStatus = signal<'ALL' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'NEW' | 'ACKNOWLEDGED'>('ALL');

  // Computed
  readonly currentMonth = computed(() => this.currentDate().getMonth());
  readonly currentYear = computed(() => this.currentDate().getFullYear());
  readonly monthName = computed(() => {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];
    return months[this.currentMonth()];
  });

  readonly calendarDays = computed(() => this.generateCalendarDays());

  readonly allEvents = computed(() => {
    const events: CalendarEvent[] = [];
    
    // Add tasks as events
    this.tasks().forEach(task => {
      events.push({
        id: `task-${task.id}`,
        title: task.description,
        date: new Date(task.scheduledDate),
        type: 'TASK',
        priority: this.mapPriority(task.priority),
        status: task.status,
        description: task.description
      });
    });

    // Add alerts as events
    this.alerts().forEach(alert => {
      events.push({
        id: `alert-${alert.id}`,
        title: alert.title,
        date: new Date(alert.createdDate),
        type: 'ALERT',
        priority: this.mapAlertSeverity(alert.severity),
        status: alert.status,
        description: alert.message
      });
    });

    return events;
  });

  readonly filteredEvents = computed(() => {
    let events = this.allEvents();
    
    if (this.filterType() !== 'ALL') {
      events = events.filter(e => e.type === this.filterType());
    }
    
    if (this.filterPriority() !== 'ALL') {
      events = events.filter(e => e.priority === this.filterPriority());
    }
    
    if (this.filterStatus() !== 'ALL') {
      events = events.filter(e => e.status === this.filterStatus());
    }
    
    return events;
  });

  readonly upcomingEvents = computed(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return this.filteredEvents()
      .filter(e => e.date >= today)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 10);
  });

  readonly eventStats = computed(() => {
    const events = this.filteredEvents();
    return {
      total: events.length,
      tasks: events.filter(e => e.type === 'TASK').length,
      alerts: events.filter(e => e.type === 'ALERT').length,
      critical: events.filter(e => e.priority === 'CRITICAL').length,
      completed: events.filter(e => e.status === 'COMPLETED').length,
    };
  });

  constructor(
    private authService: AuthService,
    private maintenanceService: MaintenanceService,
    private alertService: AlertApiService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.error.set(null);

    this.authService.currentUser$.subscribe(user => {
      this.currentUser.set(user);
      
      if (user) {
        console.log('👤 Loading calendar tasks for technician:', {
          id: user.id,
          username: user.username,
          roles: user.roles?.map(r => r.name),
        });

        // Load assigned tasks using the new getTechnicianTasks method
        this.maintenanceService.getTechnicianTasks(user.id || user.username, 0, 100).subscribe({
          next: (response) => {
            console.log('📦 Calendar API Response:', response);
            const tasks = response.content || [];
            console.log(`📊 Tasks loaded for calendar: ${tasks.length}`);
            
            if (tasks.length === 0 && user.id !== user.username) {
              console.warn('⚠️ No tasks with ID, trying with username...');
              this.maintenanceService.getTechnicianTasks(user.username, 0, 100).subscribe({
                next: (fallbackResponse) => {
                  const fallbackTasks = fallbackResponse.content || [];
                  console.log(`📊 Fallback tasks: ${fallbackTasks.length}`);
                  this.tasks.set(fallbackTasks);
                  this.loading.set(false);
                },
                error: (err) => {
                  console.error('❌ Fallback error:', err);
                  this.error.set('Failed to load tasks');
                  this.loading.set(false);
                }
              });
            } else {
              this.tasks.set(tasks);
              this.loading.set(false);
            }
          },
          error: (err) => {
            console.error('❌ Failed to load tasks:', err);
            this.error.set('Failed to load tasks');
            this.loading.set(false);
          }
        });

        // Load assigned alerts
        this.alertService.list({ assignedTo: user.username, size: 100 }).subscribe({
          next: (response) => {
            console.log('🚨 Alerts loaded:', response.content?.length || 0);
            this.alerts.set(response.content);
          },
          error: (err) => {
            console.error('❌ Failed to load alerts:', err);
            this.error.set('Failed to load alerts');
          }
        });
      }
    });
  }

  private filterAssignedTasks(tasks: Maintenance[], user: User): Maintenance[] {
    console.log('🔍 Filtering calendar tasks for user:', { id: user.id, username: user.username });
    const filtered = tasks.filter(task => 
      Number(task.assignedTechnicianId) === Number(user.id)
    );
    console.log(`📊 Filtered: ${filtered.length} tasks`);
    return filtered;
  }

  private generateCalendarDays(): CalendarDay[] {
    const year = this.currentYear();
    const month = this.currentMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const days: CalendarDay[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      
      const isCurrentMonth = date.getMonth() === month;
      const isToday = date.getTime() === today.getTime();
      
      const dayTasks = this.tasks().filter(task => {
        const taskDate = new Date(task.scheduledDate);
        taskDate.setHours(0, 0, 0, 0);
        return taskDate.getTime() === date.getTime();
      });

      const dayAlerts = this.alerts().filter(alert => {
        const alertDate = new Date(alert.createdDate);
        alertDate.setHours(0, 0, 0, 0);
        return alertDate.getTime() === date.getTime();
      });
      
      days.push({
        date: new Date(date),
        dayOfMonth: date.getDate(),
        isCurrentMonth,
        isToday,
        tasks: dayTasks,
        alerts: dayAlerts,
        hasEvents: dayTasks.length > 0 || dayAlerts.length > 0
      });
    }
    
    return days;
  }

  previousMonth(): void {
    const newDate = new Date(this.currentDate());
    newDate.setMonth(newDate.getMonth() - 1);
    this.currentDate.set(newDate);
  }

  nextMonth(): void {
    const newDate = new Date(this.currentDate());
    newDate.setMonth(newDate.getMonth() + 1);
    this.currentDate.set(newDate);
  }

  goToToday(): void {
    this.currentDate.set(new Date());
  }

  selectDate(day: CalendarDay): void {
    this.selectedDate.set(day.date);
  }

  selectEvent(event: CalendarEvent): void {
    this.selectedEvent.set(event);
    this.showEventModal.set(true);
  }

  viewEventDetails(event: CalendarEvent): void {
    if (event.type === 'TASK' && event.id) {
      // Extract task ID from "task-123" format
      const taskId = event.id.replace('task-', '');
      this.closeModal();
      this.router.navigate(['/maintenance', taskId]);
    } else if (event.type === 'ALERT' && event.id) {
      // For alerts, navigate to alerts page
      const alertId = event.id.replace('alert-', '');
      this.closeModal();
      this.router.navigate(['/alerts'], { queryParams: { id: alertId } });
    }
  }

  closeModal(): void {
    this.showEventModal.set(false);
    this.selectedEvent.set(null);
  }

  onFilterTypeChange(event: Event): void {
    const { value } = event.target as HTMLSelectElement;
    this.filterType.set(value as any);
  }

  onFilterPriorityChange(event: Event): void {
    const { value } = event.target as HTMLSelectElement;
    this.filterPriority.set(value as any);
  }

  onFilterStatusChange(event: Event): void {
    const { value } = event.target as HTMLSelectElement;
    this.filterStatus.set(value as any);
  }

  getEventTypeIcon(type: string): string {
    switch (type) {
      case 'TASK': return '📋';
      case 'ALERT': return '🚨';
      case 'MEETING': return '👥';
      default: return '📌';
    }
  }

  getEventTypeClass(type: string): string {
    return `event-${type.toLowerCase()}`;
  }

  getPriorityClass(priority: string): string {
    return `priority-${priority.toLowerCase()}`;
  }

  getStatusClass(status: string): string {
    return `status-${status.toLowerCase()}`;
  }

  formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }

  formatTime(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }

  private mapPriority(priority?: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    switch (priority?.toUpperCase()) {
      case 'CRITICAL':
      case 'EMERGENCY':
        return 'CRITICAL';
      case 'HIGH':
        return 'HIGH';
      case 'MEDIUM':
        return 'MEDIUM';
      default:
        return 'LOW';
    }
  }
  selectTaskEvent(t: any) {
  this.selectEvent({
    id: 'task-' + t.id,
    title: t.description,
    date: new Date(t.scheduledDate),
    type: 'TASK',
    priority: this.mapPriority(t.priority),
    status: t.status
  });
}

selectAlertEvent(a: any) {
  this.selectEvent({
    id: 'alert-' + a.id,
    title: a.title,
    date: new Date(a.createdDate),
    type: 'ALERT',
    priority: this.mapAlertSeverity(a.severity),
    status: a.status
  });
}
get selectedEventDate(): Date | null {
  return this.selectedEvent()?.date ?? null;
}

get selectedEventDateFormatted(): string {
  const date = this.selectedEventDate;
  if (!date) return '';
  return this.formatDate(date);
}

get selectedEventTimeFormatted(): string {
  const date = this.selectedEventDate;
  if (!date) return '';
  return this.formatTime(date);
}

openSelectedEvent(): void {
  const event = this.selectedEvent();
  if (!event) return;
  this.viewEventDetails(event);
}

  private mapAlertSeverity(severity?: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL':
        return 'CRITICAL';
      case 'WARNING':
        return 'HIGH';
      case 'INFO':
        return 'LOW';
      default:
        return 'MEDIUM';
    }
  }

  getTasksForDate(date: Date): Maintenance[] {
    return this.tasks().filter(task => {
      const taskDate = new Date(task.scheduledDate);
      return taskDate.toDateString() === date.toDateString();
    });
  }

  getAlertsForDate(date: Date): AlertResponse[] {
    return this.alerts().filter(alert => {
      const alertDate = new Date(alert.createdDate);
      return alertDate.toDateString() === date.toDateString();
    });
  }
}

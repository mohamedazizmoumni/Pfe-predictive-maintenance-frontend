import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaintenanceService } from '../../../../core/services/maintenance.service';
import { Maintenance } from '../../../../core/models/sentinel.models';

// Type alias for clarity
type MaintenanceTask = Maintenance;

interface CalendarDay {
  date: Date;
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  tasks: MaintenanceTask[];
}

interface CalendarEvent {
  id: number;
  title: string;
  date: Date;
  type: 'TASK' | 'MEETING' | 'DEADLINE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  assignee?: string;
}

@Component({
  selector: 'app-technician-calendar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './technician-calendar.component.html',
  styleUrls: ['./technician-calendar.component.scss']
})
export class TechnicianCalendarComponent implements OnInit {
  // State
  readonly currentDate = signal(new Date());
  readonly selectedDate = signal<Date | null>(null);
  readonly tasks = signal<MaintenanceTask[]>([]);
  readonly events = signal<CalendarEvent[]>([]);
  readonly loading = signal(false);
  readonly selectedEvent = signal<CalendarEvent | null>(null);
  readonly showEventModal = signal(false);

  // Filters
  readonly filterType = signal<'ALL' | 'TASK' | 'MEETING' | 'DEADLINE'>('ALL');
  readonly filterPriority = signal<'ALL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('ALL');
  readonly filterTechnician = signal<string>('');

  // Computed
  readonly currentMonth = computed(() => this.currentDate().getMonth());
  readonly currentYear = computed(() => this.currentDate().getFullYear());
  readonly monthName = computed(() => {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];
    return months[this.currentMonth()];
  });

  readonly calendarDays = computed(() => this.generateCalendarDays());

  readonly filteredEvents = computed(() => {
    let filtered = this.events();
    
    if (this.filterType() !== 'ALL') {
      filtered = filtered.filter(e => e.type === this.filterType());
    }
    
    if (this.filterPriority() !== 'ALL') {
      filtered = filtered.filter(e => e.priority === this.filterPriority());
    }
    
    if (this.filterTechnician()) {
      filtered = filtered.filter(e => e.assignee?.includes(this.filterTechnician()));
    }
    
    return filtered;
  });

  readonly upcomingEvents = computed(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return this.filteredEvents()
      .filter(e => e.date >= today)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 5);
  });

  readonly technicians = computed(() => {
    const techs = new Set<string>();
    this.events().forEach(e => {
      if (e.assignee) techs.add(e.assignee);
    });
    return Array.from(techs).sort();
  });

  constructor(private maintenanceService: MaintenanceService) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    
    this.maintenanceService.getAllMaintenanceTasks().subscribe({
      next: (response) => {
        this.tasks.set(response.content);
        this.generateEvents(response.content);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        // Use mock data on error
        this.generateMockEvents();
      }
    });
  }

  private generateEvents(tasks: MaintenanceTask[]): void {
    const events: CalendarEvent[] = [];
    
    tasks.forEach(task => {
      if (task.scheduledDate) {
        events.push({
          id: parseInt(task.id),
          title: `${task.type}: ${task.description || 'Maintenance Task'}`,
          date: new Date(task.scheduledDate),
          type: 'TASK',
          priority: this.mapPriority(task.priority),
          description: task.description || '',
          assignee: task.assignedTechnicianId
        });
      }
    });
    
    this.events.set(events);
  }

  private generateMockEvents(): void {
    const today = new Date();
    const mockEvents: CalendarEvent[] = [
      {
        id: 1,
        title: 'CNC Press #1 - Preventive Maintenance',
        date: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1),
        type: 'TASK',
        priority: 'HIGH',
        description: 'Quarterly lubrication and calibration',
        assignee: 'Ahmed B.'
      },
      {
        id: 2,
        title: 'Team Meeting - Maintenance Planning',
        date: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2),
        type: 'MEETING',
        priority: 'MEDIUM',
        description: 'Q2 maintenance schedule review',
        assignee: 'All Technicians'
      },
      {
        id: 3,
        title: 'Robot R-7 - Servo Motor Replacement',
        date: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 5),
        type: 'TASK',
        priority: 'CRITICAL',
        description: 'Emergency repair - servo motor failure',
        assignee: 'Sami K.'
      },
      {
        id: 4,
        title: 'Laser Cutter LC-2 - Deadline',
        date: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7),
        type: 'DEADLINE',
        priority: 'HIGH',
        description: 'Complete laser head replacement',
        assignee: 'Youssef M.'
      },
      {
        id: 5,
        title: 'Turbine T-12 - Blade Inspection',
        date: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 10),
        type: 'TASK',
        priority: 'MEDIUM',
        description: 'Annual blade inspection and bearing replacement',
        assignee: 'Nour A.'
      },
      {
        id: 6,
        title: 'Generator G-5 - Annual Overhaul',
        date: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 15),
        type: 'TASK',
        priority: 'MEDIUM',
        description: 'Annual overhaul and filter replacement',
        assignee: 'Ahmed B.'
      }
    ];
    
    this.events.set(mockEvents);
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
        if (!task.scheduledDate) return false;
        const taskDate = new Date(task.scheduledDate);
        taskDate.setHours(0, 0, 0, 0);
        return taskDate.getTime() === date.getTime();
      });
      
      days.push({
        date: new Date(date),
        dayOfMonth: date.getDate(),
        isCurrentMonth,
        isToday,
        tasks: dayTasks
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

  closeEventModal(): void {
    this.showEventModal.set(false);
    this.selectedEvent.set(null);
  }

  getEventClass(event: CalendarEvent): string {
    return `event-${event.type.toLowerCase()} priority-${event.priority.toLowerCase()}`;
  }

  getPriorityColor(priority: string): string {
    switch (priority) {
      case 'CRITICAL':
        return '#ef4444';
      case 'HIGH':
        return '#f97316';
      case 'MEDIUM':
        return '#eab308';
      case 'LOW':
        return '#22c55e';
      default:
        return '#6b7280';
    }
  }

  getTasksForDate(date: Date): MaintenanceTask[] {
    return this.tasks().filter(task => {
      if (!task.scheduledDate) return false;
      const taskDate = new Date(task.scheduledDate);
      return taskDate.toDateString() === date.toDateString();
    });
  }

  getEventsForDate(date: Date): CalendarEvent[] {
    return this.events().filter(event => {
      return event.date.toDateString() === date.toDateString();
    });
  }

  formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }

  formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }
}

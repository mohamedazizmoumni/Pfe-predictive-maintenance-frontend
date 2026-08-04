import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CapacityService } from '../../core/services/capacity.service';
import { CalendarService } from '../../core/services/calendar.service';
import { CalendarEventDto, TechnicianCapacity } from '../../core/models/sentinel.models';

interface CalendarDay {
  date: Date;
  inCurrentMonth: boolean;
  isToday: boolean;
  events: CalendarEventDto[];
}

@Component({
  selector: 'app-team-capacity',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './team-capacity.component.html',
  styleUrl: './team-capacity.component.scss',
})
export class TeamCapacityComponent implements OnInit {
  technicians: TechnicianCapacity[] = [];
  upcomingEvents: CalendarEventDto[] = [];
  isLoading = true;
  error: string | null = null;

  viewMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  calendarDays: CalendarDay[] = [];
  isLoadingCalendar = false;
  selectedDay: CalendarDay | null = null;

  readonly weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  constructor(
    private capacityService: CapacityService,
    private calendarService: CalendarService,
  ) {}

  ngOnInit(): void {
    this.isLoading = true;
    this.capacityService.getFleetCapacity().subscribe({
      next: (technicians) => { this.technicians = technicians; this.isLoading = false; },
      error: () => { this.error = 'Could not load technician capacity.'; this.isLoading = false; },
    });

    const now = new Date();
    const twoWeeksOut = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    this.capacityService.getUpcomingEvents(now, twoWeeksOut).subscribe({
      next: (events) => { this.upcomingEvents = events; },
      error: () => {},
    });

    this.loadMonth();
  }

  loadClass(openJobCount: number): string {
    if (openJobCount >= 6) return 'load-high';
    if (openJobCount >= 3) return 'load-medium';
    return 'load-low';
  }

  get monthLabel(): string {
    return this.viewMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }

  prevMonth(): void {
    this.viewMonth = new Date(this.viewMonth.getFullYear(), this.viewMonth.getMonth() - 1, 1);
    this.loadMonth();
  }

  nextMonth(): void {
    this.viewMonth = new Date(this.viewMonth.getFullYear(), this.viewMonth.getMonth() + 1, 1);
    this.loadMonth();
  }

  selectDay(day: CalendarDay): void {
    this.selectedDay = day.events.length ? day : null;
  }

  private loadMonth(): void {
    this.isLoadingCalendar = true;
    this.selectedDay = null;

    const gridStart = new Date(this.viewMonth.getFullYear(), this.viewMonth.getMonth(), 1);
    gridStart.setDate(gridStart.getDate() - gridStart.getDay());
    const gridEnd = new Date(gridStart);
    gridEnd.setDate(gridEnd.getDate() + 41);

    this.calendarService.getRange(gridStart.toISOString(), gridEnd.toISOString()).subscribe({
      next: (events) => { this.buildGrid(gridStart, events); this.isLoadingCalendar = false; },
      error: () => { this.buildGrid(gridStart, []); this.isLoadingCalendar = false; },
    });
  }

  private buildGrid(gridStart: Date, events: CalendarEventDto[]): void {
    const today = new Date();
    const days: CalendarDay[] = [];
    for (let i = 0; i < 42; i++) {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + i);
      const dayEvents = events.filter((e) => this.isSameDay(new Date(e.startTime), date));
      days.push({
        date,
        inCurrentMonth: date.getMonth() === this.viewMonth.getMonth(),
        isToday: this.isSameDay(date, today),
        events: dayEvents,
      });
    }
    this.calendarDays = days;
  }

  private isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }
}

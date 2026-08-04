import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { catchError, of } from 'rxjs';
import {
  ContactInquiry,
  InquiryService,
  InquiryStatus,
} from '../../core/services/inquiry.service';
import { NotificationService } from '../../core/services/notification.service';

type StatusFilter = InquiryStatus | 'all';

@Component({
  selector: 'app-inquiries',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './inquiries.component.html',
  styleUrl: './inquiries.component.scss',
})
export class InquiriesComponent implements OnInit {
  readonly filterOptions: StatusFilter[] = ['all', 'NEW', 'REVIEWED', 'CLOSED'];

  readonly inquiries = signal<ContactInquiry[]>([]);
  readonly loading = signal(false);
  readonly page = signal(0);
  readonly totalPages = signal(0);
  readonly totalElements = signal(0);
  readonly statusFilter = signal<StatusFilter>('all');
  readonly expandedId = signal<number | null>(null);

  readonly hasNextPage = computed(() => this.page() + 1 < this.totalPages());
  readonly hasPrevPage = computed(() => this.page() > 0);

  constructor(
    private readonly inquiryService: InquiryService,
    private readonly notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.inquiryService
      .list(this.statusFilter(), this.page(), 20)
      .pipe(
        catchError(() => {
          this.notificationService.error('Could not load inquiries.');
          return of({ content: [], totalElements: 0, totalPages: 0, number: 0 });
        })
      )
      .subscribe((result) => {
        this.inquiries.set(result.content);
        this.totalPages.set(result.totalPages);
        this.totalElements.set(result.totalElements);
        this.loading.set(false);
      });
  }

  onFilterChange(filter: StatusFilter): void {
    this.statusFilter.set(filter);
    this.page.set(0);
    this.load();
  }

  toggleExpand(id: number): void {
    this.expandedId.set(this.expandedId() === id ? null : id);
  }

  nextPage(): void {
    if (this.hasNextPage()) {
      this.page.update((p) => p + 1);
      this.load();
    }
  }

  prevPage(): void {
    if (this.hasPrevPage()) {
      this.page.update((p) => p - 1);
      this.load();
    }
  }

  markStatus(inquiry: ContactInquiry, status: InquiryStatus): void {
    this.inquiryService
      .updateStatus(inquiry.id, status)
      .pipe(
        catchError(() => {
          this.notificationService.error('Could not update inquiry status.');
          return of(null);
        })
      )
      .subscribe((updated) => {
        if (!updated) {
          return;
        }
        this.inquiries.update((list) => list.map((i) => (i.id === updated.id ? updated : i)));
      });
  }

  typeLabel(type: string): string {
    return type === 'DEMO_REQUEST' ? 'Demo Request' : 'Contact';
  }
}

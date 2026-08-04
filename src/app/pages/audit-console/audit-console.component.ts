import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuditService } from '../../core/services/audit.service';
import { AuditEventDto } from '../../core/models/sentinel.models';

@Component({
  selector: 'app-audit-console',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './audit-console.component.html',
  styleUrl: './audit-console.component.scss',
})
export class AuditConsoleComponent implements OnInit {
  events: AuditEventDto[] = [];
  isLoading = true;
  error: string | null = null;

  page = 0;
  size = 50;
  totalPages = 0;
  totalElements = 0;

  entityTypeFilter = '';
  entityIdFilter: number | null = null;

  constructor(private auditService: AuditService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading = true;
    this.error = null;
    this.auditService.list(this.page, this.size, this.entityTypeFilter || undefined, this.entityIdFilter ?? undefined).subscribe({
      next: (result) => {
        this.events = result.content;
        this.totalPages = result.totalPages;
        this.totalElements = result.totalElements;
        this.isLoading = false;
      },
      error: () => {
        this.error = 'Could not load the audit log.';
        this.isLoading = false;
      },
    });
  }

  applyFilters(): void {
    this.page = 0;
    this.load();
  }

  clearFilters(): void {
    this.entityTypeFilter = '';
    this.entityIdFilter = null;
    this.page = 0;
    this.load();
  }

  nextPage(): void {
    if (this.page + 1 < this.totalPages) {
      this.page++;
      this.load();
    }
  }

  previousPage(): void {
    if (this.page > 0) {
      this.page--;
      this.load();
    }
  }

  actionClass(action: string): string {
    if (action.includes('DELETED') || action.includes('REJECTED')) return 'action-danger';
    if (action.includes('APPROVED') || action.includes('CREATED') || action.includes('LINKED')) return 'action-ok';
    if (action.includes('ESCALATED') || action.includes('AUTO')) return 'action-warn';
    return 'action-default';
  }
}

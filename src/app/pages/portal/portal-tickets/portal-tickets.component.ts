import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PortalService } from '../../../core/services/portal.service';
import { PortalMessageResponse, SupportTicketResponse } from '../../../core/models/sentinel.models';

@Component({
  selector: 'app-portal-tickets',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './portal-tickets.component.html',
  styleUrl: './portal-tickets.component.scss',
})
export class PortalTicketsComponent implements OnInit {
  tickets: SupportTicketResponse[] = [];
  isLoading = true;
  error: string | null = null;

  expandedTicketId: number | null = null;
  thread: PortalMessageResponse[] = [];
  isThreadLoading = false;
  replyBody = '';
  isSendingReply = false;

  constructor(private portalService: PortalService) {}

  ngOnInit(): void {
    this.portalService.getMyTickets().subscribe({
      next: (page) => { this.tickets = page.content; this.isLoading = false; },
      error: () => { this.error = 'Could not load your support tickets.'; this.isLoading = false; },
    });
  }

  statusClass(status: string): string {
    return 'status-' + status.toLowerCase().replace('_', '-');
  }

  toggleThread(ticket: SupportTicketResponse): void {
    if (this.expandedTicketId === ticket.id) {
      this.expandedTicketId = null;
      this.thread = [];
      return;
    }
    this.expandedTicketId = ticket.id;
    this.thread = [];
    this.replyBody = '';
    this.isThreadLoading = true;
    this.portalService.getThread(ticket.id).subscribe({
      next: (messages) => { this.thread = messages; this.isThreadLoading = false; },
      error: () => { this.isThreadLoading = false; },
    });
  }

  sendReply(ticketId: number): void {
    if (!this.replyBody.trim()) return;
    this.isSendingReply = true;
    this.portalService.postMessage(ticketId, { body: this.replyBody }).subscribe({
      next: (message) => {
        this.thread = [...this.thread, message];
        this.replyBody = '';
        this.isSendingReply = false;
      },
      error: () => { this.isSendingReply = false; },
    });
  }
}

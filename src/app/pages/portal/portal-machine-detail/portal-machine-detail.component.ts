import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { jsPDF } from 'jspdf';
import { PortalService } from '../../../core/services/portal.service';
import {
  PortalMachineDetail,
  PortalMaintenanceHistoryEntry,
  WarrantyResponse,
} from '../../../core/models/sentinel.models';

@Component({
  selector: 'app-portal-machine-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './portal-machine-detail.component.html',
  styleUrl: './portal-machine-detail.component.scss',
})
export class PortalMachineDetailComponent implements OnInit {
  machine: PortalMachineDetail | null = null;
  history: PortalMaintenanceHistoryEntry[] = [];
  warranties: WarrantyResponse[] = [];
  isLoading = true;
  error: string | null = null;
  machineId = 0;

  showTicketForm = false;
  ticketSubject = '';
  ticketDescription = '';
  isSubmittingTicket = false;
  ticketSuccess: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private portalService: PortalService,
  ) {}

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (!idParam) {
      this.router.navigate(['/portal']);
      return;
    }
    this.machineId = Number(idParam);
    this.load();
  }

  private load(): void {
    this.isLoading = true;
    this.portalService.getMachineDetail(this.machineId).subscribe({
      next: (detail) => { this.machine = detail; this.isLoading = false; },
      error: () => { this.error = 'Could not load this machine.'; this.isLoading = false; },
    });
    this.portalService.getMaintenanceHistory(this.machineId).subscribe({
      next: (page) => { this.history = page.content; },
      error: () => {},
    });
    this.portalService.getMyWarranties().subscribe({
      next: (warranties) => { this.warranties = warranties.filter(w => w.machineId === this.machineId); },
      error: () => {},
    });
  }

  downloadReport(): void {
    if (!this.machine) return;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const left = 40;
    let y = 50;

    doc.setFontSize(16);
    doc.text(`Machine Report — ${this.machine.name}`, left, y);
    y += 24;

    doc.setFontSize(10);
    doc.text(`Generated ${new Date().toLocaleString()}`, left, y);
    y += 24;

    doc.setFontSize(12);
    const lines = [
      `Serial Number: ${this.machine.serialNumber}`,
      `Model: ${this.machine.model || 'N/A'}`,
      `Location: ${this.machine.location || 'N/A'}`,
      `Status: ${this.machine.statusLabel}`,
      `Health: ${this.machine.healthScore}%`,
      `Risk: ${this.machine.riskSummary}`,
      `Last Service: ${this.machine.lastMaintenanceDate ? new Date(this.machine.lastMaintenanceDate).toLocaleDateString() : 'N/A'}`,
      `Next Service: ${this.machine.nextMaintenanceDate ? new Date(this.machine.nextMaintenanceDate).toLocaleDateString() : 'N/A'}`,
    ];
    for (const line of lines) {
      doc.text(line, left, y);
      y += 18;
    }

    y += 12;
    doc.setFontSize(14);
    doc.text('Maintenance History', left, y);
    y += 20;
    doc.setFontSize(10);
    if (this.history.length === 0) {
      doc.text('No maintenance history recorded.', left, y);
      y += 16;
    } else {
      for (const entry of this.history) {
        const completed = entry.completedDate ? new Date(entry.completedDate).toLocaleDateString() : 'Pending';
        doc.text(`${completed} — ${entry.type || 'Maintenance'} — ${entry.statusLabel}`, left, y);
        y += 16;
        if (y > 760) { doc.addPage(); y = 50; }
      }
    }

    doc.save(`machine-report-${this.machine.serialNumber || this.machineId}.pdf`);
  }

  healthClass(score: number): string {
    if (score >= 70) return 'health-good';
    if (score >= 40) return 'health-warn';
    return 'health-critical';
  }

  openTicketForm(): void {
    this.showTicketForm = true;
    this.ticketSuccess = null;
  }

  cancelTicketForm(): void {
    this.showTicketForm = false;
    this.ticketSubject = '';
    this.ticketDescription = '';
  }

  submitTicket(): void {
    if (!this.ticketSubject.trim()) return;
    this.isSubmittingTicket = true;
    this.portalService.createTicket({
      machineId: this.machineId,
      subject: this.ticketSubject,
      description: this.ticketDescription || undefined,
    }).subscribe({
      next: () => {
        this.isSubmittingTicket = false;
        this.ticketSuccess = 'Support ticket created — our team will be in touch.';
        this.cancelTicketForm();
      },
      error: () => { this.isSubmittingTicket = false; },
    });
  }
}

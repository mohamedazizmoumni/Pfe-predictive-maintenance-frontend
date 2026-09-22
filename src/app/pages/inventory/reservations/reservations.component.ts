import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PartReservationService } from '../../../core/services/part-reservation.service';
import { InventoryService } from '../../../core/services/inventory.service';
import { Maintenance, PartReservationRequest, PartReservationResponse } from '../../../core/models/sentinel.models';
import { MaintenanceService } from '../../../core/services/maintenance.service';
import { AuthService } from '../../../core/services/auth.service';
import { normalizeRoleName } from '../../../core/utils/role.utils';

@Component({
  selector: 'app-reservations',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reservations.component.html',
  styleUrl: './reservations.component.scss',
})
export class ReservationsComponent implements OnInit {
  lookupPartId: number | null = null;
  reservations: PartReservationResponse[] = [];
  isLoading = false;

  form: PartReservationRequest = this.emptyForm();
  isSaving = false;
  error: string | null = null;
  isTechnician = false;
  availableMaintenances: Maintenance[] = [];

  summary: Record<number, number> = {};

  constructor(
    private reservationService: PartReservationService,
    private inventoryService: InventoryService,
    private maintenanceService: MaintenanceService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    this.isTechnician = !!user?.roles?.some(role => normalizeRoleName(role.name) === 'TECHNICIAN');

    if (this.isTechnician && user?.id) {
      this.maintenanceService.getTechnicianTasks(user.id, 0, 100).subscribe({
        next: response => {
          this.availableMaintenances = (response.content || []).filter(task =>
            !['COMPLETED', 'APPROVED', 'CANCELLED'].includes(task.status)
          );
        },
        error: () => { this.availableMaintenances = []; },
      });
    }

    this.reservationService.summary().subscribe({
      next: (summary) => { this.summary = summary; },
      error: () => {},
    });
  }

  private emptyForm(): PartReservationRequest {
    return { partId: 0, quantity: 1, maintenanceId: undefined };
  }

  lookup(): void {
    if (this.lookupPartId == null) return;
    this.isLoading = true;
    this.reservationService.byPart(this.lookupPartId).subscribe({
      next: (reservations) => { this.reservations = reservations; this.isLoading = false; },
      error: () => { this.reservations = []; this.isLoading = false; },
    });
  }

  reserve(): void {
    if (!this.form.partId || !this.form.quantity || (this.isTechnician && !this.form.maintenanceId)) return;
    this.isSaving = true;
    this.error = null;
    const request: PartReservationRequest = {
      ...this.form,
      maintenanceId: this.form.maintenanceId != null ? Number(this.form.maintenanceId) : undefined,
    };
    this.reservationService.reserve(request).subscribe({
      next: () => {
        this.isSaving = false;
        this.lookupPartId = this.form.partId;
        this.form = this.emptyForm();
        this.lookup();
      },
      error: (err) => {
        this.isSaving = false;
        this.error = err?.error?.message || 'Could not reserve — check available stock.';
      },
    });
  }

  release(reservation: PartReservationResponse): void {
    this.reservationService.release(reservation.id).subscribe({ next: () => this.lookup() });
  }

  consume(reservation: PartReservationResponse): void {
    if (!confirm(`Consume ${reservation.quantityReserved} unit(s) of "${reservation.partName}"? This decrements stock.`)) return;
    this.reservationService.consume(reservation.id).subscribe({ next: () => this.lookup() });
  }
}

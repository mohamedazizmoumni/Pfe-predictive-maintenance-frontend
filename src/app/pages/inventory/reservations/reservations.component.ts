import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PartReservationService } from '../../../core/services/part-reservation.service';
import { InventoryService } from '../../../core/services/inventory.service';
import { PartReservationRequest, PartReservationResponse } from '../../../core/models/sentinel.models';

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

  summary: Record<number, number> = {};

  constructor(
    private reservationService: PartReservationService,
    private inventoryService: InventoryService,
  ) {}

  ngOnInit(): void {
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
    if (!this.form.partId || !this.form.quantity) return;
    this.isSaving = true;
    this.error = null;
    this.reservationService.reserve(this.form).subscribe({
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

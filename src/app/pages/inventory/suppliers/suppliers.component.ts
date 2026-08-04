import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupplierService } from '../../../core/services/supplier.service';
import { SupplierRequest, SupplierResponse, SupplierScorecard } from '../../../core/models/sentinel.models';

@Component({
  selector: 'app-suppliers',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './suppliers.component.html',
  styleUrl: './suppliers.component.scss',
})
export class SuppliersComponent implements OnInit {
  suppliers: SupplierResponse[] = [];
  isLoading = true;
  error: string | null = null;

  showForm = false;
  editingId: number | null = null;
  form: SupplierRequest = this.emptyForm();
  isSaving = false;

  scorecardFor: SupplierResponse | null = null;
  scorecard: SupplierScorecard | null = null;
  isLoadingScorecard = false;

  constructor(private supplierService: SupplierService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading = true;
    this.supplierService.getAll(false).subscribe({
      next: (suppliers) => { this.suppliers = suppliers; this.isLoading = false; },
      error: () => { this.error = 'Could not load suppliers.'; this.isLoading = false; },
    });
  }

  private emptyForm(): SupplierRequest {
    return { name: '', contactName: '', email: '', phone: '', address: '', leadTimeDays: undefined, notes: '', active: true };
  }

  openCreateForm(): void {
    this.editingId = null;
    this.form = this.emptyForm();
    this.showForm = true;
  }

  openEditForm(supplier: SupplierResponse): void {
    this.editingId = supplier.id;
    this.form = {
      name: supplier.name,
      contactName: supplier.contactName,
      email: supplier.email,
      phone: supplier.phone,
      address: supplier.address,
      leadTimeDays: supplier.leadTimeDays,
      notes: supplier.notes,
      active: supplier.active,
    };
    this.showForm = true;
  }

  cancelForm(): void {
    this.showForm = false;
    this.editingId = null;
  }

  save(): void {
    if (!this.form.name.trim()) return;
    this.isSaving = true;
    const op = this.editingId != null
      ? this.supplierService.update(this.editingId, this.form)
      : this.supplierService.create(this.form);

    op.subscribe({
      next: () => { this.isSaving = false; this.cancelForm(); this.load(); },
      error: () => { this.isSaving = false; },
    });
  }

  deactivate(supplier: SupplierResponse): void {
    if (!confirm(`Deactivate supplier "${supplier.name}"? Historical orders will keep referencing it.`)) return;
    this.supplierService.deactivate(supplier.id).subscribe({
      next: () => this.load(),
    });
  }

  viewScorecard(supplier: SupplierResponse): void {
    this.scorecardFor = supplier;
    this.scorecard = null;
    this.isLoadingScorecard = true;
    this.supplierService.getScorecard(supplier.id).subscribe({
      next: (scorecard) => { this.scorecard = scorecard; this.isLoadingScorecard = false; },
      error: () => { this.isLoadingScorecard = false; },
    });
  }

  closeScorecard(): void {
    this.scorecardFor = null;
    this.scorecard = null;
  }

  formatPercent(rate: number | null): string {
    return rate == null ? '—' : `${Math.round(rate * 100)}%`;
  }
}

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PortalAdminService } from '../../core/services/portal-admin.service';
import { UserService } from '../../core/services/user.service';
import { MachineService } from '../../core/services/machine.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { rolesCollectionHasAny } from '../../core/utils/role.utils';
import { Machine } from '../../core/models/machine.model';
import {
  CustomerMachineLink,
  InvoiceRequest,
  InvoiceResponse,
  InvoiceStatus,
  User,
  WarrantyRequest,
  WarrantyResponse,
} from '../../core/models/sentinel.models';

type AdminTab = 'links' | 'warranties' | 'invoices';

/**
 * Priority 9: admin-side UI for the Customer Portal backend that already
 * existed with no frontend consumer - link customers to machines, issue
 * warranties, and issue/track invoices. Reuses PortalAdminService (already
 * wrapped every /portal-admin/** endpoint with zero UI calling it) and the
 * plain-<select> picker convention used elsewhere (machine-technicians-modal,
 * maintenance-create) rather than introducing a new autocomplete widget.
 */
@Component({
  selector: 'app-portal-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './portal-admin.component.html',
  styleUrl: './portal-admin.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortalAdminComponent implements OnInit {
  activeTab: AdminTab = 'links';
  canManageLinksAndWarranties = false;
  canManageInvoices = false;

  customers: User[] = [];
  machines: Machine[] = [];
  isLoadingPickers = true;

  // Links
  selectedCustomerId: number | null = null;
  customerLinks: CustomerMachineLink[] = [];
  newLinkMachineId: number | null = null;
  isLoadingLinks = false;
  isSavingLink = false;

  // Warranties
  selectedWarrantyMachineId: number | null = null;
  warranties: WarrantyResponse[] = [];
  isLoadingWarranties = false;
  isSavingWarranty = false;
  newWarrantyProvider = '';
  newWarrantyStart = '';
  newWarrantyEnd = '';
  newWarrantyTerms = '';

  // Invoices
  invoices: InvoiceResponse[] = [];
  isLoadingInvoices = false;
  isSavingInvoice = false;
  newInvoiceCustomerId: number | null = null;
  newInvoiceMachineId: number | null = null;
  newInvoiceNumber = '';
  newInvoiceAmount: number | null = null;
  newInvoiceIssueDate = '';
  newInvoiceDueDate = '';
  newInvoiceDescription = '';
  readonly invoiceStatuses: InvoiceStatus[] = ['UNPAID', 'PAID', 'OVERDUE'];

  constructor(
    private portalAdminService: PortalAdminService,
    private userService: UserService,
    private machineService: MachineService,
    private authService: AuthService,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    this.canManageLinksAndWarranties = rolesCollectionHasAny(user?.roles, ['ADMIN', 'SUPER_ADMIN']);
    this.canManageInvoices = rolesCollectionHasAny(user?.roles, ['ADMIN', 'SUPER_ADMIN', 'FINANCE_MANAGER']);
    this.activeTab = this.canManageLinksAndWarranties ? 'links' : 'invoices';

    this.isLoadingPickers = true;
    let pending = 2;
    const done = () => {
      if (--pending <= 0) {
        this.isLoadingPickers = false;
        if (this.canManageInvoices) {
          this.loadInvoices();
        }
        this.cdr.markForCheck();
      }
    };

    this.userService.getCustomers().subscribe({
      next: (customers) => { this.customers = customers; done(); },
      error: () => { this.notificationService.error('Unable to load customer list.'); done(); },
    });
    this.machineService.getAll().subscribe({
      next: (machines) => { this.machines = machines; done(); },
      error: () => { this.notificationService.error('Unable to load machine list.'); done(); },
    });
  }

  setTab(tab: AdminTab): void {
    this.activeTab = tab;
  }

  machineLabel(machineId: number | undefined): string {
    if (machineId == null) return 'No machine';
    const machine = this.machines.find((m) => m.id === machineId);
    return machine ? `${machine.name} (${machine.serialNumber})` : `Machine #${machineId}`;
  }

  customerLabel(userId: number): string {
    const customer = this.customers.find((c) => Number(c.id) === userId);
    if (!customer) return `User #${userId}`;
    return customer.displayName
      || `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim()
      || customer.username;
  }

  get availableMachinesForLink(): Machine[] {
    const linkedIds = new Set(this.customerLinks.map((l) => l.machineId));
    return this.machines.filter((m) => !linkedIds.has(m.id));
  }

  // ---------- Links ----------

  loadLinks(): void {
    this.newLinkMachineId = null;
    if (this.selectedCustomerId == null) {
      this.customerLinks = [];
      return;
    }
    this.isLoadingLinks = true;
    this.portalAdminService.getLinksByUser(this.selectedCustomerId).subscribe({
      next: (links) => { this.customerLinks = links; this.isLoadingLinks = false; this.cdr.markForCheck(); },
      error: (err) => {
        this.isLoadingLinks = false;
        this.notificationService.error(this.extractError(err, 'Unable to load customer machine links.'));
        this.cdr.markForCheck();
      },
    });
  }

  addLink(): void {
    if (this.selectedCustomerId == null || this.newLinkMachineId == null) return;
    this.isSavingLink = true;
    this.portalAdminService.createLink({ userId: this.selectedCustomerId, machineId: this.newLinkMachineId }).subscribe({
      next: () => {
        this.isSavingLink = false;
        this.newLinkMachineId = null;
        this.notificationService.success('Machine linked to customer.');
        this.loadLinks();
      },
      error: (err) => {
        this.isSavingLink = false;
        this.notificationService.error(this.extractError(err, 'Unable to link machine to customer.'));
        this.cdr.markForCheck();
      },
    });
  }

  removeLink(id: number): void {
    this.portalAdminService.deleteLink(id).subscribe({
      next: () => { this.notificationService.success('Link removed.'); this.loadLinks(); },
      error: (err) => this.notificationService.error(this.extractError(err, 'Unable to remove link.')),
    });
  }

  // ---------- Warranties ----------

  loadWarranties(): void {
    if (this.selectedWarrantyMachineId == null) {
      this.warranties = [];
      return;
    }
    this.isLoadingWarranties = true;
    this.portalAdminService.getWarrantiesByMachine(this.selectedWarrantyMachineId).subscribe({
      next: (warranties) => { this.warranties = warranties; this.isLoadingWarranties = false; this.cdr.markForCheck(); },
      error: (err) => {
        this.isLoadingWarranties = false;
        this.notificationService.error(this.extractError(err, 'Unable to load warranties.'));
        this.cdr.markForCheck();
      },
    });
  }

  get canAddWarranty(): boolean {
    return this.selectedWarrantyMachineId != null
      && !!this.newWarrantyProvider.trim()
      && !!this.newWarrantyStart
      && !!this.newWarrantyEnd;
  }

  addWarranty(): void {
    if (!this.canAddWarranty) return;
    const request: WarrantyRequest = {
      machineId: this.selectedWarrantyMachineId!,
      provider: this.newWarrantyProvider.trim(),
      startDate: this.newWarrantyStart,
      endDate: this.newWarrantyEnd,
      terms: this.newWarrantyTerms.trim() || undefined,
    };
    this.isSavingWarranty = true;
    this.portalAdminService.createWarranty(request).subscribe({
      next: () => {
        this.isSavingWarranty = false;
        this.newWarrantyProvider = '';
        this.newWarrantyStart = '';
        this.newWarrantyEnd = '';
        this.newWarrantyTerms = '';
        this.notificationService.success('Warranty added.');
        this.loadWarranties();
      },
      error: (err) => {
        this.isSavingWarranty = false;
        this.notificationService.error(this.extractError(err, 'Unable to add warranty.'));
        this.cdr.markForCheck();
      },
    });
  }

  removeWarranty(id: number): void {
    this.portalAdminService.deleteWarranty(id).subscribe({
      next: () => { this.notificationService.success('Warranty removed.'); this.loadWarranties(); },
      error: (err) => this.notificationService.error(this.extractError(err, 'Unable to remove warranty.')),
    });
  }

  // ---------- Invoices ----------

  loadInvoices(): void {
    this.isLoadingInvoices = true;
    this.portalAdminService.getAllInvoices().subscribe({
      next: (invoices) => { this.invoices = invoices; this.isLoadingInvoices = false; this.cdr.markForCheck(); },
      error: (err) => {
        this.isLoadingInvoices = false;
        this.notificationService.error(this.extractError(err, 'Unable to load invoices.'));
        this.cdr.markForCheck();
      },
    });
  }

  get canAddInvoice(): boolean {
    return this.newInvoiceCustomerId != null
      && !!this.newInvoiceNumber.trim()
      && this.newInvoiceAmount != null
      && this.newInvoiceAmount > 0
      && !!this.newInvoiceIssueDate
      && !!this.newInvoiceDueDate;
  }

  addInvoice(): void {
    if (!this.canAddInvoice) return;
    const request: InvoiceRequest = {
      customerUserId: this.newInvoiceCustomerId!,
      machineId: this.newInvoiceMachineId ?? undefined,
      invoiceNumber: this.newInvoiceNumber.trim(),
      amount: this.newInvoiceAmount!,
      issueDate: this.newInvoiceIssueDate,
      dueDate: this.newInvoiceDueDate,
      description: this.newInvoiceDescription.trim() || undefined,
    };
    this.isSavingInvoice = true;
    this.portalAdminService.createInvoice(request).subscribe({
      next: () => {
        this.isSavingInvoice = false;
        this.newInvoiceCustomerId = null;
        this.newInvoiceMachineId = null;
        this.newInvoiceNumber = '';
        this.newInvoiceAmount = null;
        this.newInvoiceIssueDate = '';
        this.newInvoiceDueDate = '';
        this.newInvoiceDescription = '';
        this.notificationService.success('Invoice created.');
        this.loadInvoices();
      },
      error: (err) => {
        this.isSavingInvoice = false;
        this.notificationService.error(this.extractError(err, 'Unable to create invoice.'));
        this.cdr.markForCheck();
      },
    });
  }

  updateInvoiceStatus(invoice: InvoiceResponse, status: InvoiceStatus): void {
    if (status === invoice.status) return;
    this.portalAdminService.updateInvoiceStatus(invoice.id, status).subscribe({
      next: (updated) => {
        this.invoices = this.invoices.map((inv) => (inv.id === updated.id ? updated : inv));
        this.notificationService.success(`Invoice ${updated.invoiceNumber} marked ${status}.`);
        this.cdr.markForCheck();
      },
      error: (err) => this.notificationService.error(this.extractError(err, 'Unable to update invoice status.')),
    });
  }

  removeInvoice(id: number): void {
    this.portalAdminService.deleteInvoice(id).subscribe({
      next: () => { this.notificationService.success('Invoice deleted.'); this.loadInvoices(); },
      error: (err) => this.notificationService.error(this.extractError(err, 'Unable to delete invoice.')),
    });
  }

  trackById(_: number, item: { id: number }): number {
    return item.id;
  }

  private extractError(err: unknown, fallback: string): string {
    const httpError = err as { error?: { message?: string; error?: string } };
    return httpError?.error?.message || httpError?.error?.error || fallback;
  }
}

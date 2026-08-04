import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiEndpoint } from '../http/api-base';
import {
  CustomerMachineLink,
  CustomerMachineLinkRequest,
  InvoiceRequest,
  InvoiceResponse,
  InvoiceStatus,
  WarrantyRequest,
  WarrantyResponse,
} from '../models/sentinel.models';

/**
 * Admin-side management of the Customer Portal: linking customers to
 * machines, and issuing warranties/invoices. Separate from PortalService,
 * which is the customer-facing, row-level-scoped client.
 */
@Injectable({ providedIn: 'root' })
export class PortalAdminService {
  private readonly linksUrl = apiEndpoint('/portal-admin/links');
  private readonly warrantiesUrl = apiEndpoint('/portal-admin/warranties');
  private readonly invoicesUrl = apiEndpoint('/portal-admin/invoices');

  constructor(private http: HttpClient) {}

  createLink(request: CustomerMachineLinkRequest): Observable<CustomerMachineLink> {
    return this.http.post<CustomerMachineLink>(this.linksUrl, request);
  }

  getLinksByUser(userId: number): Observable<CustomerMachineLink[]> {
    return this.http.get<CustomerMachineLink[]>(`${this.linksUrl}/by-user/${userId}`);
  }

  deleteLink(id: number): Observable<void> {
    return this.http.delete<void>(`${this.linksUrl}/${id}`);
  }

  createWarranty(request: WarrantyRequest): Observable<WarrantyResponse> {
    return this.http.post<WarrantyResponse>(this.warrantiesUrl, request);
  }

  getWarrantiesByMachine(machineId: number): Observable<WarrantyResponse[]> {
    return this.http.get<WarrantyResponse[]>(`${this.warrantiesUrl}/by-machine/${machineId}`);
  }

  deleteWarranty(id: number): Observable<void> {
    return this.http.delete<void>(`${this.warrantiesUrl}/${id}`);
  }

  createInvoice(request: InvoiceRequest): Observable<InvoiceResponse> {
    return this.http.post<InvoiceResponse>(this.invoicesUrl, request);
  }

  getAllInvoices(): Observable<InvoiceResponse[]> {
    return this.http.get<InvoiceResponse[]>(this.invoicesUrl);
  }

  updateInvoiceStatus(id: number, status: InvoiceStatus): Observable<InvoiceResponse> {
    return this.http.put<InvoiceResponse>(`${this.invoicesUrl}/${id}/status`, status);
  }

  deleteInvoice(id: number): Observable<void> {
    return this.http.delete<void>(`${this.invoicesUrl}/${id}`);
  }
}

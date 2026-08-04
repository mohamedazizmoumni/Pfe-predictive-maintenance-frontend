import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiEndpoint } from '../http/api-base';
import {
  InvoiceResponse,
  Page,
  PortalMachineDetail,
  PortalMachineSummary,
  PortalMaintenanceHistoryEntry,
  PortalMessageRequest,
  PortalMessageResponse,
  SupportTicketRequest,
  SupportTicketResponse,
  SupportTicketUpdateRequest,
  WarrantyResponse,
} from '../models/sentinel.models';

/**
 * Customer Portal API client. Every call here is implicitly scoped to the
 * authenticated customer's own linked machines — the backend enforces this
 * (PortalAccessService), this service does not.
 */
@Injectable({ providedIn: 'root' })
export class PortalService {
  private readonly machinesUrl = apiEndpoint('/portal/machines');
  private readonly ticketsUrl = apiEndpoint('/portal/tickets');
  private readonly warrantiesUrl = apiEndpoint('/portal/warranties');
  private readonly invoicesUrl = apiEndpoint('/portal/invoices');

  constructor(private http: HttpClient) {}

  listMyMachines(): Observable<PortalMachineSummary[]> {
    return this.http.get<PortalMachineSummary[]>(this.machinesUrl);
  }

  getMachineDetail(machineId: number): Observable<PortalMachineDetail> {
    return this.http.get<PortalMachineDetail>(`${this.machinesUrl}/${machineId}`);
  }

  getMaintenanceHistory(machineId: number, page = 0, size = 20): Observable<Page<PortalMaintenanceHistoryEntry>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<Page<PortalMaintenanceHistoryEntry>>(`${this.machinesUrl}/${machineId}/maintenance-history`, { params });
  }

  createTicket(request: SupportTicketRequest): Observable<SupportTicketResponse> {
    return this.http.post<SupportTicketResponse>(this.ticketsUrl, request);
  }

  getMyTickets(page = 0, size = 20): Observable<Page<SupportTicketResponse>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<Page<SupportTicketResponse>>(`${this.ticketsUrl}/mine`, { params });
  }

  // Internal (Manager/Admin) triage — reuses the same service since the
  // endpoints are role-gated server-side, not because customers can call these.
  getAllTickets(page = 0, size = 20): Observable<Page<SupportTicketResponse>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<Page<SupportTicketResponse>>(this.ticketsUrl, { params });
  }

  updateTicket(id: number, request: SupportTicketUpdateRequest): Observable<SupportTicketResponse> {
    return this.http.put<SupportTicketResponse>(`${this.ticketsUrl}/${id}`, request);
  }

  getThread(ticketId: number): Observable<PortalMessageResponse[]> {
    return this.http.get<PortalMessageResponse[]>(`${this.ticketsUrl}/${ticketId}/messages`);
  }

  postMessage(ticketId: number, request: PortalMessageRequest): Observable<PortalMessageResponse> {
    return this.http.post<PortalMessageResponse>(`${this.ticketsUrl}/${ticketId}/messages`, request);
  }

  getMyWarranties(): Observable<WarrantyResponse[]> {
    return this.http.get<WarrantyResponse[]>(this.warrantiesUrl);
  }

  getMyInvoices(): Observable<InvoiceResponse[]> {
    return this.http.get<InvoiceResponse[]>(this.invoicesUrl);
  }
}

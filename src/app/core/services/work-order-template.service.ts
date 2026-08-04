import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiEndpoint } from '../http/api-base';
import {
  RecurringMaintenanceRuleRequest,
  RecurringMaintenanceRuleResponse,
  WorkOrderTemplateRequest,
  WorkOrderTemplateResponse,
} from '../models/sentinel.models';

@Injectable({ providedIn: 'root' })
export class WorkOrderTemplateService {
  private readonly templatesUrl = apiEndpoint('/work-order-templates');
  private readonly rulesUrl = apiEndpoint('/recurring-maintenance');

  constructor(private http: HttpClient) {}

  getTemplates(activeOnly = true): Observable<WorkOrderTemplateResponse[]> {
    const params = new HttpParams().set('activeOnly', activeOnly);
    return this.http.get<WorkOrderTemplateResponse[]>(this.templatesUrl, { params });
  }

  createTemplate(request: WorkOrderTemplateRequest): Observable<WorkOrderTemplateResponse> {
    return this.http.post<WorkOrderTemplateResponse>(this.templatesUrl, request);
  }

  updateTemplate(id: number, request: WorkOrderTemplateRequest): Observable<WorkOrderTemplateResponse> {
    return this.http.put<WorkOrderTemplateResponse>(`${this.templatesUrl}/${id}`, request);
  }

  deactivateTemplate(id: number): Observable<void> {
    return this.http.delete<void>(`${this.templatesUrl}/${id}`);
  }

  createRule(request: RecurringMaintenanceRuleRequest): Observable<RecurringMaintenanceRuleResponse> {
    return this.http.post<RecurringMaintenanceRuleResponse>(this.rulesUrl, request);
  }

  getRulesByMachine(machineId: number): Observable<RecurringMaintenanceRuleResponse[]> {
    return this.http.get<RecurringMaintenanceRuleResponse[]>(`${this.rulesUrl}/machine/${machineId}`);
  }

  deactivateRule(id: number): Observable<void> {
    return this.http.delete<void>(`${this.rulesUrl}/${id}`);
  }
}

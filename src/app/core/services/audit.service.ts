import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiEndpoint } from '../http/api-base';
import { AuditEventDto, Page } from '../models/sentinel.models';

@Injectable({ providedIn: 'root' })
export class AuditService {
  private readonly baseUrl = apiEndpoint('/audit-events');

  constructor(private http: HttpClient) {}

  list(page = 0, size = 50, entityType?: string, entityId?: number): Observable<Page<AuditEventDto>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (entityType) params = params.set('entityType', entityType);
    if (entityId != null) params = params.set('entityId', entityId);
    return this.http.get<Page<AuditEventDto>>(this.baseUrl, { params });
  }
}

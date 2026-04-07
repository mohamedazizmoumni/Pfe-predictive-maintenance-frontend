import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  AlertQueryParams,
  AlertResponse,
  AlertStatsResponse,
  CreateAlertPayload,
  AcknowledgeAlertPayload,
  EscalateAlertPayload,
  CloseAlertPayload,
  Page,
} from '../models/sentinel.models';
import { apiEndpoint } from '../http/api-base';

@Injectable({
  providedIn: 'root',
})
export class AlertApiService {
  constructor(private http: HttpClient) {}

  list(params: AlertQueryParams = {}): Observable<Page<AlertResponse>> {
    return this.http.get<Page<AlertResponse>>(apiEndpoint('/v1/alerts'), {
      params: this.buildQueryParams(params),
    });
  }

  get(id: number): Observable<AlertResponse> {
    return this.http.get<AlertResponse>(apiEndpoint(`/v1/alerts/${id}`));
  }

  stats(): Observable<AlertStatsResponse> {
    return this.http.get<AlertStatsResponse>(apiEndpoint('/v1/alerts/stats'));
  }

  create(body: CreateAlertPayload): Observable<AlertResponse> {
    return this.http.post<AlertResponse>(apiEndpoint('/v1/alerts'), body);
  }

  acknowledge(
    id: number,
    body: AcknowledgeAlertPayload = {}
  ): Observable<AlertResponse> {
    return this.http.put<AlertResponse>(
      apiEndpoint(`/v1/alerts/${id}/acknowledge`),
      body
    );
  }

  escalate(id: number, body: EscalateAlertPayload): Observable<AlertResponse> {
    return this.http.put<AlertResponse>(
      apiEndpoint(`/v1/alerts/${id}/escalate`),
      body
    );
  }

  close(id: number, body: CloseAlertPayload): Observable<AlertResponse> {
    return this.http.put<AlertResponse>(
      apiEndpoint(`/v1/alerts/${id}/close`),
      body
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(apiEndpoint(`/v1/alerts/${id}`));
  }

  private buildQueryParams(params: AlertQueryParams): HttpParams {
    let httpParams = new HttpParams();

    const entries: Array<[string, unknown]> = [
      ['page', params.page ?? 0],
      ['size', params.size ?? 10],
      ['sort', params.sort],
      ['status', params.status],
      ['severity', params.severity],
      ['assignedTo', params.assignedTo],
      ['machineId', params.machineId],
      ['category', params.category],
      ['viewed', params.viewed],
      ['search', params.search],
    ];

    for (const [key, value] of entries) {
      if (value === undefined || value === null || value === '') {
        continue;
      }
      httpParams = this.appendParam(httpParams, key, value);
    }

    return httpParams;
  }

  private appendParam(httpParams: HttpParams, key: string, value: unknown): HttpParams {
    if (Array.isArray(value)) {
      const serialized = value.join(',');
      return httpParams.set(key, serialized);
    }

    if (value instanceof Date) {
      return httpParams.set(key, value.toISOString());
    }

    return httpParams.set(key, String(value));
  }
}

import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiEndpoint } from '../http/api-base';
import {
  DemandForecastEntry,
  SupplierRequest,
  SupplierResponse,
  SupplierScorecard,
} from '../models/sentinel.models';

@Injectable({ providedIn: 'root' })
export class SupplierService {
  private readonly baseUrl = apiEndpoint('/inventory/suppliers');
  private readonly forecastUrl = apiEndpoint('/inventory/demand-forecast');

  constructor(private http: HttpClient) {}

  getAll(activeOnly = false): Observable<SupplierResponse[]> {
    const params = new HttpParams().set('activeOnly', activeOnly);
    return this.http.get<SupplierResponse[]>(this.baseUrl, { params });
  }

  getById(id: number): Observable<SupplierResponse> {
    return this.http.get<SupplierResponse>(`${this.baseUrl}/${id}`);
  }

  create(request: SupplierRequest): Observable<SupplierResponse> {
    return this.http.post<SupplierResponse>(this.baseUrl, request);
  }

  update(id: number, request: SupplierRequest): Observable<SupplierResponse> {
    return this.http.put<SupplierResponse>(`${this.baseUrl}/${id}`, request);
  }

  deactivate(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  getScorecard(id: number): Observable<SupplierScorecard> {
    return this.http.get<SupplierScorecard>(`${this.baseUrl}/${id}/scorecard`);
  }

  getDemandForecast(): Observable<DemandForecastEntry[]> {
    return this.http.get<DemandForecastEntry[]>(this.forecastUrl);
  }
}

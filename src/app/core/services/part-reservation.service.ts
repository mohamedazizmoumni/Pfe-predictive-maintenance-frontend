import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiEndpoint } from '../http/api-base';
import { PartReservationRequest, PartReservationResponse } from '../models/sentinel.models';

@Injectable({ providedIn: 'root' })
export class PartReservationService {
  private readonly baseUrl = apiEndpoint('/inventory/reservations');

  constructor(private http: HttpClient) {}

  reserve(request: PartReservationRequest): Observable<PartReservationResponse> {
    return this.http.post<PartReservationResponse>(this.baseUrl, request);
  }

  release(id: number): Observable<PartReservationResponse> {
    return this.http.put<PartReservationResponse>(`${this.baseUrl}/${id}/release`, {});
  }

  consume(id: number): Observable<PartReservationResponse> {
    return this.http.put<PartReservationResponse>(`${this.baseUrl}/${id}/consume`, {});
  }

  byPart(partId: number): Observable<PartReservationResponse[]> {
    const params = new HttpParams().set('partId', partId);
    return this.http.get<PartReservationResponse[]>(this.baseUrl, { params });
  }

  byMaintenance(maintenanceId: number): Observable<PartReservationResponse[]> {
    return this.http.get<PartReservationResponse[]>(`${this.baseUrl}/by-maintenance/${maintenanceId}`);
  }

  summary(): Observable<Record<number, number>> {
    return this.http.get<Record<number, number>>(`${this.baseUrl}/summary`);
  }
}

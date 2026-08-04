import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiEndpoint } from '../http/api-base';
import { FailureRecord, MachineReliabilitySummary } from '../models/sentinel.models';

@Injectable({ providedIn: 'root' })
export class ReliabilityService {
  private readonly baseUrl = apiEndpoint('/reliability');

  constructor(private http: HttpClient) {}

  getFleetReliability(): Observable<MachineReliabilitySummary[]> {
    return this.http.get<MachineReliabilitySummary[]>(`${this.baseUrl}/fleet`);
  }

  getFailureRecords(machineId?: number): Observable<FailureRecord[]> {
    let params = new HttpParams();
    if (machineId != null) params = params.set('machineId', machineId);
    return this.http.get<FailureRecord[]>(`${this.baseUrl}/failures`, { params });
  }
}

import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  MaintenanceRecommendationDTO,
  RecommendationRequestDTO,
} from '../models/recommendation.model';
import {
  Page,
  RecommendationDecisionRequest,
  RecommendationStatus,
  SavedRecommendationResponse,
} from '../models/sentinel.models';

@Injectable({ providedIn: 'root' })
export class RecommendationService {
  private readonly baseUrl = `${environment.apiUrl}/maintenance-cost/recommendations`;

  constructor(private readonly http: HttpClient) {}

  generate(request: RecommendationRequestDTO): Observable<MaintenanceRecommendationDTO> {
    return this.http.post<MaintenanceRecommendationDTO>(`${this.baseUrl}/generate`, request);
  }

  getLatestRecommendation(machineId: number): Observable<MaintenanceRecommendationDTO> {
    return this.http.get<MaintenanceRecommendationDTO>(`${this.baseUrl}/machine/${machineId}`);
  }

  getForMachine(machineId: number): Observable<MaintenanceRecommendationDTO> {
    return this.getLatestRecommendation(machineId);
  }

  generateAndSave(request: RecommendationRequestDTO): Observable<SavedRecommendationResponse> {
    return this.http.post<SavedRecommendationResponse>(`${this.baseUrl}/generate-and-save`, request);
  }

  history(status?: RecommendationStatus, page = 0, size = 20): Observable<Page<SavedRecommendationResponse>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (status) params = params.set('status', status);
    return this.http.get<Page<SavedRecommendationResponse>>(`${this.baseUrl}/history`, { params });
  }

  approve(id: number, request: RecommendationDecisionRequest): Observable<SavedRecommendationResponse> {
    return this.http.put<SavedRecommendationResponse>(`${this.baseUrl}/${id}/approve`, request);
  }

  reject(id: number, request: RecommendationDecisionRequest): Observable<SavedRecommendationResponse> {
    return this.http.put<SavedRecommendationResponse>(`${this.baseUrl}/${id}/reject`, request);
  }
}
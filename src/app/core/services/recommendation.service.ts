import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RecommendationRequestDTO } from '../models/recommendation.model';
import {
  Page,
  RecommendationDecisionRequest,
  RecommendationStatus,
  SavedRecommendationResponse,
} from '../models/sentinel.models';

/**
 * The legacy preview endpoints (`/generate`, `/machine/{machineId}`) are
 * deliberately not wrapped here anymore - they resolve machines against a
 * separate, sparsely-seeded demo table and 404 for any real machine outside
 * it (see MaintenanceRecommendationController's Javadoc on the backend).
 * generateAndSave/history/approve/reject below are the one real workflow:
 * generate a recommendation for any real machine, persist it, and drive it
 * through approve/reject.
 */
@Injectable({ providedIn: 'root' })
export class RecommendationService {
  private readonly baseUrl = `${environment.apiUrl}/maintenance-cost/recommendations`;

  constructor(private readonly http: HttpClient) {}

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
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  MaintenanceRecommendationDTO,
  RecommendationRequestDTO,
} from '../models/recommendation.model';

@Injectable({ providedIn: 'root' })
export class RecommendationService {
  private readonly baseUrl = `${environment.apiUrl}/recommendations`;

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
}
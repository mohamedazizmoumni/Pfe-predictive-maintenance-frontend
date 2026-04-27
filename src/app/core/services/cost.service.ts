import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CompareRequestDTO, CostComparisonDTO } from '../models/cost-comparison.model';

@Injectable({ providedIn: 'root' })
export class CostService {
  private readonly baseUrl = `${environment.apiUrl}/costs`;

  constructor(private readonly http: HttpClient) {}

  compareCosts(request: CompareRequestDTO): Observable<CostComparisonDTO> {
    return this.http.post<CostComparisonDTO>(`${this.baseUrl}/compare`, request);
  }
}

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiEndpoint } from '../http/api-base';
import { PredictionExplanation } from '../models/sentinel.models';

@Injectable({ providedIn: 'root' })
export class ExplainabilityService {
  constructor(private http: HttpClient) {}

  explain(machineId: number): Observable<PredictionExplanation> {
    return this.http.get<PredictionExplanation>(apiEndpoint(`/machines/${machineId}/explain`));
  }
}

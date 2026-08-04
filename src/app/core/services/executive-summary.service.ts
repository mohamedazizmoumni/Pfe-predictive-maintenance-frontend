import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiEndpoint } from '../http/api-base';
import { ExecutiveSummary } from '../models/sentinel.models';

@Injectable({ providedIn: 'root' })
export class ExecutiveSummaryService {
  private readonly url = apiEndpoint('/executive-summary');

  constructor(private http: HttpClient) {}

  getSummary(): Observable<ExecutiveSummary> {
    return this.http.get<ExecutiveSummary>(this.url);
  }
}

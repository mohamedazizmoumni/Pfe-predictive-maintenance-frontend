import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiEndpoint } from '../http/api-base';
import { TimelineEntry } from '../models/sentinel.models';

@Injectable({ providedIn: 'root' })
export class TimelineService {
  constructor(private http: HttpClient) {}

  forMachine(machineId: number): Observable<TimelineEntry[]> {
    return this.http.get<TimelineEntry[]>(apiEndpoint(`/machines/${machineId}/timeline`));
  }
}

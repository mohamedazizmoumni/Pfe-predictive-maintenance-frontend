import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiEndpoint } from '../http/api-base';
import { CalendarEventDto } from '../models/sentinel.models';

@Injectable({ providedIn: 'root' })
export class CalendarService {
  private readonly baseUrl = apiEndpoint('/calendar/events');

  constructor(private http: HttpClient) {}

  getRange(startDate: string, endDate: string): Observable<CalendarEventDto[]> {
    const params = new HttpParams().set('startDate', startDate).set('endDate', endDate);
    return this.http.get<CalendarEventDto[]>(`${this.baseUrl}/range`, { params });
  }
}

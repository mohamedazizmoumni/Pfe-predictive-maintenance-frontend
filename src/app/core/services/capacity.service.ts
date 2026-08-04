import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiEndpoint } from '../http/api-base';
import { CalendarEventDto, TechnicianCapacity } from '../models/sentinel.models';

@Injectable({ providedIn: 'root' })
export class CapacityService {
  private readonly capacityUrl = apiEndpoint('/scheduling/capacity');
  private readonly eventsUrl = apiEndpoint('/calendar/events');

  constructor(private http: HttpClient) {}

  getFleetCapacity(): Observable<TechnicianCapacity[]> {
    return this.http.get<TechnicianCapacity[]>(this.capacityUrl);
  }

  getUpcomingEvents(startDate: Date, endDate: Date): Observable<CalendarEventDto[]> {
    const params = new HttpParams()
      .set('startDate', startDate.toISOString())
      .set('endDate', endDate.toISOString());
    return this.http.get<CalendarEventDto[]>(`${this.eventsUrl}/range`, { params });
  }
}

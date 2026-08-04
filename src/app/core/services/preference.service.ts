import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiEndpoint } from '../http/api-base';

/**
 * Self-scoped key/value preference store — every call operates on the
 * caller's own preferences (resolved server-side from the JWT).
 */
@Injectable({ providedIn: 'root' })
export class PreferenceService {
  private readonly baseUrl = apiEndpoint('/preferences');

  constructor(private http: HttpClient) {}

  getAll(): Observable<Record<string, string>> {
    return this.http.get<Record<string, string>>(this.baseUrl);
  }

  get(key: string): Observable<string> {
    return this.http.get(`${this.baseUrl}/${key}`, { responseType: 'text' });
  }

  set(key: string, value: string): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${key}`, { value });
  }
}

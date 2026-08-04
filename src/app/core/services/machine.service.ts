import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Machine } from '../models/machine.model';
import { apiEndpoint } from '../http/api-base';

@Injectable({ providedIn: 'root' })
export class MachineService {
  private readonly baseUrl = apiEndpoint('/api/v1/machines');

  constructor(private readonly http: HttpClient) {}

  getAll(): Observable<Machine[]> {
    return this.http.get<Machine[]>(this.baseUrl, {
      params: this.cacheBustParams(),
      headers: this.noCacheHeaders(),
    });
  }

  getById(id: number): Observable<Machine> {
    return this.http.get<Machine>(`${this.baseUrl}/${id}`, {
      params: this.cacheBustParams(),
      headers: this.noCacheHeaders(),
    });
  }

  /** Cache-bust: assigned-machine visibility depends on which account is logged
   * in, so a URL-keyed browser/proxy cache must never serve a response captured
   * under a different account (e.g. after switching users in the same tab). */
  private cacheBustParams(): HttpParams {
    return new HttpParams().set('_', Date.now().toString());
  }

  private noCacheHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
    });
  }

  create(request: Partial<Machine>, photo?: File | null): Observable<Machine> {
    if (photo) {
      const formData = this.buildMachineFormData(request, photo);
      return this.http.post<Machine>(this.baseUrl, formData);
    }

    return this.http.post<Machine>(this.baseUrl, request);
  }

  private buildMachineFormData(request: Partial<Machine>, photo: File): FormData {
    const formData = new FormData();
    Object.entries(request).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }
      formData.append(key, String(value));
    });
    formData.append('photo', photo);
    return formData;
  }
}

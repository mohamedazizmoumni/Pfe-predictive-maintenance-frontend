import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Machine } from '../models/machine.model';
import { apiEndpoint } from '../http/api-base';

@Injectable({ providedIn: 'root' })
export class MachineService {
  private readonly baseUrl = apiEndpoint('/api/v1/machines');

  constructor(private readonly http: HttpClient) {}

  getAll(): Observable<Machine[]> {
    return this.http.get<Machine[]>(this.baseUrl);
  }

  getById(id: number): Observable<Machine> {
    return this.http.get<Machine>(`${this.baseUrl}/${id}`);
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

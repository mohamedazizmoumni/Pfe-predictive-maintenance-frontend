import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Machine } from '../models/machine.model';
import { apiEndpoint } from '../core/http/api-base';

@Injectable({
  providedIn: 'root',
})
export class MachineService {
  private readonly baseUrl = apiEndpoint('/api/v1/machines');

  constructor(private http: HttpClient) {}

  getAllMachines(): Observable<Machine[]> {
    return this.http
      .get<Machine[]>(this.baseUrl)
      .pipe(catchError((error) => this.handleError(error, 'Failed to load machines.')));
  }

  getMachineById(id: number): Observable<Machine> {
    return this.http
      .get<Machine>(`${this.baseUrl}/${id}`)
      .pipe(catchError((error) => this.handleError(error, 'Failed to load machine details.')));
  }

  createMachine(request: Partial<Machine>, photo?: File | null): Observable<Machine> {
    const body = photo ? this.buildMachineFormData(request, photo) : request;
    return this.http
      .post<Machine>(this.baseUrl, body)
      .pipe(catchError((error) => this.handleError(error, 'Failed to create machine.')));
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

  private handleError(error: unknown, fallbackMessage: string) {
    const message =
      typeof error === 'object' &&
      error !== null &&
      'error' in error &&
      typeof (error as { error?: { message?: string } }).error?.message === 'string'
        ? (error as { error: { message: string } }).error.message
        : fallbackMessage;

    return throwError(() => new Error(message));
  }
}

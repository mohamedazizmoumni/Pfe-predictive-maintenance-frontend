import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { Machine } from '../models/machine.model';
import { apiEndpoint } from '../http/api-base';

@Injectable({ providedIn: 'root' })
export class MachineService {
  private readonly baseUrl = apiEndpoint('/machines');

  constructor(private readonly http: HttpClient) {}

  getAll(): Observable<Machine[]> {
    return this.http.get<Machine[]>(this.baseUrl);
  }

  getById(id: number): Observable<Machine> {
    return this.http.get<Machine>(`${this.baseUrl}/${id}`);
  }

  create(machine: Machine): Observable<Machine> {
    return throwError(() => new Error('Machine creation endpoint is not available in the current backend contract.'));
  }
}

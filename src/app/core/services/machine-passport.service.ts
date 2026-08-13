import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiEndpoint } from '../http/api-base';
import { MachinePassportResponse } from '../models/machine-passport.model';

@Injectable({ providedIn: 'root' })
export class MachinePassportService {
  constructor(private http: HttpClient) {}

  get(machineId: number): Observable<MachinePassportResponse> {
    return this.http.get<MachinePassportResponse>(apiEndpoint(`/machines/${machineId}/passport`));
  }
}

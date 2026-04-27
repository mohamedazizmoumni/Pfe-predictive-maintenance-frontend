import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MaintenancePart } from '../models/maintenance-part.model';

@Injectable({ providedIn: 'root' })
export class PartService {
  private readonly baseUrl = `${environment.apiUrl}/inventory/parts`;

  constructor(private readonly http: HttpClient) {}

  getAll(): Observable<MaintenancePart[]> {
    return this.http.get<MaintenancePart[]>(this.baseUrl);
  }

  getById(id: number): Observable<MaintenancePart> {
    return this.http.get<MaintenancePart>(`${this.baseUrl}/${id}`);
  }

  create(part: MaintenancePart): Observable<MaintenancePart> {
    return this.http.post<MaintenancePart>(this.baseUrl, part);
  }
}

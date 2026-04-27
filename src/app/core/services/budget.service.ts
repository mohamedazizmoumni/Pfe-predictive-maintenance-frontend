import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MaintenanceBudgetDTO } from '../models/budget.model';

@Injectable({ providedIn: 'root' })
export class BudgetService {
  private readonly baseUrl = `${environment.apiUrl}/budgets`;

  constructor(private readonly http: HttpClient) {}

  getBudgetStatus(department: string, period: string): Observable<MaintenanceBudgetDTO> {
    return this.http.get<MaintenanceBudgetDTO>(`${this.baseUrl}/${department}/${period}`);
  }

  getStatus(department: string, period: string): Observable<MaintenanceBudgetDTO> {
    return this.getBudgetStatus(department, period);
  }

  registerExpense(budgetId: number, amount: number): Observable<MaintenanceBudgetDTO> {
    return this.http.post<MaintenanceBudgetDTO>(`${this.baseUrl}/${budgetId}/expense`, { amount });
  }

  getAlert(budgetId: number): Observable<{ alertTriggered: boolean }> {
    return this.http.get<{ alertTriggered: boolean }>(`${this.baseUrl}/${budgetId}/alert`);
  }

  canAfford(budgetId: number, actionCost: number): Observable<{ canAfford: boolean }> {
    const params = new HttpParams().set('actionCost', actionCost);
    return this.http.get<{ canAfford: boolean }>(`${this.baseUrl}/${budgetId}/canAfford`, { params });
  }
}
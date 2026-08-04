import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { apiEndpoint } from '../http/api-base';
import { MaintenanceBudgetDTO } from '../models/budget.model';

interface MaintenanceCostBudgetResponse {
  id: number;
  department: string;
  period: string;
  allocatedAmount: number;
  spentAmount: number;
  remainingAmount: number;
  utilizationPercentage: number;
  isOverBudget: boolean;
}

@Injectable({ providedIn: 'root' })
export class BudgetService {
  private readonly baseUrl = apiEndpoint('/maintenance/budgets');

  constructor(private readonly http: HttpClient) {}

  getBudgetStatus(department: string, period: string): Observable<MaintenanceBudgetDTO> {
    return this.http.get<MaintenanceCostBudgetResponse>(`${this.baseUrl}/${department}/${period}`).pipe(
      map(res => ({
        budgetId: res.id,
        department: res.department,
        period: res.period,
        allocatedAmount: res.allocatedAmount,
        spentAmount: res.spentAmount,
        remainingAmount: res.remainingAmount,
        percentageUsed: res.utilizationPercentage,
        alertTriggered: res.isOverBudget || res.utilizationPercentage >= 90,
      })),
    );
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
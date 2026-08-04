import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiEndpoint } from '../http/api-base';

export interface TopCostMachine {
  machineId: number;
  machineName: string;
  totalCost: number;
  maintenanceCost: number;
  failureCost: number;
}

export interface BudgetAlert {
  department: string;
  period: string;
  alertType: string;
  message: string;
  amount: number;
}

export interface MonthlyCost {
  month: string;
  maintenanceCost: number;
  failureCost: number;
  totalCost: number;
}

export interface MaintenanceCostBudget {
  id: number;
  department: string;
  period: string;
  allocatedAmount: number;
  spentAmount: number;
  remainingAmount: number;
  utilizationPercentage: number;
  isOverBudget: boolean;
}

export interface FinancialDashboardResponse {
  totalAllocated: number;
  totalSpent: number;
  totalRemaining: number;
  overallUtilization: number;
  topCostMachines: TopCostMachine[];
  alerts: BudgetAlert[];
  monthlyCosts: MonthlyCost[];
  budgetsByDepartment: MaintenanceCostBudget[];
}

export interface FailureDetail {
  id: number;
  machineId: number;
  machineName: string;
  failureType: string;
  downtimeHours: number;
  cost: number;
  occurredAt: string;
}

export interface FailureReportResponse {
  totalFailures: number;
  totalCost: number;
  totalDowntimeHours: number;
  failures: FailureDetail[];
}

export interface MaintenanceActionDetail {
  id: number;
  machineId: number;
  machineName: string;
  type: string;
  status: string;
  durationHours: number;
  laborCost: number;
  partsCost: number;
  totalCost: number;
  scheduledDate: string;
}

export interface MaintenanceReportResponse {
  totalActions: number;
  totalCost: number;
  totalLaborCost: number;
  totalPartsCost: number;
  actions: MaintenanceActionDetail[];
}

export interface FailureSummary {
  totalFailures: number;
  totalCost: number;
  averageCostPerFailure: number;
  totalDowntimeHours: number;
  failuresByType: Record<string, number>;
  generatedAt: string;
}

export interface MaintenanceRecommendationRequest {
  machineId: number;
  failureProbability: number;
  daysUntilPredictedFailure: number;
  requiredPartIds?: number[];
}

export interface MaintenanceRecommendationResponse {
  machineId: number;
  machineName: string;
  urgencyLevel: string;
  recommendedAction: string;
  justification: string;
  estimatedCost: number;
  estimatedSavings: number;
  partsAvailable: boolean;
  missingParts: string[];
  daysUntilFailure: number;
  failureProbability: number;
}

@Injectable({ providedIn: 'root' })
export class MaintenanceCostService {
  private readonly baseUrl = apiEndpoint('/maintenance-cost');

  constructor(private http: HttpClient) {}

  getDashboard(): Observable<FinancialDashboardResponse> {
    return this.http.get<FinancialDashboardResponse>(`${this.baseUrl}/dashboard`);
  }

  getFailureReport(): Observable<FailureReportResponse> {
    return this.http.get<FailureReportResponse>(`${this.baseUrl}/reports/failures`);
  }

  getMaintenanceReport(): Observable<MaintenanceReportResponse> {
    return this.http.get<MaintenanceReportResponse>(`${this.baseUrl}/reports/maintenance`);
  }

  getTopCostMachines(): Observable<TopCostMachine[]> {
    return this.http.get<TopCostMachine[]>(`${this.baseUrl}/reports/top-cost-machines`);
  }

  getFailureSummary(): Observable<FailureSummary> {
    return this.http.get<FailureSummary>(`${this.baseUrl}/reports/failure/summary`);
  }

  generateRecommendation(request: MaintenanceRecommendationRequest): Observable<MaintenanceRecommendationResponse> {
    return this.http.post<MaintenanceRecommendationResponse>(`${this.baseUrl}/recommendations/generate`, request);
  }

  getRecommendationForMachine(machineId: number, failureProbability: number, daysUntilFailure: number): Observable<MaintenanceRecommendationResponse> {
    const params = { failureProbability: failureProbability.toString(), daysUntilFailure: daysUntilFailure.toString() };
    return this.http.get<MaintenanceRecommendationResponse>(`${this.baseUrl}/recommendations/machine/${machineId}`, { params });
  }
}

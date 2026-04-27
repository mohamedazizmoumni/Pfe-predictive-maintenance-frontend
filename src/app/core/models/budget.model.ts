export interface MaintenanceBudgetDTO {
  budgetId: number;
  department: string;
  period: string;
  allocatedAmount: number;
  spentAmount: number;
  remainingAmount: number;
  percentageUsed: number;
  alertTriggered: boolean;
}

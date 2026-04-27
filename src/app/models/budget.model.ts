export interface Budget {
  department: string;
  period: string;
  allocatedAmount: number;
  spentAmount: number;
  remainingAmount: number;
  alertTriggered: boolean;
  percentageUsed: number;
}

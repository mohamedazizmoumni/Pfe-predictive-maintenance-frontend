export interface CostComparisonDTO {
  machineId: number;
  machineName: string;
  preventiveCost: number;
  correctiveCost: number;
  estimatedSavings: number;
  recommendation: string;
  urgencyLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface CompareRequestDTO {
  machineId: number;
  actionId: number;
  estimatedFailureDowntimeHours: number;
}

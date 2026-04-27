export type UrgencyLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type RecommendedAction = 'PREVENTIVE' | 'CORRECTIVE' | 'MONITOR';

export interface MaintenanceRecommendationDTO {
  machineId: number;
  machineName: string;
  urgencyLevel: UrgencyLevel;
  recommendedAction: RecommendedAction;
  justification: string;
  estimatedCost: number;
  estimatedSavings: number;
  partsAvailable: boolean;
  missingParts: string[];
  daysUntilFailure: number;
  failureProbability: number;
}

export interface RecommendationRequestDTO {
  machineId: number;
  failureProbability: number;
  daysUntilPredictedFailure: number;
  requiredPartIds: number[];
}

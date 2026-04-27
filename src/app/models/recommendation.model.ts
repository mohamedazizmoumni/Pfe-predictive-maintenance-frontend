export type UrgencyLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type RecommendedAction = 'PREVENTIVE' | 'CORRECTIVE' | 'MONITOR';

export interface Recommendation {
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
}

export type UrgencyLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type RecommendedAction = 'PREVENTIVE' | 'CORRECTIVE' | 'MONITOR';

// The request DTO stays: it's shared by the real, working
// POST /generate-and-save endpoint (see RecommendationService).
export interface RecommendationRequestDTO {
  machineId: number;
  failureProbability: number;
  daysUntilPredictedFailure: number;
  requiredPartIds: number[];
}

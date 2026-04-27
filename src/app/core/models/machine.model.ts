export interface Machine {
  id?: number;
  name: string;
  location: string;
  status: 'RUNNING' | 'UNDER_MAINTENANCE' | 'FAILED';
  hourlyProductionValue: number;
  replacementCost: number;
  criticalityLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  age: number;
}

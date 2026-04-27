export type MachineStatus = 'RUNNING' | 'UNDER_MAINTENANCE' | 'FAILED';

export type CriticalityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Machine {
  id: number;
  name: string;
  location: string;
  status: MachineStatus;
  hourlyProductionValue: number;
  replacementCost: number;
  criticalityLevel: CriticalityLevel;
  age: number;
}

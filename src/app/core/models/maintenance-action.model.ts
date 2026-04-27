import { Machine } from './machine.model';
import { MaintenancePart } from './maintenance-part.model';

export type ActionType = 'PREVENTIVE' | 'CORRECTIVE';
export type ActionStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED';

export interface MaintenanceAction {
  id?: number;
  machine: Machine;
  type: ActionType;
  estimatedDurationHours: number;
  laborCostPerHour: number;
  parts: MaintenancePart[];
  status: ActionStatus;
  scheduledDate: string;
}

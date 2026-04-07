import { AlertSeverity, AlertStatus } from '../../core/models/sentinel.models';

export interface AlertListFilters {
  status?: AlertStatus;
  severity?: AlertSeverity;
  assignedTo?: string;
  viewedOnly?: boolean;
  search?: string;
}

export type AlertActionMode = 'acknowledge' | 'escalate' | 'close';

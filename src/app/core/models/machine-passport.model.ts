import { Machine } from './machine.model';
import { AttachmentResponse, CommentResponse, WarrantyResponse } from './sentinel.models';
import { LatestPredictionRecord } from '../services/prediction.service';

export interface PassportAlertSummary {
  id: number;
  title: string;
  severity: string;
  status: string;
  createdDate: string;
}

export interface PassportRecommendationSummary {
  id: number;
  urgencyLevel: string;
  recommendedAction: string;
  status: string;
  generatedAt: string;
  resultingMaintenanceId?: number;
}

export interface PassportMaintenanceSummary {
  id: number;
  type: string;
  status: string;
  priority: string;
  scheduledDate?: string;
  completedDate?: string;
  assignedTechnicianId?: number;
}

export interface PassportTimelineEntry {
  timestamp: string;
  category: string;
  title: string;
  description?: string;
  actor?: string;
}

export interface MachinePassportResponse {
  machine: Machine;
  latestPrediction?: LatestPredictionRecord | null;
  activeAlerts: PassportAlertSummary[];
  recommendations: PassportRecommendationSummary[];
  maintenanceHistory: PassportMaintenanceSummary[];
  attachments: AttachmentResponse[];
  comments: CommentResponse[];
  warranties: WarrantyResponse[];
  timeline: PassportTimelineEntry[];
}

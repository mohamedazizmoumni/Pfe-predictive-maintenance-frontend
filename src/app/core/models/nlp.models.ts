export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type AiAssistantMode = 'technician' | 'manager';

export interface AiDiagnosisRequest {
  machineId: number;
  text: string;
}

export interface AiMaintenanceDiagnosis {
  issueType: string;
  severity: RiskLevel;
  confidence: number;
  probableCauses: string[];
  recommendedActions: string[];
  machineName?: string;
  machineId?: string | number;
  analyzedAt?: string;
  sourceText?: string;
}

export interface RiskOverviewMetric {
  label: string;
  value: string;
  tone: 'good' | 'warning' | 'critical' | 'neutral';
  detail: string;
}

export interface NlpAlert {
  id: string | number;
  machineId?: number;
  timestamp: string;
  failureType: string;
  riskLevel: RiskLevel;
  keywords: string[];
  summary?: string;
}

export interface AiInsight {
  id?: string | number;
  title: string;
  value?: string | number;
  details?: string;
  timestamp?: string;
}

export interface Recommendation {
  id?: string | number;
  machineId?: number;
  title: string;
  description: string;
  confidence?: number; // 0..1
}

export interface RootCause {
  cause: string;
  confidence?: number;
}

export interface TechnicianReportResult {
  originalText: string;
  analyzedAt: string;
  failureType?: string;
  riskLevel?: RiskLevel;
  keywords?: string[];
  rootCauses?: RootCause[];
  recommendations?: Recommendation[];
}

export interface NlpFeedItem {
  alert?: NlpAlert;
  insight?: AiInsight;
}

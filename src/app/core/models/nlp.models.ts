// nlp.models.ts
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type AiAssistantMode = 'technician' | 'manager';

export type QueryIntent = 'DIAGNOSTIC' | 'QUESTION' | 'STATUS' | 'COMMAND' | 'UNKNOWN';

// ── What the frontend sends ──────────────────────────────────────────────────
export interface MachineContext {
  machineId?:       string | number;
  machineName?:     string;
  zone?:            string;
  status?:          string;
  healthScore?:     number;
  sensors?:         Record<string, number | string>;
  activeAlerts?:    string[];
  lastMaintenance?: string;
  role?:            string;
}

export interface AiDiagnosisRequest {
  machineId:        number;
  text:             string;
  machineContext?:  MachineContext;   // ← send machine data with every request
  source?:          string;
}

// ── What Python returns ──────────────────────────────────────────────────────
export interface AiMaintenanceDiagnosis {
  // Core diagnosis fields (mapped from Python response)
  issueType:          string;          // ← from failureType
  severity:           RiskLevel;       // ← from riskLevel
  confidence:         number;          // 0–1
  probableCauses:     string[];        // ← from rootCause (split into array)
  recommendedActions: string[];        // ← from recommendation (split into array)

  // Conversational fields (NEW — Python now returns these)
  message?:           string;          // ← human-readable chat reply
  intent?:            QueryIntent;
  isQuestion?:        boolean;

  // Metadata
  machineName?:       string;
  machineId?:         string | number;
  analyzedAt?:        string;
  sourceText?:        string;
}

// ── Equipment photo analysis (local vision model, see nlp.service.ts) ───────
export interface AiImageDiagnosisRequest {
  machineId: number;
  image:     File;
  context?:  string;
}

export type ImageAnalysisStatus = 'PENDING' | 'COMPLETE' | 'FAILED';

export interface AiImageAnalysis {
  id?:               number;
  status:            ImageAnalysisStatus;
  description:       string;
  riskLevel:         RiskLevel;
  keywords:          string[];
  message:           string;
  modelBackend?:     string;
  attachmentId?:     number;
  analyzedAt?:       string;
}

// ── Everything else unchanged ────────────────────────────────────────────────
export interface RiskOverviewMetric {
  label:  string;
  value:  string;
  tone:   'good' | 'warning' | 'critical' | 'neutral';
  detail: string;
}

export interface NlpAlert {
  id:          string | number;
  machineId?:  number;
  timestamp:   string;
  failureType: string;
  riskLevel:   RiskLevel;
  keywords:    string[];
  summary?:    string;
}

export interface AiInsight {
  id?:        string | number;
  title:      string;
  value?:     string | number;
  details?:   string;
  timestamp?: string;
}

export interface Recommendation {
  id?:         string | number;
  machineId?:  number;
  title:       string;
  description: string;
  confidence?: number;
}

export interface RootCause {
  cause:       string;
  confidence?: number;
}

export interface TechnicianReportResult {
  originalText:     string;
  analyzedAt:       string;
  failureType?:     string;
  riskLevel?:       RiskLevel;
  keywords?:        string[];
  rootCauses?:      RootCause[];
  recommendations?: Recommendation[];
}

export interface NlpFeedItem {
  alert?:   NlpAlert;
  insight?: AiInsight;
}

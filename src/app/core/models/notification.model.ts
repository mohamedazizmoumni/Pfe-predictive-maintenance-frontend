export type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface Notification {
  id: number;
  machineId: number;
  title: string;
  body: string;
  riskLevel: RiskLevel;
  predictionRecordId: number;
  targetRoles: string;
  isRead: boolean;
  createdAt: string;
}

export interface UnreadCountResponse {
  count: number;
}

export interface ReadAllResponse {
  updated: number;
}

export const RISK_CONFIG: Record<
  RiskLevel,
  {
    color: string;
    bgColor: string;
    label: string;
    icon: string;
    priority: number;
  }
> = {
  CRITICAL: {
    color: '#ef4444',
    bgColor: '#fef2f2',
    label: 'Critical',
    icon: '🚨',
    priority: 4,
  },
  HIGH: {
    color: '#f97316',
    bgColor: '#fff7ed',
    label: 'High',
    icon: '⚠️',
    priority: 3,
  },
  MEDIUM: {
    color: '#eab308',
    bgColor: '#fefce8',
    label: 'Medium',
    icon: '🔶',
    priority: 2,
  },
  LOW: {
    color: '#22c55e',
    bgColor: '#f0fdf4',
    label: 'Low',
    icon: '✅',
    priority: 1,
  },
};

export function getRulRiskLevel(rulHours: number): RiskLevel {
  if (rulHours < 24) return 'CRITICAL';
  if (rulHours < 72) return 'HIGH';
  if (rulHours < 168) return 'MEDIUM';
  return 'LOW';
}

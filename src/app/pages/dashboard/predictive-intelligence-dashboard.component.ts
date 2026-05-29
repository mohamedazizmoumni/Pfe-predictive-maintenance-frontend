import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { interval, Subscription } from 'rxjs';

// ============================================================================
// LAYER 1: MACHINE HEALTH (PRIMARY)
// ============================================================================
interface MachineHealth {
  id: number;
  name: string;
  serialNumber: string;
  healthScore: number;  // 0-100
  degradationRate: number;  // % per day
  degradationTrend: 'improving' | 'stable' | 'degrading' | 'critical';
  rulHours: number;
  wearLevel: number;  // 0-100
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  lastHealthUpdate: Date;
  location: string;
}

// ============================================================================
// LAYER 2: AI PREDICTION (SECONDARY)
// ============================================================================
interface AIPrediction {
  machineId: number;
  machineName: string;
  failureProbability: number;  // 0-1
  predictedFailureDate: Date;
  confidenceScore: number;  // 0-1
  recommendations: string[];
  rootCause: string;
  contributingFactors: {
    factor: string;
    importance: number;  // 0-1
    trend: 'increasing' | 'stable' | 'decreasing';
  }[];
  modelVersion: string;
  lastPredictionUpdate: Date;
}

// ============================================================================
// LAYER 3: SENSOR TELEMETRY (TERTIARY)
// ============================================================================
interface SensorTelemetry {
  machineId: number;
  temperature: number;
  vibration: number;
  pressure: number;
  rpm: number;
  powerConsumption: number;
  timestamp: Date;
}

// ============================================================================
// PREDICTIVE ALERTS (ACTION-ORIENTED)
// ============================================================================
interface PredictiveAlert {
  id: number;
  severity: 'critical' | 'high' | 'medium';
  machineId: number;
  machineName: string;
  type: 'degradation_accelerating' | 'failure_imminent' | 'anomaly_detected' | 'maintenance_due';
  message: string;
  aiExplanation: string;
  timeWindow: string;  // "next 24h", "next 7 days"
  actionRequired: string;
  timestamp: Date;
}

@Component({
  selector: 'app-predictive-intelligence-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './predictive-intelligence-dashboard.component.html',
  styleUrls: ['./predictive-intelligence-dashboard.component.scss'],
})
export class PredictiveIntelligenceDashboardComponent implements OnInit, OnDestroy {
  private healthUpdateSubscription?: Subscription;
  private sensorUpdateSubscription?: Subscription;
  
  currentTime: Date = new Date();
  
  // ============================================================================
  // FLEET HEALTH METRICS (REALISTIC)
  // ============================================================================
  fleetHealth = {
    averageHealthScore: 78.5,  // NOT 100%
    machinesAtRisk: 3,
    totalMachines: 45,
    riskDistribution: {
      low: 35,
      medium: 7,
      high: 2,
      critical: 1
    },
    degradationTrend: 'stable' as 'improving' | 'stable' | 'degrading',
    predictedFailuresNext7Days: 2,
    preventedFailuresThisMonth: 5
  };
  
  // ============================================================================
  // LAYER 1: MACHINE HEALTH DATA
  // ============================================================================
  machineHealthData: MachineHealth[] = [
    {
      id: 1,
      name: 'CNC Machine A',
      serialNumber: 'CNC-001',
      healthScore: 45,  // Poor health
      degradationRate: 2.5,  // Degrading fast
      degradationTrend: 'critical',
      rulHours: 24,
      wearLevel: 78,
      riskLevel: 'CRITICAL',
      lastHealthUpdate: new Date(Date.now() - 1000 * 60 * 15),
      location: 'Floor 2, Zone A'
    },
    {
      id: 2,
      name: 'Lathe B',
      serialNumber: 'LAT-002',
      healthScore: 62,
      degradationRate: 1.2,
      degradationTrend: 'degrading',
      rulHours: 120,
      wearLevel: 55,
      riskLevel: 'HIGH',
      lastHealthUpdate: new Date(Date.now() - 1000 * 60 * 20),
      location: 'Floor 1, Zone B'
    },
    {
      id: 3,
      name: 'Press C',
      serialNumber: 'PRS-003',
      healthScore: 88,
      degradationRate: 0.3,
      degradationTrend: 'stable',
      rulHours: 336,
      wearLevel: 22,
      riskLevel: 'LOW',
      lastHealthUpdate: new Date(Date.now() - 1000 * 60 * 10),
      location: 'Floor 2, Zone C'
    },
    {
      id: 4,
      name: 'Mill D',
      serialNumber: 'MIL-004',
      healthScore: 58,
      degradationRate: 1.8,
      degradationTrend: 'degrading',
      rulHours: 96,
      wearLevel: 62,
      riskLevel: 'HIGH',
      lastHealthUpdate: new Date(Date.now() - 1000 * 60 * 25),
      location: 'Floor 1, Zone A'
    },
    {
      id: 5,
      name: 'Drill E',
      serialNumber: 'DRL-005',
      healthScore: 92,
      degradationRate: 0.2,
      degradationTrend: 'stable',
      rulHours: 480,
      wearLevel: 15,
      riskLevel: 'LOW',
      lastHealthUpdate: new Date(Date.now() - 1000 * 60 * 5),
      location: 'Floor 2, Zone B'
    }
  ];
  
  // ============================================================================
  // LAYER 2: AI PREDICTIONS
  // ============================================================================
  aiPredictions: AIPrediction[] = [
    {
      machineId: 1,
      machineName: 'CNC-001',
      failureProbability: 0.76,
      predictedFailureDate: new Date(Date.now() + 1000 * 60 * 60 * 24),  // Tomorrow
      confidenceScore: 0.87,
      recommendations: [
        'Schedule immediate bearing inspection',
        'Replace cooling system components',
        'Reduce operating load by 30%',
        'Plan 4-hour maintenance window'
      ],
      rootCause: 'Bearing degradation accelerated by thermal stress',
      contributingFactors: [
        { factor: 'Bearing wear', importance: 0.45, trend: 'increasing' },
        { factor: 'Temperature anomaly', importance: 0.30, trend: 'increasing' },
        { factor: 'Vibration pattern change', importance: 0.20, trend: 'increasing' },
        { factor: 'Operating hours', importance: 0.05, trend: 'stable' }
      ],
      modelVersion: 'v2.3.1',
      lastPredictionUpdate: new Date(Date.now() - 1000 * 60 * 10)
    },
    {
      machineId: 4,
      machineName: 'MIL-004',
      failureProbability: 0.65,
      predictedFailureDate: new Date(Date.now() + 1000 * 60 * 60 * 96),  // 4 days
      confidenceScore: 0.82,
      recommendations: [
        'Inspect hydraulic system',
        'Check temperature sensors',
        'Schedule preventive maintenance',
        'Monitor vibration closely'
      ],
      rootCause: 'Hydraulic system showing early degradation signs',
      contributingFactors: [
        { factor: 'Hydraulic pressure drift', importance: 0.40, trend: 'increasing' },
        { factor: 'Temperature elevation', importance: 0.35, trend: 'increasing' },
        { factor: 'Maintenance overdue', importance: 0.15, trend: 'stable' },
        { factor: 'Usage intensity', importance: 0.10, trend: 'stable' }
      ],
      modelVersion: 'v2.3.1',
      lastPredictionUpdate: new Date(Date.now() - 1000 * 60 * 15)
    }
  ];
  
  // ============================================================================
  // LAYER 3: SENSOR TELEMETRY (MONITORING ONLY)
  // ============================================================================
  sensorTelemetry: Map<number, SensorTelemetry> = new Map([
    [1, {
      machineId: 1,
      temperature: 87.2,
      vibration: 9.1,
      pressure: 142,
      rpm: 2580,
      powerConsumption: 13.8,
      timestamp: new Date()
    }],
    [2, {
      machineId: 2,
      temperature: 72.5,
      vibration: 6.3,
      pressure: 128,
      rpm: 2420,
      powerConsumption: 11.2,
      timestamp: new Date()
    }],
    [3, {
      machineId: 3,
      temperature: 65.1,
      vibration: 4.1,
      pressure: 125,
      rpm: 2400,
      powerConsumption: 10.5,
      timestamp: new Date()
    }],
    [4, {
      machineId: 4,
      temperature: 78.3,
      vibration: 7.2,
      pressure: 135,
      rpm: 2500,
      powerConsumption: 12.5,
      timestamp: new Date()
    }],
    [5, {
      machineId: 5,
      temperature: 62.8,
      vibration: 3.9,
      pressure: 122,
      rpm: 2380,
      powerConsumption: 10.1,
      timestamp: new Date()
    }]
  ]);
  
  // ============================================================================
  // PREDICTIVE ALERTS
  // ============================================================================
  predictiveAlerts: PredictiveAlert[] = [
    {
      id: 1,
      severity: 'critical',
      machineId: 1,
      machineName: 'CNC-001',
      type: 'failure_imminent',
      message: 'CNC-001 failure imminent — degradation accelerating over last 6 hours',
      aiExplanation: 'ML model detected rapid bearing wear acceleration combined with thermal stress. Historical pattern matches 87% of previous failures.',
      timeWindow: 'next 24 hours',
      actionRequired: 'Immediate maintenance required to prevent catastrophic failure',
      timestamp: new Date(Date.now() - 1000 * 60 * 15)
    },
    {
      id: 2,
      severity: 'high',
      machineId: 4,
      machineName: 'MIL-004',
      type: 'degradation_accelerating',
      message: 'MIL-004 degradation rate increased 40% in last 48 hours',
      aiExplanation: 'Hydraulic system pressure drift detected. Degradation pattern suggests component wear. Confidence: 82%',
      timeWindow: 'next 4 days',
      actionRequired: 'Schedule preventive maintenance within 72 hours',
      timestamp: new Date(Date.now() - 1000 * 60 * 45)
    },
    {
      id: 3,
      severity: 'medium',
      machineId: 2,
      machineName: 'LAT-002',
      type: 'maintenance_due',
      message: 'LAT-002 approaching maintenance threshold — health score declining',
      aiExplanation: 'Predictive model indicates optimal maintenance window approaching. Acting now prevents 65% failure risk.',
      timeWindow: 'next 7 days',
      actionRequired: 'Plan maintenance within next week',
      timestamp: new Date(Date.now() - 1000 * 60 * 120)
    }
  ];
  
  ngOnInit(): void {
    // Health updates every 30 seconds (analysis layer)
    this.healthUpdateSubscription = interval(30000).subscribe(() => {
      this.updateHealthData();
    });
    
    // Sensor updates every 2 seconds (telemetry only)
    this.sensorUpdateSubscription = interval(2000).subscribe(() => {
      this.updateSensorData();
    });
    
    // Clock update
    setInterval(() => {
      this.currentTime = new Date();
    }, 1000);
  }
  
  ngOnDestroy(): void {
    this.healthUpdateSubscription?.unsubscribe();
    this.sensorUpdateSubscription?.unsubscribe();
  }
  
  updateHealthData(): void {
    // Simulate slow health score changes (realistic)
    this.machineHealthData.forEach(machine => {
      // Health changes slowly based on degradation rate
      const change = -machine.degradationRate * 0.01;
      machine.healthScore = Math.max(0, Math.min(100, machine.healthScore + change));
      machine.wearLevel = 100 - machine.healthScore;
      
      // Update risk level based on health
      if (machine.healthScore < 50) machine.riskLevel = 'CRITICAL';
      else if (machine.healthScore < 65) machine.riskLevel = 'HIGH';
      else if (machine.healthScore < 80) machine.riskLevel = 'MEDIUM';
      else machine.riskLevel = 'LOW';
      
      machine.lastHealthUpdate = new Date();
    });
  }
  
  updateSensorData(): void {
    // Simulate fast sensor fluctuations (visual only)
    this.sensorTelemetry.forEach((sensor, machineId) => {
      sensor.temperature += (Math.random() - 0.5) * 1;
      sensor.vibration += (Math.random() - 0.5) * 0.3;
      sensor.pressure += (Math.random() - 0.5) * 2;
      sensor.rpm += (Math.random() - 0.5) * 20;
      sensor.powerConsumption += (Math.random() - 0.5) * 0.5;
      sensor.timestamp = new Date();
    });
  }
  
  getHealthColor(score: number): string {
    if (score >= 80) return '#10b981';
    if (score >= 65) return '#3b82f6';
    if (score >= 50) return '#f59e0b';
    return '#ef4444';
  }
  
  getRiskColor(level: string | number): string {
    // If it's a number (probability), convert to color
    if (typeof level === 'number') {
      if (level >= 0.75) return '#ef4444';  // Critical
      if (level >= 0.5) return '#f59e0b';   // High
      if (level >= 0.25) return '#3b82f6';  // Medium
      return '#10b981';  // Low
    }
    
    // If it's a string (risk level), use mapping
    const colors: Record<string, string> = {
      LOW: '#10b981',
      MEDIUM: '#3b82f6',
      HIGH: '#f59e0b',
      CRITICAL: '#ef4444'
    };
    return colors[level] || '#6b7280';
  }
  
  getTrendIcon(trend: string): string {
    const icons: Record<string, string> = {
      improving: '↓',
      stable: '→',
      degrading: '↑',
      critical: '⚠'
    };
    return icons[trend] || '→';
  }
  
  getTrendColor(trend: string): string {
    const colors: Record<string, string> = {
      improving: '#00e676',
      stable: '#00a8ff',
      degrading: '#ffa726',
      critical: '#ff1744'
    };
    return colors[trend] || '#78909c';
  }
  
  formatRUL(hours: number): string {
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  }
  
  getTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }
  
  formatDate(date: Date): string {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  
  createMaintenanceTask(machineId: number): void {
    console.log('Creating maintenance task for machine:', machineId);
  }
  
  viewAIExplanation(machineId: number): void {
    console.log('Viewing AI explanation for machine:', machineId);
  }
  
  viewDegradationTimeline(machineId: number): void {
    console.log('Viewing degradation timeline for machine:', machineId);
  }
  
  acknowledgeAlert(alertId: number): void {
    this.predictiveAlerts = this.predictiveAlerts.filter(a => a.id !== alertId);
  }
}

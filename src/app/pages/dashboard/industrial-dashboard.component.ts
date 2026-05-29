import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { interval, Subscription } from 'rxjs';

interface KPICard {
  icon: string;
  label: string;
  value: string | number;
  trend?: {
    value: string;
    positive: boolean;
  };
  color: string;
}

interface MachineStatus {
  id: number;
  name: string;
  serialNumber: string;
  status: 'healthy' | 'warning' | 'critical' | 'offline';
  temperature: number;
  vibration: number;
  pressure: number;
  failureProbability: number;
  rulHours: number;
  lastMaintenance: string;
  location: string;
}

interface Alert {
  id: number;
  severity: 'critical' | 'warning' | 'info';
  machine: string;
  message: string;
  timestamp: Date;
  recommendation: string;
}

@Component({
  selector: 'app-industrial-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './industrial-dashboard.component.html',
  styleUrls: ['./industrial-dashboard.component.scss'],
})
export class IndustrialDashboardComponent implements OnInit, OnDestroy {
  // Real-time update subscription
  private updateSubscription?: Subscription;
  
  // Current timestamp
  currentTime: Date = new Date();
  
  // KPI Cards
  kpiCards: KPICard[] = [
    {
      icon: '🏭',
      label: 'Total Machines',
      value: 45,
      trend: { value: '+2', positive: true },
      color: '#00a8ff'
    },
    {
      icon: '✅',
      label: 'Operational',
      value: 42,
      trend: { value: '93%', positive: true },
      color: '#00e676'
    },
    {
      icon: '⚠️',
      label: 'At Risk',
      value: 3,
      trend: { value: '-2', positive: true },
      color: '#ffa726'
    },
    {
      icon: '🚨',
      label: 'Critical Alerts',
      value: 2,
      trend: { value: '+1', positive: false },
      color: '#ff1744'
    },
    {
      icon: '📊',
      label: 'Uptime',
      value: '94.5%',
      trend: { value: '+1.2%', positive: true },
      color: '#7c4dff'
    },
    {
      icon: '💰',
      label: 'Downtime Cost',
      value: '12,500 TND',
      trend: { value: '-15%', positive: true },
      color: '#ffab00'
    }
  ];
  
  // Machine Status Data
  machines: MachineStatus[] = [
    {
      id: 1,
      name: 'CNC Machine A',
      serialNumber: 'CNC-001',
      status: 'critical',
      temperature: 87,
      vibration: 9.2,
      pressure: 142,
      failureProbability: 0.76,
      rulHours: 24,
      lastMaintenance: '26 days ago',
      location: 'Floor 2, Zone A'
    },
    {
      id: 2,
      name: 'Lathe B',
      serialNumber: 'LAT-002',
      status: 'warning',
      temperature: 72,
      vibration: 6.5,
      pressure: 128,
      failureProbability: 0.55,
      rulHours: 120,
      lastMaintenance: '12 days ago',
      location: 'Floor 1, Zone B'
    },
    {
      id: 3,
      name: 'Press C',
      serialNumber: 'PRS-003',
      status: 'healthy',
      temperature: 65,
      vibration: 4.2,
      pressure: 125,
      failureProbability: 0.15,
      rulHours: 336,
      lastMaintenance: '5 days ago',
      location: 'Floor 2, Zone C'
    },
    {
      id: 4,
      name: 'Mill D',
      serialNumber: 'MIL-004',
      status: 'warning',
      temperature: 78,
      vibration: 7.1,
      pressure: 135,
      failureProbability: 0.65,
      rulHours: 96,
      lastMaintenance: '18 days ago',
      location: 'Floor 1, Zone A'
    },
    {
      id: 5,
      name: 'Drill E',
      serialNumber: 'DRL-005',
      status: 'healthy',
      temperature: 62,
      vibration: 3.8,
      pressure: 122,
      failureProbability: 0.12,
      rulHours: 400,
      lastMaintenance: '3 days ago',
      location: 'Floor 2, Zone B'
    }
  ];
  
  // Alerts
  alerts: Alert[] = [
    {
      id: 1,
      severity: 'critical',
      machine: 'CNC-001',
      message: 'High failure probability detected (76%)',
      timestamp: new Date(Date.now() - 1000 * 60 * 15),
      recommendation: 'Schedule immediate preventive maintenance'
    },
    {
      id: 2,
      severity: 'critical',
      machine: 'MIL-004',
      message: 'Temperature anomaly detected (78°C)',
      timestamp: new Date(Date.now() - 1000 * 60 * 45),
      recommendation: 'Inspect cooling system'
    },
    {
      id: 3,
      severity: 'warning',
      machine: 'LAT-002',
      message: 'Maintenance overdue by 2 days',
      timestamp: new Date(Date.now() - 1000 * 60 * 120),
      recommendation: 'Schedule corrective maintenance'
    },
    {
      id: 4,
      severity: 'info',
      machine: 'PRS-003',
      message: 'Preventive maintenance completed successfully',
      timestamp: new Date(Date.now() - 1000 * 60 * 180),
      recommendation: 'No action required'
    }
  ];
  
  ngOnInit(): void {
    // Start real-time updates (every 5 seconds)
    this.updateSubscription = interval(5000).subscribe(() => {
      this.updateRealTimeData();
    });
    
    // Update clock every second
    setInterval(() => {
      this.currentTime = new Date();
    }, 1000);
  }
  
  ngOnDestroy(): void {
    this.updateSubscription?.unsubscribe();
  }
  
  updateRealTimeData(): void {
    // Simulate real-time sensor updates
    this.machines.forEach(machine => {
      // Randomly fluctuate sensor values
      machine.temperature += (Math.random() - 0.5) * 2;
      machine.vibration += (Math.random() - 0.5) * 0.5;
      machine.pressure += (Math.random() - 0.5) * 3;
      
      // Keep values in realistic ranges
      machine.temperature = Math.max(55, Math.min(95, machine.temperature));
      machine.vibration = Math.max(2, Math.min(12, machine.vibration));
      machine.pressure = Math.max(110, Math.min(150, machine.pressure));
      
      // Update failure probability based on sensor values
      machine.failureProbability = this.calculateFailureProbability(machine);
      
      // Update status based on probability
      if (machine.failureProbability >= 0.7) {
        machine.status = 'critical';
      } else if (machine.failureProbability >= 0.4) {
        machine.status = 'warning';
      } else {
        machine.status = 'healthy';
      }
    });
  }
  
  calculateFailureProbability(machine: MachineStatus): number {
    let probability = 0;
    
    // Temperature factor
    if (machine.temperature > 80) probability += 0.3;
    else if (machine.temperature > 70) probability += 0.15;
    
    // Vibration factor
    if (machine.vibration > 8) probability += 0.3;
    else if (machine.vibration > 6) probability += 0.15;
    
    // Pressure factor
    if (machine.pressure > 140) probability += 0.2;
    else if (machine.pressure > 130) probability += 0.1;
    
    return Math.min(0.95, probability);
  }
  
  getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      healthy: '#00e676',
      warning: '#ffa726',
      critical: '#ff1744',
      offline: '#78909c'
    };
    return colors[status] || '#78909c';
  }
  
  getRiskLevel(probability: number): string {
    if (probability >= 0.7) return 'CRITICAL';
    if (probability >= 0.5) return 'HIGH';
    if (probability >= 0.3) return 'MEDIUM';
    return 'LOW';
  }
  
  getRiskColor(probability: number): string {
    if (probability >= 0.7) return '#ff1744';
    if (probability >= 0.5) return '#ffa726';
    if (probability >= 0.3) return '#ffab00';
    return '#00e676';
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
  
  createMaintenanceTask(machineId: number): void {
    console.log('Creating maintenance task for machine:', machineId);
    // Implement navigation to maintenance creation
  }
  
  viewMachineDetails(machineId: number): void {
    console.log('Viewing details for machine:', machineId);
    // Implement navigation to machine details
  }
  
  acknowledgeAlert(alertId: number): void {
    console.log('Acknowledging alert:', alertId);
    this.alerts = this.alerts.filter(a => a.id !== alertId);
  }
}

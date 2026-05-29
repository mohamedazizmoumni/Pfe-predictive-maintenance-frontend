import { CommonModule, DatePipe, PercentPipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';
import { EquipmentService } from '../../core/services/equipment.service';
import { MachineContextService } from '../../core/services/machine-context.service';
import { NlpService } from '../../core/services/nlp.service';
import { RiskBadgeComponent } from '../../shared/nlp/risk-badge.component';
import { User } from '../../core/models/sentinel.models';
import {
  AiAssistantMode,
  AiMaintenanceDiagnosis,
  NlpFeedItem,
  RiskLevel,
  RiskOverviewMetric,
} from '../../core/models/nlp.models';
import { normalizeRoleName } from '../../core/utils/role.utils';

type AssistantMachine = {
  id: number;
  name?: string;
  serialNumber?: string;
  model?: string;
  location?: string;
};

@Component({
  selector: 'app-nlp-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, RiskBadgeComponent, DatePipe, PercentPipe],
  templateUrl: './nlp-dashboard.component.html',
  styleUrls: ['./nlp-dashboard.component.scss'],
})
export class NlpDashboardComponent implements OnInit, OnDestroy {
  readonly feed = signal<NlpFeedItem[]>([]);
  readonly connected = signal(false);
  readonly currentUser = signal<User | null>(null);
  readonly machines = signal<AssistantMachine[]>([]);
  readonly machineSearch = signal('');
  readonly draftText = signal('');
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal('');
  readonly assistantMessages = signal<Array<{ role: 'user' | 'assistant'; text: string; timestamp: string }>>([]);
  readonly lastDiagnosis = signal<AiMaintenanceDiagnosis | null>(null);

  readonly quickPrompts = [
    'Machine IMM-X700 is overheating and vibrating abnormally',
    'Hydraulic pressure unstable in production line 3',
    'Production slowdown on conveyor line 2',
    'Cooling fan noise and elevated temperature detected',
  ];

  readonly assistantMode = computed<AiAssistantMode>(() => {
    const roles = this.currentUser()?.roles ?? [];
    const normalizedRoles = roles.map((role) => normalizeRoleName(role.name));

    if (normalizedRoles.some((role) => ['MANAGER', 'ADMIN', 'SUPER_ADMIN', 'DATA_SCIENTIST', 'FINANCE_MANAGER', 'STOCK_MANAGER'].includes(role))) {
      return 'manager';
    }

    return 'technician';
  });

  readonly pageTitle = computed(() =>
    this.assistantMode() === 'manager' ? 'AI Risk Overview Dashboard' : 'AI Maintenance Assistant'
  );

  readonly pageSubtitle = computed(() =>
    this.assistantMode() === 'manager'
      ? 'Enterprise risk intelligence for managers and operations leaders.'
      : 'Describe the issue in natural language and receive an immediate maintenance diagnosis.'
  );

  readonly statusLabel = computed(() =>
    this.connected() ? 'Assistant connected' : 'Assistant syncing'
  );

  get selectedMachineContext(): any {
    return this.machineContextService.getMachine();
  }

  readonly filteredMachines = computed(() => {
    const query = this.machineSearch().trim().toLowerCase();
    const machines = this.machines();

    if (!query) {
      return machines;
    }

    return machines.filter((machine) => this.machineMatchesQuery(machine, query));
  });

  readonly machineContextLabel = computed(() => {
    const machine = this.selectedMachineContext;
    if (!machine) {
      return 'No machine selected';
    }

    return machine.name || machine.serialNumber || machine.model || `Machine ${machine.id}`;
  });

  readonly machineContextDetail = computed(() => {
    const machine = this.selectedMachineContext;
    return machine?.location ? `Location: ${machine.location}` : 'Location unavailable';
  });

  readonly recentSignals = computed(() => this.feed().slice(0, 6));

  readonly overviewMetrics = computed<RiskOverviewMetric[]>(() => {
    const alerts = this.feed().map((item) => item.alert).filter(Boolean);
    const highRisk = alerts.filter((alert) => alert?.riskLevel === 'HIGH' || alert?.riskLevel === 'CRITICAL').length;
    const mediumRisk = alerts.filter((alert) => alert?.riskLevel === 'MEDIUM').length;
    const healthyPercent = alerts.length === 0 ? 100 : Math.max(0, Math.round(((alerts.length - highRisk - mediumRisk) / alerts.length) * 100));
    const topIssue = this.findMostFrequentIssue(alerts);

    return [
      {
        label: 'High risk machines',
        value: String(highRisk),
        tone: highRisk > 0 ? 'critical' : 'good',
        detail: 'Immediate intervention queue',
      },
      {
        label: 'Medium risk anomalies',
        value: String(mediumRisk),
        tone: mediumRisk > 0 ? 'warning' : 'good',
        detail: 'Monitor and verify sensor trends',
      },
      {
        label: 'Healthy systems',
        value: `${healthyPercent}%`,
        tone: healthyPercent >= 80 ? 'good' : 'warning',
        detail: 'Estimated from current anomaly stream',
      },
      {
        label: 'Most frequent issue',
        value: topIssue || 'No active pattern',
        tone: topIssue ? 'neutral' : 'good',
        detail: 'Today\'s dominant diagnostic pattern',
      },
    ];
  });

  private readonly subs: Subscription[] = [];

  constructor(
    public nlp: NlpService,
    private authService: AuthService,
    private equipmentService: EquipmentService,
    private machineContextService: MachineContextService
  ) {}

  ngOnInit(): void {
    this.currentUser.set(this.authService.getCurrentUser());
    this.nlp.connect();
    this.equipmentService.loadMachines(0, 1000);
    this.subs.push(this.nlp.feed$.subscribe((feed) => this.feed.set(feed)));
    this.subs.push(this.nlp.connected$.subscribe((connected) => this.connected.set(connected)));
    this.subs.push(this.authService.currentUser$.subscribe((user) => this.currentUser.set(user)));
    this.subs.push(this.equipmentService.machines$.subscribe((machines) => this.machines.set((machines ?? []) as AssistantMachine[])));

    const machine = this.machineContextService.getMachine();
    if (machine) {
      this.machineSearch.set(this.buildMachineLabel(machine));
    }
  }

  submitReport(textOverride?: string): void {
    const text = (textOverride ?? this.draftText()).trim();
    const machineId = this.ensureMachineContextSelected();

    if (text.length < 5 || this.isSubmitting()) {
      return;
    }

    if (!machineId) {
      this.errorMessage.set('Please select a machine first.');
      return;
    }

    const timestamp = new Date().toISOString();
    this.errorMessage.set('');
    this.isSubmitting.set(true);
    this.assistantMessages.update((messages) => [
      ...messages,
      { role: 'user', text, timestamp },
    ]);

    if (!textOverride) {
      this.draftText.set('');
    }

    const payload = { machineId, text };

    this.nlp.analyzeReport(payload).subscribe({
      next: (diagnosis) => {
        this.handleDiagnosis(diagnosis);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || err?.message || 'Analysis failed');
        this.isSubmitting.set(false);
      },
    });
  }

  usePrompt(prompt: string): void {
    this.draftText.set(prompt);
    this.submitReport(prompt);
  }

  requestAction(action: string): void {
    this.assistantMessages.update((messages) => [
      ...messages,
      { role: 'assistant', text: action, timestamp: new Date().toISOString() },
    ]);
  }

  onMachineSearchChange(value: string): void {
    this.machineSearch.set(value);
    const resolved = this.findMachineByQuery(value);
    if (resolved) {
      this.setMachineContext(resolved);
    }
  }

  onMachineSelectionChange(value: string): void {
    const machineId = Number(value);
    if (!Number.isFinite(machineId)) {
      this.clearMachineContext();
      return;
    }

    const machine = this.machines().find((item) => item.id === machineId) ?? null;
    if (machine) {
      this.setMachineContext(machine);
    }
  }

  clearMachineContext(): void {
    this.machineContextService.setMachine(null);
    this.machineSearch.set('');
  }

  trackByIndex(i: number): number {
    return i;
  }

  formatIssueType(issueType: string): string {
    return issueType.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  severityLabel(level: RiskLevel | undefined): string {
    return level ?? 'LOW';
  }

  goToMachines(): void {
    window.location.href = '/equipment';
  }

  ngOnDestroy(): void {
    this.subs.forEach((subscription) => subscription.unsubscribe());
    this.nlp.disconnect();
  }

  private composeAssistantSummary(diagnosis: AiMaintenanceDiagnosis): string {
    const issue = this.formatIssueType(diagnosis.issueType);
    const severity = diagnosis.severity.toLowerCase();

    return `${issue} detected with ${severity} severity and ${Math.round(diagnosis.confidence * 100)}% confidence.`;
  }

  private handleDiagnosis(diagnosis: AiMaintenanceDiagnosis): void {
    this.lastDiagnosis.set(diagnosis);
    this.assistantMessages.update((messages) => [
      ...messages,
      {
        role: 'assistant',
        text: this.composeAssistantSummary(diagnosis),
        timestamp: diagnosis.analyzedAt ?? new Date().toISOString(),
      },
    ]);
    this.isSubmitting.set(false);
  }

  private ensureMachineContextSelected(): number | null {
    const existingMachineId = this.machineContextService.getMachineId();
    if (existingMachineId) {
      return existingMachineId;
    }

    const resolved = this.findMachineByQuery(this.machineSearch());
    if (resolved) {
      this.setMachineContext(resolved);
      return resolved.id;
    }

    return null;
  }

  private setMachineContext(machine: AssistantMachine): void {
    this.machineContextService.setMachine(machine);
    this.machineSearch.set(this.buildMachineLabel(machine));
  }

  private findMachineByQuery(query: string): AssistantMachine | null {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return null;
    }

    const exactMatch = this.machines().find((machine) => this.buildMachineLabel(machine).toLowerCase() === normalized);
    if (exactMatch) {
      return exactMatch;
    }

    if (/^\d+$/.test(normalized)) {
      const byId = this.machines().find((machine) => String(machine.id) === normalized);
      if (byId) {
        return byId;
      }
    }

    const partialMatches = this.machines().filter((machine) => this.machineMatchesQuery(machine, normalized));
    return partialMatches.length === 1 ? partialMatches[0] : null;
  }

  private machineMatchesQuery(machine: AssistantMachine, query: string): boolean {
    const haystack = [machine.name, machine.serialNumber, machine.model, String(machine.id)]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(query);
  }

  private buildMachineLabel(machine: AssistantMachine): string {
    return machine.name || machine.serialNumber || machine.model || `Machine ${machine.id}`;
  }

  private findMostFrequentIssue(alerts: Array<{ failureType?: string } | null | undefined>): string {
    const counts = new Map<string, number>();

    alerts.forEach((alert) => {
      const issue = alert?.failureType?.trim();

      if (!issue) {
        return;
      }

      counts.set(issue, (counts.get(issue) ?? 0) + 1);
    });

    let topIssue = '';
    let topCount = 0;

    counts.forEach((count, issue) => {
      if (count > topCount) {
        topIssue = issue;
        topCount = count;
      }
    });

    return topIssue;
  }
}

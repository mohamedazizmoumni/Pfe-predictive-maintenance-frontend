import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MachinePassportService } from '../../core/services/machine-passport.service';
import { MachinePassportResponse, PassportMaintenanceSummary } from '../../core/models/machine-passport.model';
import { AuthService } from '../../core/services/auth.service';
import { normalizeRoleName } from '../../core/utils/role.utils';

const OPEN_MAINTENANCE_STATUSES = ['SCHEDULED', 'APPROVED', 'IN_PROGRESS'];
const MANAGER_ROLES = ['MANAGER', 'ADMIN', 'SUPER_ADMIN'];

@Component({
  selector: 'app-machine-passport',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="passport-page">
      <div class="page-header">
        <button class="btn-back" (click)="goBack()">← Back</button>
        <h1>🛂 Digital Machine Passport</h1>
      </div>

      <div *ngIf="loading()" class="loading-state">Loading passport…</div>
      <div *ngIf="error()" class="error-state">{{ error() }}</div>

      <ng-container *ngIf="passport() as p">
        <!-- Quick Actions: the "field service workflow", contextual to this
             user's permissions and whether they have an open assigned job
             on this specific machine. -->
        <section class="card quick-actions">
          <h3>⚡ Quick Actions</h3>
          <div class="actions-row">
            <a class="action-btn" [routerLink]="['/equipment', p.machine.id, 'visual']">📡 View Live Telemetry</a>
            <a class="action-btn primary" *ngIf="myOpenTask() as t" [routerLink]="['/maintenance', t.id]">
              🔧 Continue My Assigned Task
            </a>
            <a class="action-btn" *ngIf="canReportProblem()" [routerLink]="['/maintenance']" [state]="reportProblemState()">
              🚨 Report a Problem
            </a>
          </div>
        </section>

        <!-- Identity + Current Condition -->
        <section class="card">
          <h2>{{ p.machine.name }}</h2>
          <div class="grid">
            <div><span class="label">Serial</span><span class="value">{{ p.machine.serialNumber }}</span></div>
            <div><span class="label">Model</span><span class="value">{{ p.machine.model || '—' }}</span></div>
            <div><span class="label">Location</span><span class="value">{{ p.machine.location || '—' }}</span></div>
            <div><span class="label">Status</span><span class="value badge">{{ p.machine.status }}</span></div>
            <div><span class="label">Risk Score</span><span class="value">{{ p.machine.riskScore != null ? (p.machine.riskScore | number:'1.0-0') + '%' : '—' }}</span></div>
            <div *ngIf="p.latestPrediction">
              <span class="label">Latest RUL</span>
              <span class="value">{{ p.latestPrediction.rulValue | number:'1.0-0' }}h ({{ p.latestPrediction.riskLevel }})</span>
            </div>
          </div>
        </section>

        <!-- Active Alerts -->
        <section class="card">
          <h3>🚨 Active Alerts ({{ p.activeAlerts.length }})</h3>
          <div *ngIf="!p.activeAlerts.length" class="empty">No active alerts.</div>
          <div class="row" *ngFor="let a of p.activeAlerts">
            <span class="badge sev-{{a.severity.toLowerCase()}}">{{ a.severity }}</span>
            <span class="row-title">{{ a.title }}</span>
            <span class="row-meta">{{ a.status }} · {{ a.createdDate | date:'short' }}</span>
          </div>
        </section>

        <!-- AI Recommendations -->
        <section class="card">
          <h3>🤖 AI Recommendations ({{ p.recommendations.length }})</h3>
          <div *ngIf="!p.recommendations.length" class="empty">No recommendations generated yet.</div>
          <div class="row" *ngFor="let r of p.recommendations">
            <span class="badge">{{ r.urgencyLevel }}</span>
            <span class="row-title">{{ r.recommendedAction }}</span>
            <span class="row-meta">{{ r.status }} · {{ r.generatedAt | date:'short' }}</span>
            <a *ngIf="r.resultingMaintenanceId" [routerLink]="['/maintenance', r.resultingMaintenanceId]">View Task →</a>
          </div>
        </section>

        <!-- Maintenance History -->
        <section class="card">
          <h3>🔧 Maintenance History ({{ p.maintenanceHistory.length }})</h3>
          <div *ngIf="!p.maintenanceHistory.length" class="empty">No maintenance recorded yet.</div>
          <div class="row" *ngFor="let m of p.maintenanceHistory">
            <span class="badge">{{ m.type }}</span>
            <span class="row-title">{{ m.status }} — {{ m.priority }}</span>
            <span class="row-meta">
              {{ m.completedDate ? ('Completed ' + (m.completedDate | date:'short')) : (m.scheduledDate ? ('Scheduled ' + (m.scheduledDate | date:'short')) : '') }}
            </span>
            <a [routerLink]="['/maintenance', m.id]">Open →</a>
          </div>
        </section>

        <!-- Warranty -->
        <section class="card" *ngIf="p.warranties.length">
          <h3>🛡️ Warranty</h3>
          <div class="row" *ngFor="let w of p.warranties">
            <span class="badge" [class.active]="w.active">{{ w.active ? 'ACTIVE' : 'EXPIRED' }}</span>
            <span class="row-title">{{ w.provider }}</span>
            <span class="row-meta">{{ w.startDate | date }} → {{ w.endDate | date }}</span>
          </div>
        </section>

        <!-- Documents & Evidence -->
        <section class="card">
          <h3>📎 Attachments ({{ p.attachments.length }})</h3>
          <div *ngIf="!p.attachments.length" class="empty">No attachments.</div>
          <div class="row" *ngFor="let doc of p.attachments">
            <span class="row-title">{{ doc.fileName }}</span>
            <span class="row-meta">{{ doc.uploadedBy }} · {{ doc.uploadedAt | date:'short' }}</span>
          </div>
        </section>

        <!-- Comments -->
        <section class="card">
          <h3>💬 Comments ({{ p.comments.length }})</h3>
          <div *ngIf="!p.comments.length" class="empty">No comments.</div>
          <div class="row" *ngFor="let c of p.comments">
            <span class="row-title">{{ c.body }}</span>
            <span class="row-meta">{{ c.authorUsername }} · {{ c.createdAt | date:'short' }}</span>
          </div>
        </section>

        <!-- Timeline -->
        <section class="card">
          <h3>📜 Activity Timeline ({{ p.timeline.length }})</h3>
          <div *ngIf="!p.timeline.length" class="empty">No activity recorded.</div>
          <div class="timeline-row" *ngFor="let t of p.timeline">
            <span class="timeline-dot"></span>
            <div class="timeline-content">
              <span class="row-title">{{ t.title }}</span>
              <span class="row-meta">{{ t.category }} · {{ t.timestamp | date:'short' }}<span *ngIf="t.actor"> · {{ t.actor }}</span></span>
            </div>
          </div>
        </section>
      </ng-container>
    </div>
  `,
  styles: [`
    .passport-page { display: flex; flex-direction: column; gap: 1rem; padding: 1rem; max-width: 900px; margin: 0 auto; }
    .page-header { display: flex; align-items: center; gap: 1rem; }
    .btn-back { background: none; border: 1px solid var(--color-border); border-radius: 8px; padding: 0.4rem 0.9rem; cursor: pointer; color: var(--color-text-primary); font-family: inherit; }
    h1 { margin: 0; font-size: 1.4rem; color: var(--color-text-primary); }
    .loading-state, .error-state, .empty { color: var(--color-text-muted); padding: 0.5rem 0; }
    .error-state { color: var(--color-danger-text, #c62828); }
    .card { background: var(--color-bg-elevated); border: 1px solid var(--color-border); border-radius: 14px; padding: 1.25rem; }
    .card h2 { margin: 0 0 1rem; color: var(--color-text-primary); }
    .card h3 { margin: 0 0 0.75rem; color: var(--color-text-primary); font-size: 1.05rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0.75rem; }
    .grid > div { display: flex; flex-direction: column; gap: 0.2rem; }
    .label { font-size: 0.75rem; text-transform: uppercase; color: var(--color-text-muted); letter-spacing: 0.03em; }
    .value { color: var(--color-text-primary); font-weight: 600; }
    .row { display: flex; align-items: center; gap: 0.6rem; padding: 0.5rem 0; border-bottom: 1px solid var(--color-border); flex-wrap: wrap; }
    .row:last-child { border-bottom: none; }
    .row-title { flex: 1; color: var(--color-text-primary); font-weight: 500; min-width: 160px; }
    .row-meta { color: var(--color-text-muted); font-size: 0.82rem; }
    .badge { padding: 2px 9px; border-radius: 999px; font-size: 0.72rem; font-weight: 700; background: var(--color-bg-sunken); color: var(--color-text-secondary); }
    .badge.active { background: #e8f5e9; color: #2e7d32; }
    .sev-critical { background: #ffebee; color: #c62828; }
    .sev-high { background: #fff3e0; color: #ef6c00; }
    .sev-warning { background: #fff8e1; color: #f57f17; }
    .sev-info { background: #e3f2fd; color: #1565c0; }
    .timeline-row { display: flex; gap: 0.75rem; padding: 0.4rem 0; }
    .timeline-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--color-accent); margin-top: 6px; flex-shrink: 0; }
    .timeline-content { display: flex; flex-direction: column; gap: 0.15rem; }

    .quick-actions .actions-row { display: flex; flex-wrap: wrap; gap: 0.6rem; }
    .action-btn {
      display: inline-flex; align-items: center; gap: 0.4rem;
      padding: 0.6rem 1rem; border-radius: 10px;
      background: var(--color-bg-sunken); color: var(--color-text-primary);
      text-decoration: none; font-weight: 600; font-size: 0.9rem;
      border: 1px solid var(--color-border);
    }
    .action-btn.primary { background: var(--color-accent); color: var(--color-text-on-accent); border-color: transparent; }
  `],
})
export class MachinePassportComponent implements OnInit {
  passport = signal<MachinePassportResponse | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private passportService: MachinePassportService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.error.set('No machine specified.');
      this.loading.set(false);
      return;
    }
    this.passportService.get(id).subscribe({
      next: (p) => {
        this.passport.set(p);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'Unable to load machine passport.');
        this.loading.set(false);
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/equipment']);
  }

  /** The current technician's own open (not yet completed) job on this machine, if any. */
  myOpenTask(): PassportMaintenanceSummary | null {
    const user = this.authService.getCurrentUser();
    const userId = user?.id;
    if (!userId) return null;

    const roles = (user?.roles ?? []).map((r) => normalizeRoleName(r.name));
    if (!roles.includes('TECHNICIAN')) return null;

    const history = this.passport()?.maintenanceHistory ?? [];
    return history.find(m =>
      OPEN_MAINTENANCE_STATUSES.includes(m.status) &&
      String(m.assignedTechnicianId) === String(userId)
    ) ?? null;
  }

  /** "Report a Problem" opens the maintenance creation form — a Manager+ action, matching who can actually create work orders. */
  canReportProblem(): boolean {
    const user = this.authService.getCurrentUser();
    const roles = (user?.roles ?? []).map((r) => normalizeRoleName(r.name));
    return roles.some(r => MANAGER_ROLES.includes(r));
  }

  reportProblemState(): { prefill: { machineId: number } } {
    return { prefill: { machineId: this.passport()!.machine.id } };
  }
}

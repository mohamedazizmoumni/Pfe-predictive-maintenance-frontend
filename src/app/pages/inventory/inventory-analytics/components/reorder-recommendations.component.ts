import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ReorderRecommendation } from '../inventory-analytics.types';
import { EmptyStateComponent } from './empty-state.component';
import { InventoryService } from '../../../../core/services/inventory.service';
import { AuthService } from '../../../../core/services/auth.service';

type RequestStatus = 'idle' | 'pending' | 'done' | 'error';

@Component({
  selector: 'app-reorder-recommendations',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, EmptyStateComponent],
  template: `
    <section class="reco-panel">
      <header class="reco-panel__header">
        <div>
          <h3>Reorder Recommendations</h3>
          <p>Ranked by urgency — one click creates a purchase request</p>
        </div>
      </header>

      <div class="reco-grid" *ngIf="recommendations.length; else emptyBlock">
        <article class="reco-card" *ngFor="let reco of recommendations">
          <div class="reco-card__top">
            <span class="reco-card__icon"><lucide-icon name="PackagePlus" [size]="18"></lucide-icon></span>
            <span class="reco-card__confidence"><lucide-icon name="Sparkles" [size]="12"></lucide-icon>{{ reco.confidence }}%</span>
          </div>

          <h4>{{ reco.partName }}</h4>
          <p class="reco-card__sku">{{ reco.partNumber }}</p>

          <div class="reco-card__stats">
            <div><span>Current</span><strong>{{ reco.currentStock }}</strong></div>
            <div><span>Recommended</span><strong>{{ reco.recommendedQuantity }}</strong></div>
            <div><span>Cost est.</span><strong>{{ reco.costEstimate | currency:'TND':'symbol':'1.0-0' }}</strong></div>
            <div><span>Lead time</span><strong>{{ reco.leadTimeDays }}d</strong></div>
          </div>

          <p class="reco-card__reason"><lucide-icon name="Truck" [size]="13"></lucide-icon> {{ reco.supplier }} — {{ reco.reason }}</p>

          <button
            type="button"
            class="reco-card__action"
            [class.reco-card__action--done]="status(reco.partId) === 'done'"
            [class.reco-card__action--error]="status(reco.partId) === 'error'"
            [disabled]="status(reco.partId) === 'pending' || status(reco.partId) === 'done'"
            (click)="create(reco)"
          >
            <ng-container [ngSwitch]="status(reco.partId)">
              <ng-container *ngSwitchCase="'pending'">Creating…</ng-container>
              <ng-container *ngSwitchCase="'done'"><lucide-icon name="CircleCheck" [size]="15"></lucide-icon> Request created</ng-container>
              <ng-container *ngSwitchCase="'error'"><lucide-icon name="TriangleAlert" [size]="15"></lucide-icon> Retry request</ng-container>
              <ng-container *ngSwitchDefault><lucide-icon name="Plus" [size]="15"></lucide-icon> Create Purchase Request</ng-container>
            </ng-container>
          </button>
        </article>
      </div>

      <ng-template #emptyBlock>
        <app-empty-state
          title="No reorders recommended"
          message="Every tracked part is currently above its minimum threshold."
          accentColor="#22C55E"
        ></app-empty-state>
      </ng-template>
    </section>
  `,
  styles: [`
    .reco-panel {
      background: var(--ia-surface);
      border: 1px solid var(--ia-border);
      border-radius: var(--ia-radius-lg);
      padding: 1.5rem;
      box-shadow: var(--ia-shadow-sm);
    }

    .reco-panel__header {
      margin-bottom: 1.25rem;
    }

    .reco-panel__header h3 {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 700;
      color: var(--ia-text-primary);
    }

    .reco-panel__header p {
      margin: 0.2rem 0 0;
      font-size: 0.8rem;
      color: var(--ia-text-secondary);
    }

    .reco-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 1rem;
    }

    .reco-card {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      padding: 1.1rem;
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.025);
      border: 1px solid var(--ia-border);
      transition: border-color 0.2s ease, transform 0.2s ease;
    }

    .reco-card:hover {
      border-color: var(--ia-border-strong);
      transform: translateY(-2px);
    }

    .reco-card__top {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .reco-card__icon {
      width: 34px;
      height: 34px;
      border-radius: 10px;
      background: rgba(59, 130, 246, 0.16);
      color: #93c5fd;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .reco-card__confidence {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      font-size: 0.72rem;
      font-weight: 800;
      color: #c4b5fd;
      background: rgba(139, 92, 246, 0.16);
      padding: 0.25rem 0.55rem;
      border-radius: 999px;
    }

    .reco-card h4 {
      margin: 0.1rem 0 0;
      font-size: 0.95rem;
      font-weight: 700;
      color: var(--ia-text-primary);
    }

    .reco-card__sku {
      margin: 0;
      font-size: 0.72rem;
      color: var(--ia-text-muted);
    }

    .reco-card__stats {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0.6rem;
      margin: 0.35rem 0;
      padding: 0.7rem 0;
      border-top: 1px solid var(--ia-border);
      border-bottom: 1px solid var(--ia-border);
    }

    .reco-card__stats div {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }

    .reco-card__stats span {
      font-size: 0.68rem;
      color: var(--ia-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .reco-card__stats strong {
      font-size: 0.9rem;
      color: var(--ia-text-primary);
      font-weight: 700;
    }

    .reco-card__reason {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      margin: 0;
      font-size: 0.76rem;
      color: var(--ia-text-secondary);
      line-height: 1.4;
    }

    .reco-card__action {
      margin-top: 0.4rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      border: none;
      border-radius: 10px;
      padding: 0.65rem 1rem;
      font-size: 0.8rem;
      font-weight: 700;
      cursor: pointer;
      background: var(--ia-info);
      color: #fff;
      transition: all 0.15s ease;
    }

    .reco-card__action:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 8px 20px rgba(59, 130, 246, 0.35);
    }

    .reco-card__action:disabled {
      cursor: default;
      opacity: 0.85;
    }

    .reco-card__action--done {
      background: rgba(34, 197, 94, 0.16);
      color: #86efac;
    }

    .reco-card__action--error {
      background: rgba(239, 68, 68, 0.16);
      color: #fca5a5;
    }
  `],
})
export class ReorderRecommendationsComponent {
  @Input() recommendations: ReorderRecommendation[] = [];
  @Output() created = new EventEmitter<ReorderRecommendation>();

  private statusMap = new Map<number, RequestStatus>();

  constructor(
    private inventoryService: InventoryService,
    private authService: AuthService,
  ) {}

  status(partId: number): RequestStatus {
    return this.statusMap.get(partId) ?? 'idle';
  }

  create(reco: ReorderRecommendation): void {
    const current = this.status(reco.partId);
    if (current === 'pending' || current === 'done') {
      return;
    }

    this.statusMap.set(reco.partId, 'pending');
    const user = this.authService.getCurrentUser();

    this.inventoryService.requestReorder({
      partId: reco.partId,
      quantity: reco.recommendedQuantity,
      reason: reco.reason,
      notes: `Created from Inventory Analytics reorder recommendations (AI confidence ${reco.confidence}%).`,
      requestedBy: user?.username,
    }).subscribe({
      next: () => {
        this.statusMap.set(reco.partId, 'done');
        this.created.emit(reco);
      },
      error: () => {
        this.statusMap.set(reco.partId, 'error');
      },
    });
  }
}

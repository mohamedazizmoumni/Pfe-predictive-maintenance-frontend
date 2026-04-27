import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  signal,
} from '@angular/core';
import { DecimalPipe, NgIf } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { finalize } from 'rxjs/operators';
import {
  Machine,
  MaintenanceRecommendationDTO,
  RecommendationRequestDTO,
} from '../../core/models';
import { RecommendationService } from '../../core/services/recommendation.service';
import { MachineService } from '../../core/services/machine.service';
import { NotificationService } from '../../core/services/notification.service';
import { RecommendationCardComponent } from '../../components/recommendation-card/recommendation-card.component';
import { CostComparisonComponent } from '../../components/cost-comparison/cost-comparison.component';

@Component({
  selector: 'app-recommendation-page',
  standalone: true,
  imports: [
    RecommendationCardComponent,
    CostComparisonComponent,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    ReactiveFormsModule,
    RouterLink,
    NgIf,
    DecimalPipe,
  ],
  templateUrl: './recommendation.page.html',
  styleUrl: './recommendation.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecommendationPage implements OnInit {
  readonly machineId = signal<number | null>(null);
  readonly machine = signal<Machine | null>(null);
  readonly recommendation = signal<MaintenanceRecommendationDTO | null>(null);
  readonly loading = signal(false);

  readonly form = this.fb.nonNullable.group({
    failureProbability: [0.75, [Validators.min(0), Validators.max(1)]],
    daysUntilPredictedFailure: [5, [Validators.min(0)]],
  });

  constructor(
    private readonly route: ActivatedRoute,
    private readonly recommendationService: RecommendationService,
    private readonly machineService: MachineService,
    private readonly notificationService: NotificationService,
    private readonly fb: FormBuilder
  ) {}

  ngOnInit(): void {
    const rawId = this.route.snapshot.paramMap.get('machineId');
    const id = rawId ? Number(rawId) : NaN;

    if (Number.isNaN(id)) {
      this.notificationService.error('Failed to load recommendation');
      return;
    }

    this.machineId.set(id);

    this.machineService.getById(id).subscribe({
      next: (machine) => this.machine.set(machine),
      error: () => this.notificationService.error('Failed to load recommendation'),
    });

    this.loadRecommendation();
  }

  loadRecommendation(): void {
    const id = this.machineId();
    if (id === null || this.form.invalid) {
      return;
    }

    const payload: RecommendationRequestDTO = {
      machineId: id,
      failureProbability: this.form.getRawValue().failureProbability,
      daysUntilPredictedFailure: this.form.getRawValue().daysUntilPredictedFailure,
      requiredPartIds: [],
    };

    this.loading.set(true);
    this.recommendationService
      .generate(payload)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (rec) => this.recommendation.set(rec),
        error: () => this.notificationService.error('Failed to load recommendation'),
      });
  }
}

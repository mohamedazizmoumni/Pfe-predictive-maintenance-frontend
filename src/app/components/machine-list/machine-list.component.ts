import { ChangeDetectionStrategy, Component, OnInit, signal } from '@angular/core';
import { AsyncPipe, DecimalPipe, NgIf, TitleCasePipe } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Observable, catchError, finalize, of } from 'rxjs';
import { Machine } from '../../core/models/machine.model';
import { MachineService } from '../../core/services/machine.service';
import { NotificationService } from '../../core/services/notification.service';
import { UrgencyBadgeComponent } from '../../shared/urgency-badge/urgency-badge.component';

@Component({
  selector: 'app-machine-list',
  standalone: true,
  imports: [
    AsyncPipe,
    DecimalPipe,
    NgIf,
    TitleCasePipe,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    UrgencyBadgeComponent,
    RouterModule,
  ],
  templateUrl: './machine-list.component.html',
  styleUrl: './machine-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MachineListComponent implements OnInit {
  readonly columns = ['name', 'location', 'status', 'criticality', 'hourlyValue', 'actions'];

  machines$!: Observable<Machine[]>;
  readonly loading = signal(false);

  constructor(
    private readonly machineService: MachineService,
    private readonly notificationService: NotificationService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.loading.set(true);
    this.machines$ = this.machineService.getAll().pipe(
      catchError(() => {
        this.notificationService.error('Failed to load machines');
        return of([]);
      }),
      finalize(() => this.loading.set(false))
    );
  }

  viewRecommendation(id?: number): void {
    if (id === undefined || id === null) {
      return;
    }

    this.router.navigate(['/recommendations', id]);
  }
}

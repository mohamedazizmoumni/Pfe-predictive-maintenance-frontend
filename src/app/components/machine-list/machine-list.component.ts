import { ChangeDetectionStrategy, Component, OnInit, signal } from '@angular/core';
import { AsyncPipe, DecimalPipe, NgIf, TitleCasePipe } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Observable, catchError, finalize, of } from 'rxjs';
import { Machine } from '../../core/models/machine.model';
import { MachineContextService } from '../../core/services/machine-context.service';
import { MachineService } from '../../core/services/machine.service';
import { NotificationService } from '../../core/services/notification.service';

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
    RouterModule,
  ],
  templateUrl: './machine-list.component.html',
  styleUrl: './machine-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MachineListComponent implements OnInit {
  readonly columns = ['name', 'model', 'location', 'status', 'risk', 'actions'];

  machines$!: Observable<Machine[]>;
  readonly loading = signal(false);

  constructor(
    private readonly machineService: MachineService,
    private readonly notificationService: NotificationService,
    private readonly router: Router,
    private readonly machineContextService: MachineContextService
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

  useForAssistant(machine: Machine): void {
    this.machineContextService.setMachine(machine);
    this.router.navigate(['/ai-assistant']);
  }
}

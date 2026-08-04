import { ChangeDetectionStrategy, Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';
import { ActiveConfirmRequest, ConfirmDialogService } from '../../core/services/confirm-dialog.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, A11yModule],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialogComponent {
  readonly current$ = this.confirmDialogService.current$;

  constructor(private readonly confirmDialogService: ConfirmDialogService) {}

  confirm(request: ActiveConfirmRequest): void {
    request.resolve(true);
  }

  dismiss(): void {
    this.confirmDialogService.dismissCurrent();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.dismiss();
  }
}

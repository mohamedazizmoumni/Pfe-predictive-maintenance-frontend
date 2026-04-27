import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-toast-stack',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast-stack.component.html',
  styleUrl: './toast-stack.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastStackComponent {
  readonly toasts$ = this.toastService.toasts$;

  constructor(private readonly toastService: ToastService) {}

  dismiss(id: number): void {
    this.toastService.dismiss(id);
  }

  trackById(_: number, toast: { id: number }): number {
    return toast.id;
  }
}

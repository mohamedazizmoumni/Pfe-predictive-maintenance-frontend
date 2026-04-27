import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: number;
  message: string;
  type: ToastType;
}

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  private readonly toastsSubject = new BehaviorSubject<ToastMessage[]>([]);
  private nextId = 0;

  readonly toasts$ = this.toastsSubject.asObservable();

  show(message: string, type: ToastType = 'info', durationMs = 3500): void {
    this.nextId += 1;
    const toast: ToastMessage = {
      id: this.nextId,
      message,
      type,
    };

    this.toastsSubject.next([...this.toastsSubject.value, toast]);

    if (durationMs > 0 && typeof window !== 'undefined') {
      window.setTimeout(() => this.dismiss(toast.id), durationMs);
    }
  }

  success(message: string, durationMs = 3000): void {
    this.show(message, 'success', durationMs);
  }

  error(message: string, durationMs = 4500): void {
    this.show(message, 'error', durationMs);
  }

  info(message: string, durationMs = 3500): void {
    this.show(message, 'info', durationMs);
  }

  dismiss(id: number): void {
    this.toastsSubject.next(this.toastsSubject.value.filter((toast) => toast.id !== id));
  }
}

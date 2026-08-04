import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ConfirmTone = 'default' | 'danger';

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
}

export interface ActiveConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  tone: ConfirmTone;
  resolve: (confirmed: boolean) => void;
}

/**
 * Single shared confirmation dialog for the whole app. Replaces native
 * window.confirm()/window.prompt() calls and the many bespoke inline
 * "are you sure" modals that had accumulated per-page, none of which
 * consistently trapped focus or closed on Escape.
 *
 * Usage:
 *   const ok = await this.confirmDialog.confirmDanger('Delete part', 'This cannot be undone.');
 *   if (!ok) return;
 *   this.partsService.delete(id).subscribe(...);
 */
@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private readonly currentSubject = new BehaviorSubject<ActiveConfirmRequest | null>(null);
  readonly current$ = this.currentSubject.asObservable();

  /** Opens the shared confirmation dialog; resolves with the user's choice. */
  confirm(options: ConfirmDialogOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.currentSubject.next({
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel ?? 'Confirm',
        cancelLabel: options.cancelLabel ?? 'Cancel',
        tone: options.tone ?? 'default',
        resolve: (confirmed: boolean) => {
          this.currentSubject.next(null);
          resolve(confirmed);
        },
      });
    });
  }

  /** Convenience wrapper for irreversible actions (delete, cancel, unassign…). */
  confirmDanger(title: string, message: string, confirmLabel = 'Delete'): Promise<boolean> {
    return this.confirm({ title, message, confirmLabel, tone: 'danger' });
  }

  /** Dismisses whatever is open (Escape / backdrop click), resolving false. */
  dismissCurrent(): void {
    this.currentSubject.value?.resolve(false);
  }
}

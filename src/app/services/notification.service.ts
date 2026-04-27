import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  constructor(private snackBar: MatSnackBar) {}

  success(message: string, duration = 3000): void {
    this.snackBar.open(message, 'Close', {
      duration,
      panelClass: ['snackbar-success'],
      horizontalPosition: 'right',
      verticalPosition: 'top',
    });
  }

  error(message: string, duration = 5000): void {
    this.snackBar.open(message, 'Close', {
      duration,
      panelClass: ['snackbar-error'],
      horizontalPosition: 'right',
      verticalPosition: 'top',
    });
  }

  info(message: string, duration = 3500): void {
    this.snackBar.open(message, 'Close', {
      duration,
      panelClass: ['snackbar-info'],
      horizontalPosition: 'right',
      verticalPosition: 'top',
    });
  }
}

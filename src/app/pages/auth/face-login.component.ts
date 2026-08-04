import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { LoginResponse } from '../../core/models/sentinel.models';
import { DashboardRoutingService } from '../../pages/dashboards/dashboard-routing.service';
import { FaceScanPanelComponent } from './face-scan-panel/face-scan-panel.component';

@Component({
  selector: 'app-face-login',
  standalone: true,
  imports: [CommonModule, RouterLink, FaceScanPanelComponent],
  templateUrl: './face-login.component.html',
  styleUrl: './face-login.component.scss',
})
export class FaceLoginComponent {
  isLoading = false;
  errorMessage = '';
  recognizedResponse: LoginResponse | null = null;

  constructor(
    private authService: AuthService,
    private router: Router,
    private dashboardRoutingService: DashboardRoutingService
  ) {}

  onAuthenticate(file: File): void {
    this.isLoading = true;
    this.errorMessage = '';

    const formData = new FormData();
    formData.append('file', file, file.name);

    this.authService.faceLogin(formData).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.recognizedResponse = response;
      },
      error: (error: any) => {
        this.isLoading = false;
        this.errorMessage = this.resolveApiErrorMessage(
          error,
          'Face not recognized. Please retry with a clearer image.'
        );
      },
    });
  }

  onContinue(): void {
    if (!this.recognizedResponse) {
      return;
    }
    this.router.navigate([this.dashboardRoutingService.getRouteForLoginResponse(this.recognizedResponse)]);
  }

  onBackToLogin(): void {
    this.router.navigate(['/auth/login']);
  }

  private resolveApiErrorMessage(error: any, fallback: string): string {
    const apiError = error?.error;
    if (!apiError) {
      return fallback;
    }

    if (typeof apiError === 'string' && apiError.trim()) {
      return apiError;
    }

    if (typeof apiError?.message === 'string' && apiError.message.trim()) {
      return apiError.message;
    }

    // The auth backend (as opposed to the ML face-recognition service) returns
    // { "error": "..." } — e.g. "This account has been blocked" — under this key.
    if (typeof apiError?.error === 'string' && apiError.error.trim()) {
      return apiError.error;
    }

    if (typeof apiError?.detail === 'string' && apiError.detail.trim()) {
      return apiError.detail;
    }

    if (Array.isArray(apiError?.detail) && apiError.detail.length > 0) {
      const first = apiError.detail[0];
      if (typeof first?.msg === 'string' && first.msg.trim()) {
        return first.msg;
      }
    }

    return fallback;
  }
}

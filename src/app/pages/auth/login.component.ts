import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService, LoginPayload } from '../../core/services/auth.service';
import { LoginResponse } from '../../core/models/sentinel.models';
import { DashboardRoutingService } from '../../pages/dashboards/dashboard-routing.service';
import { normalizeApiError } from '../../core/http/api-error';
import { FaceScanPanelComponent } from './face-scan-panel/face-scan-panel.component';
import { environment } from '../../../environments/environment';

export type LoginStep = 'face' | 'credentials';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, LucideAngularModule, FaceScanPanelComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit {
  // Marketing site (home/features/contact/…) is a separately deployed
  // project, so this is a plain external link rather than a routerLink.
  readonly contactUrl = `${environment.marketingUrl}/contact`;

  // Accounts are admin-provisioned only — there is no self-service reset,
  // so "Forgot password?" just reveals a contact-admin hint instead of
  // routing anywhere.
  showForgotPasswordHint = false;

  // Face recognition is attempted first; username/password is the fallback.
  currentStep: LoginStep = 'face';

  // ── Face step ──────────────────────────────────────────
  faceRecognizedResponse: LoginResponse | null = null;

  // ── Credentials step (fallback) ─────────────────────────
  loginForm!: FormGroup;
  hidePassword = true;

  // ── Shared state ───────────────────────────────────────
  isLoading = false;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private dashboardRoutingService: DashboardRoutingService
  ) {}

  ngOnInit(): void {
    this.loginForm = this.fb.group({
      username: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(4)]],
      rememberMe: [false],
    });
  }

  // ── Step 1: Face Recognition ────────────────────────────

  onFaceAuthenticate(file: File): void {
    this.isLoading = true;
    this.errorMessage = '';

    const formData = new FormData();
    formData.append('file', file, file.name);

    this.authService.faceLogin(formData).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.faceRecognizedResponse = response;
      },
      error: (error: any) => {
        this.isLoading = false;
        this.errorMessage = normalizeApiError(
          error,
          'Face not recognized. Please try again or sign in with your username and password.'
        ).message;
      },
    });
  }

  onFaceContinue(): void {
    if (!this.faceRecognizedResponse) {
      return;
    }
    const route = this.dashboardRoutingService.getRouteForLoginResponse(this.faceRecognizedResponse);
    this.router.navigate([route]);
  }

  /** Face recognition failed (or the user prefers not to use it) — fall back to credentials. */
  useCredentialsInstead(): void {
    this.faceRecognizedResponse = null;
    this.errorMessage = '';
    this.currentStep = 'credentials';
  }

  // ── Step 2: Credentials (fallback) ─────────────────────

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const credentials: LoginPayload = {
      username: this.loginForm.value.username.trim(),
      password: this.loginForm.value.password,
    };

    this.authService.login(credentials).subscribe({
      next: (response) => {
        this.isLoading = false;
        // Password login is a complete sign-in on its own — no follow-up face step.
        const route = this.dashboardRoutingService.getRouteForLoginResponse(response);
        this.router.navigate([route]);
      },
      error: (error: any) => {
        this.isLoading = false;
        this.errorMessage = normalizeApiError(
          error,
          'Login failed. Please check your credentials.'
        ).message;
      },
    });
  }

  togglePassword(): void {
    this.hidePassword = !this.hidePassword;
  }

  toggleForgotPasswordHint(): void {
    this.showForgotPasswordHint = !this.showForgotPasswordHint;
  }

  get passwordType(): string {
    return this.hidePassword ? 'password' : 'text';
  }

  /** Give the user a way back to face recognition from the credentials fallback. */
  backToFace(): void {
    this.errorMessage = '';
    this.currentStep = 'face';
  }
}

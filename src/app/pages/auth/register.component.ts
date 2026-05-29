import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { DashboardRoutingService } from '../../pages/dashboards/dashboard-routing.service';

interface StepConfig {
  label: string;
  description: string;
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent implements OnInit {
  @ViewChild('cameraVideo') cameraVideo?: ElementRef<HTMLVideoElement>;
  @ViewChild('faceCanvas') faceCanvas?: ElementRef<HTMLCanvasElement>;

  registerForm!: FormGroup;
  steps: StepConfig[] = [
    { label: 'Account Setup', description: 'Credentials & access' },
    { label: 'Profile Details', description: 'Identity & org' },
    { label: 'Confirmation', description: 'Review & confirm' },
  ];
  currentStep = 0;
  isLoading = false;
  errorMessage = '';
  hidePassword = true;
  hideConfirmPassword = true;
  selectedFile: File | null = null;
  previewImageUrl: string | null = null;
  cameraReady = false;
  isStartingCamera = false;

  private cameraStream: MediaStream | null = null;

  private stepFields: string[][] = [
    ['username', 'email', 'password', 'confirmPassword'],
    ['firstName', 'lastName', 'department'],
    ['terms'],
  ];

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private dashboardRoutingService: DashboardRoutingService
  ) {}

  ngOnInit(): void {
    this.initializeForm();
  }

  ngOnDestroy(): void {
    this.stopCamera();
    this.clearPreviewUrl();
  }

  get stepProgress(): number {
    return ((this.currentStep + 1) / this.steps.length) * 100;
  }

  togglePasswordVisibility(target: 'primary' | 'confirm'): void {
    if (target === 'primary') {
      this.hidePassword = !this.hidePassword;
      return;
    }
    this.hideConfirmPassword = !this.hideConfirmPassword;
  }

  goToNextStep(): void {
    if (!this.isStepValid(this.currentStep)) {
      this.markStepControlsAsTouched(this.currentStep);
      return;
    }

    if (this.currentStep < this.steps.length - 1) {
      this.currentStep += 1;
    }
  }

  goToPreviousStep(): void {
    if (this.currentStep > 0) {
      this.currentStep -= 1;
    }
  }

  onSubmit(): void {
    if (this.registerForm.invalid) {
      this.markStepControlsAsTouched(this.currentStep);
      this.currentStep = this.steps.length - 1;
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    if (!this.selectedFile) {
      this.isLoading = false;
      this.errorMessage = 'Please upload your face photo before signing up.';
      return;
    }

    const { email, password, username, firstName, lastName, department } = this.registerForm.value;
    const formData = new FormData();
    formData.append('email', email);
    formData.append('password', password);
    formData.append('file', this.selectedFile);
    formData.append('username', username || '');
    formData.append('firstName', firstName || '');
    formData.append('lastName', lastName || '');
    formData.append('department', department || '');

    this.authService.signupWithFace(formData).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.router.navigate([this.dashboardRoutingService.getRouteForLoginResponse(response)]);
      },
      error: (error: any) => {
        this.isLoading = false;
        this.errorMessage = this.resolveApiErrorMessage(error, 'Registration failed. Please try again.');
      },
    });
  }

  onFileSelected(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0] ?? null;

    if (!file) {
      this.selectedFile = null;
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.selectedFile = null;
      this.errorMessage = 'Only image files are allowed.';
      return;
    }

    this.stopCamera();
    this.clearPreviewUrl();
    this.selectedFile = file;
    this.previewImageUrl = URL.createObjectURL(file);
    this.errorMessage = '';
  }

  async startCamera(): Promise<void> {
    if (this.isStartingCamera) {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      this.errorMessage = 'Camera is not supported in this browser.';
      return;
    }

    this.isStartingCamera = true;
    this.errorMessage = '';

    try {
      this.stopCamera();
      this.cameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      const video = this.cameraVideo?.nativeElement;
      if (!video) {
        this.errorMessage = 'Camera preview is unavailable.';
        this.stopCamera();
        return;
      }

      video.srcObject = this.cameraStream;
      await video.play();
      this.cameraReady = true;
    } catch {
      this.errorMessage = 'Unable to access camera. Please allow permission or upload a photo.';
      this.cameraReady = false;
      this.stopCamera();
    } finally {
      this.isStartingCamera = false;
    }
  }

  capturePhoto(): void {
    const video = this.cameraVideo?.nativeElement;
    const canvas = this.faceCanvas?.nativeElement;

    if (!video || !canvas || !this.cameraReady) {
      this.errorMessage = 'Camera is not ready. Please start camera first.';
      return;
    }

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const context = canvas.getContext('2d');
    if (!context) {
      this.errorMessage = 'Failed to capture photo from camera.';
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          this.errorMessage = 'Photo capture failed. Please retry.';
          return;
        }

        this.clearPreviewUrl();
        this.selectedFile = new File([blob], 'face-photo.jpg', { type: 'image/jpeg' });
        this.previewImageUrl = URL.createObjectURL(blob);
        this.errorMessage = '';
      },
      'image/jpeg',
      0.92
    );
  }

  stopCamera(): void {
    this.cameraStream?.getTracks().forEach((track) => track.stop());
    this.cameraStream = null;
    this.cameraReady = false;

    const video = this.cameraVideo?.nativeElement;
    if (video) {
      video.srcObject = null;
    }
  }

  private clearPreviewUrl(): void {
    if (this.previewImageUrl) {
      URL.revokeObjectURL(this.previewImageUrl);
      this.previewImageUrl = null;
    }
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

  shouldShowControlError(controlName: string): boolean {
    const control = this.registerForm.get(controlName);
    if (!control) {
      return false;
    }

    if (
      controlName === 'confirmPassword' &&
      this.registerForm.errors?.['passwordMismatch'] &&
      control.touched
    ) {
      return true;
    }

    return control.invalid && (control.dirty || control.touched);
  }

  getControlMessage(controlName: string): string {
    const control = this.registerForm.get(controlName);
    if (!control) {
      return '';
    }

    if (
      controlName === 'confirmPassword' &&
      this.registerForm.errors?.['passwordMismatch'] &&
      control.touched
    ) {
      return 'Passwords do not match';
    }

    if (control.errors?.['required']) {
      return 'This field is required';
    }

    if (control.errors?.['requiredTrue']) {
      return 'You must agree to continue';
    }

    if (control.errors?.['email']) {
      return 'Enter a valid email address';
    }

    if (control.errors?.['minlength']) {
      return `Minimum ${control.errors['minlength'].requiredLength} characters`;
    }

    if (control.errors?.['maxlength']) {
      return `Maximum ${control.errors['maxlength'].requiredLength} characters`;
    }

    return 'Invalid value';
  }

  isLastStep(): boolean {
    return this.currentStep === this.steps.length - 1;
  }

  private initializeForm(): void {
    this.registerForm = this.fb.group(
      {
        username: [
          '',
          [Validators.required, Validators.minLength(3), Validators.maxLength(50)],
        ],
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, Validators.minLength(6)]],
        confirmPassword: ['', [Validators.required]],
        firstName: ['', [Validators.required]],
        lastName: ['', [Validators.required]],
        department: [''],
        terms: [false, [Validators.requiredTrue]],
        updates: [true],
      },
      { validators: this.passwordsMatchValidator }
    );
  }

  private passwordsMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;

    if (!password || !confirmPassword) {
      return null;
    }

    return password === confirmPassword ? null : { passwordMismatch: true };
  }

  private isStepValid(index: number): boolean {
    const controls = this.stepFields[index] ?? [];
    return controls.every((name) => this.registerForm.get(name)?.valid);
  }

  private markStepControlsAsTouched(index: number): void {
    const controls = this.stepFields[index] ?? [];
    controls.forEach((name) => this.registerForm.get(name)?.markAsTouched());
  }
}
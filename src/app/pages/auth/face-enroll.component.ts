import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { DashboardRoutingService } from '../dashboards/dashboard-routing.service';

@Component({
  selector: 'app-face-enroll',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './face-enroll.component.html',
  styleUrl: './face-enroll.component.scss',
})
export class FaceEnrollComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('videoEl') videoEl?: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasEl') canvasEl?: ElementRef<HTMLCanvasElement>;

  cameraReady = false;
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  alreadyEnrolled = false;
  capturedPreviewUrl: string | null = null;
  enrolledProfilePicUrl: string | null = null;

  private stream: MediaStream | null = null;
  capturedFile: File | null = null;

  // Current user info for display
  username = '';
  displayName = '';

  constructor(
    private authService: AuthService,
    private router: Router,
    private dashboardRoutingService: DashboardRoutingService
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (!user) {
      // Not authenticated — go back to login
      this.router.navigate(['/auth/login']);
      return;
    }
    this.username = user.username;
    this.displayName = user.displayName || user.firstName || user.username;
  }

  ngAfterViewInit(): void {
    this.startCamera();
  }

  ngOnDestroy(): void {
    this.stopCamera();
    this.revokePreview();
  }

  // ── Camera ────────────────────────────────────────────

  async startCamera(): Promise<void> {
    if (!this.isBrowser() || !navigator.mediaDevices?.getUserMedia) {
      this.errorMessage = 'Camera not supported in this browser.';
      return;
    }

    try {
      this.errorMessage = '';
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });

      const video = this.videoEl?.nativeElement;
      if (video) {
        video.srcObject = this.stream;
        await video.play();
        this.cameraReady = true;
      }
    } catch {
      this.cameraReady = false;
      this.errorMessage =
        'Unable to access camera. Please allow camera permission and try again.';
    }
  }

  captureFrame(): void {
    const video = this.videoEl?.nativeElement;
    const canvas = this.canvasEl?.nativeElement;

    if (!video || !canvas || !this.cameraReady) {
      this.errorMessage = 'Camera is not ready. Please wait a moment.';
      return;
    }

    this.errorMessage = '';
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    if (!ctx) { this.errorMessage = 'Could not capture image.'; return; }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) { this.errorMessage = 'Capture failed. Please try again.'; return; }
        this.revokePreview();
        this.capturedFile = new File([blob], 'face-enroll.jpg', { type: 'image/jpeg' });
        this.capturedPreviewUrl = URL.createObjectURL(blob);
      },
      'image/jpeg',
      0.92
    );
  }

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.errorMessage = 'Please select a valid image file.';
      return;
    }
    this.errorMessage = '';
    this.revokePreview();
    this.capturedFile = file;
    this.capturedPreviewUrl = URL.createObjectURL(file);
  }

  retryCapture(): void {
    this.capturedFile = null;
    this.revokePreview();
    this.errorMessage = '';
    this.successMessage = '';
  }

  // ── Enrollment ────────────────────────────────────────

  enroll(): void {
    if (!this.capturedFile) {
      this.errorMessage = 'Please capture or upload a face image first.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const formData = new FormData();
    formData.append('file', this.capturedFile, this.capturedFile.name);

    this.authService.faceEnroll(formData).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.successMessage = 'Face enrolled successfully! Redirecting to your dashboard…';
        this.stopCamera();

        // Use the returned profile picture URL if provided
        this.enrolledProfilePicUrl =
          response?.profilePictureUrl ?? this.capturedPreviewUrl;

        // Navigate to dashboard after a short delay so the user sees the success state
        setTimeout(() => {
          const user = this.authService.getCurrentUser();
          const route = this.dashboardRoutingService.getDashboardRouteForCurrentUser(user);
          this.router.navigate([route]);
        }, 1800);
      },
      error: (error: any) => {
        this.isLoading = false;
        if (error?.status === 409) {
          // Retrying will always 409 again — this isn't a capture-quality
          // problem, the account already has a face enrolled and only an
          // admin can reset it. Stop the camera and show a distinct state
          // instead of implying "try again" will help.
          this.alreadyEnrolled = true;
          this.stopCamera();
          this.errorMessage = this.resolveError(
            error,
            'You already have a face enrolled on this account. Ask an administrator to reset it before capturing a new one.'
          );
          return;
        }
        this.errorMessage = this.resolveError(
          error,
          'Enrollment failed. Make sure your face is clearly visible and try again.'
        );
      },
    });
  }

  goToDashboard(): void {
    const user = this.authService.getCurrentUser();
    const route = this.dashboardRoutingService.getDashboardRouteForCurrentUser(user);
    this.router.navigate([route]);
  }

  // ── Helpers ───────────────────────────────────────────

  private stopCamera(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.cameraReady = false;
  }

  private revokePreview(): void {
    if (this.capturedPreviewUrl && !this.enrolledProfilePicUrl) {
      URL.revokeObjectURL(this.capturedPreviewUrl);
    }
    this.capturedPreviewUrl = null;
  }

  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof navigator !== 'undefined';
  }

  private resolveError(error: any, fallback: string): string {
    const e = error?.error;
    if (!e) return fallback;
    if (typeof e === 'string' && e.trim()) return e;
    // Backend uses different keys in different places: "error" for the
    // face-enroll 409 (already enrolled), "message"/"detail" elsewhere.
    if (typeof e?.error === 'string' && e.error.trim()) return e.error;
    if (typeof e?.message === 'string' && e.message.trim()) return e.message;
    if (typeof e?.detail === 'string' && e.detail.trim()) return e.detail;
    return fallback;
  }
}

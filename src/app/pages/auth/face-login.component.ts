import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-face-login',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './face-login.component.html',
  styleUrl: './face-login.component.scss',
})
export class FaceLoginComponent implements AfterViewInit, OnDestroy {
  @ViewChild('videoElement') videoElement?: ElementRef<HTMLVideoElement>;
  @ViewChild('captureCanvas') captureCanvas?: ElementRef<HTMLCanvasElement>;

  isLoading = false;
  errorMessage = '';
  cameraReady = false;
  capturedPreviewUrl: string | null = null;

  private stream: MediaStream | null = null;
  private imageFile: File | null = null;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngAfterViewInit(): void {
    this.startCamera();
  }

  ngOnDestroy(): void {
    this.stopCamera();
    this.revokePreviewUrl();
  }

  async startCamera(): Promise<void> {
    if (!this.isBrowser()) {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      this.errorMessage = 'Camera is not supported in this browser. Use file upload fallback.';
      this.cameraReady = false;
      return;
    }

    try {
      this.errorMessage = '';
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      const video = this.videoElement?.nativeElement;
      if (video) {
        video.srcObject = this.stream;
        await video.play();
        this.cameraReady = true;
      }
    } catch (error) {
      this.cameraReady = false;
      this.errorMessage = 'Unable to access camera. Please allow permission or use file upload.';
    }
  }

  captureFace(): void {
    const video = this.videoElement?.nativeElement;
    const canvas = this.captureCanvas?.nativeElement;

    if (!video || !canvas || !this.cameraReady) {
      this.errorMessage = 'Camera is not ready yet.';
      return;
    }

    this.errorMessage = '';
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const context = canvas.getContext('2d');
    if (!context) {
      this.errorMessage = 'Could not capture image from camera.';
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          this.errorMessage = 'Capture failed. Please try again.';
          return;
        }

        this.revokePreviewUrl();
        this.imageFile = new File([blob], 'face-capture.jpg', { type: 'image/jpeg' });
        this.capturedPreviewUrl = URL.createObjectURL(blob);
      },
      'image/jpeg',
      0.92
    );
  }

  onFileSelected(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.errorMessage = 'Please upload a valid image file.';
      return;
    }

    this.errorMessage = '';
    this.revokePreviewUrl();
    this.imageFile = file;
    this.capturedPreviewUrl = URL.createObjectURL(file);
  }

  loginWithFace(): void {
    if (!this.imageFile) {
      this.errorMessage = 'Capture a face image or upload a file first.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const formData = new FormData();
    formData.append('file', this.imageFile, this.imageFile.name);

    this.authService.faceLogin(formData).subscribe({
      next: () => {
        this.isLoading = false;
        this.router.navigate(['/dashboard']);
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

  private stopCamera(): void {
    if (!this.stream) {
      return;
    }

    this.stream.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.cameraReady = false;
  }

  private revokePreviewUrl(): void {
    if (this.capturedPreviewUrl) {
      URL.revokeObjectURL(this.capturedPreviewUrl);
      this.capturedPreviewUrl = null;
    }
  }

  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof navigator !== 'undefined';
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
}

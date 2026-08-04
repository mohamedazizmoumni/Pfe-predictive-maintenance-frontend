import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Inject,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  PLATFORM_ID,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { LoginResponse } from '../../../core/models/sentinel.models';

const AUTO_CONTINUE_DELAY_MS = 1400;

// Self-contained face-scanning widget: owns the camera stream. Capture is
// manual — a "Capture Photo" button the user clicks when THEY'RE ready,
// rather than a blind fixed-interval auto-snapshot (the previous 2.5s timer
// gave people too little control over framing/lighting before a frame got
// sent off and frequently failed to match). The parent owns the actual auth
// API call — it passes back isLoading/apiError/recognizedResponse and reacts
// to the (authenticate)/(continueClicked)/(backClicked) outputs. Shared by
// LoginComponent's face step and the standalone FaceLoginComponent so both
// entry points stay visually and behaviorally identical.
@Component({
  selector: 'app-face-scan-panel',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './face-scan-panel.component.html',
  styleUrl: './face-scan-panel.component.scss',
})
export class FaceScanPanelComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('videoElement') videoElement?: ElementRef<HTMLVideoElement>;
  @ViewChild('captureCanvas') captureCanvas?: ElementRef<HTMLCanvasElement>;

  @Input() brandTitle = 'Sentinel OS';
  @Input() brandSubtitle = 'Predictive Maintenance Platform';
  @Input() isLoading = false;
  @Input() apiError: string | null = null;
  @Input() recognizedResponse: LoginResponse | null = null;

  @Output() authenticate = new EventEmitter<File>();
  @Output() continueClicked = new EventEmitter<void>();
  @Output() backClicked = new EventEmitter<void>();

  cameraReady = false;
  cameraError = '';
  capturing = false;

  private stream: MediaStream | null = null;
  private autoContinueTimer?: ReturnType<typeof setTimeout>;
  private autoContinueScheduled = false;
  private readonly isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) platformId: object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngAfterViewInit(): void {
    // Angular Universal's SSR/prerender DOM shim defines `window`, so a
    // typeof-window check alone can't tell it apart from a real browser —
    // it was letting startCamera() run on the server. There,
    // navigator.mediaDevices is unimplemented, so the "not supported" guard
    // inside startCamera() fired synchronously, mutating cameraError inside
    // this same AfterViewInit call. AfterViewInit runs after this
    // component's own template bindings were already evaluated for this
    // change-detection pass, so that mutation was invisible to the render
    // but visible to SSR's immediately-following checkNoChanges
    // verification pass — hence NG0100. Skip the camera (and any state
    // mutation) entirely off-browser, and defer the browser path past the
    // current pass so even a synchronous rejection there can't race it.
    if (!this.isBrowser) {
      return;
    }
    queueMicrotask(() => this.startCamera());
  }

  /** Once the parent hands back a recognized response, auto-advance instead of waiting for a click. */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['recognizedResponse'] && this.recognizedResponse && !this.autoContinueScheduled) {
      this.autoContinueScheduled = true;
      this.autoContinueTimer = setTimeout(() => this.continueClicked.emit(), AUTO_CONTINUE_DELAY_MS);
    }
  }

  ngOnDestroy(): void {
    this.stopCamera();
    if (this.autoContinueTimer) {
      clearTimeout(this.autoContinueTimer);
    }
  }

  get canCapture(): boolean {
    return this.cameraReady && !this.isLoading && !this.capturing && !this.recognizedResponse;
  }

  /** Bound to the "Capture Photo" button — the user decides when they're framed and ready, not a fixed timer. */
  async onCaptureClick(): Promise<void> {
    if (!this.canCapture) {
      return;
    }
    this.capturing = true;
    try {
      await this.attemptCapture();
    } finally {
      this.capturing = false;
    }
  }

  get displayError(): string {
    return this.cameraError || this.apiError || '';
  }

  get statusIconName(): string {
    if (this.recognizedResponse) return 'CircleCheck';
    if (this.displayError) return 'TriangleAlert';
    if (this.isLoading) return 'CircleCheck';
    if (!this.cameraReady) return 'CameraOff';
    return 'ScanFace';
  }

  get statusTitle(): string {
    if (this.recognizedResponse) return 'Identity Confirmed';
    if (this.displayError) return 'Recognition Failed';
    if (this.isLoading || this.capturing) return 'Face Detected';
    if (!this.cameraReady) return 'Camera Unavailable';
    return 'Ready When You Are';
  }

  get statusSubtitle(): string {
    if (this.recognizedResponse) return 'Redirecting to your dashboard…';
    if (this.displayError) return this.displayError;
    if (this.isLoading || this.capturing) return 'Verifying identity…';
    if (!this.cameraReady) return 'Please allow camera access to continue.';
    return 'Center your face in the frame, then tap Capture Photo.';
  }

  get progressPercent(): number {
    if (this.recognizedResponse) return 100;
    if (this.isLoading) return 85;
    if (this.displayError) return 25;
    return 45;
  }

  onBackClick(): void {
    this.backClicked.emit();
  }

  private async startCamera(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.cameraError = 'Camera is not supported in this browser.';
      this.cameraReady = false;
      return;
    }

    try {
      this.cameraError = '';
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });

      const video = this.videoElement?.nativeElement;
      if (video) {
        video.srcObject = this.stream;
        await video.play();
        this.cameraReady = true;
      }
    } catch {
      this.cameraReady = false;
      this.cameraError = 'Unable to access camera. Please allow permission and reload.';
    }
  }

  private async attemptCapture(): Promise<void> {
    const file = await this.captureFrame();
    if (file) {
      this.authenticate.emit(file);
    }
  }

  private captureFrame(): Promise<File | null> {
    const video = this.videoElement?.nativeElement;
    const canvas = this.captureCanvas?.nativeElement;

    if (!video || !canvas) {
      return Promise.resolve(null);
    }

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const context = canvas.getContext('2d');
    if (!context) {
      return Promise.resolve(null);
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => resolve(blob ? new File([blob], 'face-capture.jpg', { type: 'image/jpeg' }) : null),
        'image/jpeg',
        0.92
      );
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
}

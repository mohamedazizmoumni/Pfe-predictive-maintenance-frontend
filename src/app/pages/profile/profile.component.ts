import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { UserService } from '../../core/services/user.service';
import { User } from '../../core/models/sentinel.models';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime, filter, take } from 'rxjs/operators';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatSnackBarModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit, OnDestroy {
  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;
  @ViewChild('cameraVideo') cameraVideo?: ElementRef<HTMLVideoElement>;
  @ViewChild('faceCanvas') faceCanvas?: ElementRef<HTMLCanvasElement>;

  currentUser: User | null = null;
  profileForm!: FormGroup;
  isLoading = false;
  isSaving = false;
  isEditMode = false;
  successMessage = '';
  errorMessage = '';
  selectedFile: File | null = null;
  previewImageUrl: string | null = null;
  profilePictureUrl: string | null = null;
  cameraReady = false;
  isStartingCamera = false;
  showCameraModal = false;

  departments: string[] = [
    'Maintenance',
    'Operations',
    'Engineering',
    'Quality Assurance',
    'Management',
    'Administration',
    'Finance',
    'Human Resources',
    'IT Support',
    'Logistics',
    'Other',
  ];

  private cameraStream: MediaStream | null = null;
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private userService: UserService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    this.loadCurrentUser();
    // Refresh every time this component is viewed
    this.refreshProfileData();
  }

  private refreshProfileData(): void {
    // Get the current user and reload from server to ensure fresh data
    const user = this.authService.getCurrentUser();
    if (user?.username) {
      this.userService.getUser(user.username).subscribe({
        next: (refreshedUser) => {
          const preservedPictureUrl =
            this.currentUser?.profilePictureUrl ??
            this.profilePictureUrl ??
            user.profilePictureUrl ??
            this.userService.getProfilePictureUrl(user.username);
          // Preserve existing roles if the refreshed payload doesn't include them
          const refreshedRoles = Array.isArray(refreshedUser.roles) ? refreshedUser.roles : [];
          const mergedRoles = refreshedRoles.length > 0 ? refreshedRoles : (this.currentUser?.roles ?? []);

          const userWithPicture = {
            ...this.currentUser,
            ...refreshedUser,
            roles: mergedRoles,
            profilePictureUrl: preservedPictureUrl ?? refreshedUser.profilePictureUrl ?? null,
          } as User;

          this.currentUser = userWithPicture;
          this.populateForm(userWithPicture);
          this.loadProfilePicture(userWithPicture);
          this.authService.updateCurrentUser(userWithPicture);
        },
        error: (err) => {
          console.warn('Could not refresh user data:', err);
          // Continue with existing data if refresh fails
        }
      });
    }
  }

  // ─── Form ────────────────────────────────────────────────────────────────────

  private initializeForm(): void {
    // ✅ FIX (Angular warning): control disabled state via enable()/disable()
    // on the FormControl rather than [disabled] binding on the <select>.
    // Using [disabled] with reactive forms causes "changed after checked" errors.
    this.profileForm = this.fb.group({
      firstName:   ['', [Validators.required, Validators.minLength(2)]],
      lastName:    ['', [Validators.required, Validators.minLength(2)]],
      email:       ['', [Validators.required, Validators.email]],
      phoneNumber: ['', [Validators.pattern(/^[0-9\-\+\(\)\s]*$/)]],
      department:  [{ value: '', disabled: true }],  // starts disabled; enabled in edit mode
      displayName: [''],
    });
  }

  // ✅ FIX: Auto-save subscriptions are set up only AFTER currentUser is loaded
  // and confirmed to have a valid username. This eliminates the
  // "/api/v1/users/undefined" 404s that happened because subscriptions were
  // firing during the initial patchValue before currentUser was assigned.
  private setupAutoSavePerField(): void {
    Object.keys(this.profileForm.controls).forEach((fieldName) => {
      this.profileForm
        .get(fieldName)
        ?.valueChanges.pipe(
          debounceTime(1000),
          takeUntil(this.destroy$)
        )
        .subscribe((value) => {
          // Triple-guard: edit mode on, user exists, username is a real string.
          if (
            this.isEditMode &&
            this.currentUser &&
            this.currentUser.username &&
            this.currentUser.username !== 'undefined'
          ) {
            this.autoSaveField(fieldName, value);
          }
        });
    });
  }

  private autoSaveField(fieldName: string, value: any): void {
    // Redundant safety check — never call the API with an undefined username.
    if (!this.currentUser?.username) {
      console.warn(`autoSaveField skipped — username not ready`);
      return;
    }

    const updates: any = {};
    updates[fieldName] = value;

    console.log(`🔄 Saving ${fieldName}:`, value);

    this.userService
      .updateUser(this.currentUser.username, updates)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          // Keep the in-memory user in sync so toggling edit mode or
          // cancelling always reflects the last saved state.
          this.currentUser = { ...this.currentUser!, ...response };
          
          // Also update AuthService so changes persist across navigation
          this.authService.updateCurrentUser(this.currentUser);
          
          console.log(`✅ ${fieldName} auto-saved:`, value);
        },
        error: (error) => {
          console.error(`Auto-save failed for ${fieldName}:`, error);
          this.errorMessage = `Failed to save ${fieldName}. Please try again.`;
        },
      });
  }

  // ─── User loading ─────────────────────────────────────────────────────────

  private loadCurrentUser(): void {
    this.isLoading = true;

    this.authService.currentUser$
      .pipe(
        // ✅ FIX: Wait for a user with a real username before doing anything.
        // The auth stream sometimes emits a partially-hydrated object first
        // (username still undefined) which caused the /users/undefined 404s.
        filter((user): user is User =>
          user !== null &&
          user.username !== undefined &&
          user.username !== null &&
          user.username !== ''
        ),
        take(1),
        takeUntil(this.destroy$)
      )
      .subscribe((user) => {
        this.currentUser = user;
        this.populateForm(user);
        this.loadProfilePicture(user);
        this.isLoading = false;

        // ✅ FIX: Only start listening for changes AFTER we have a valid user.
        // Calling this earlier meant the debounce could fire before currentUser
        // was set, producing requests to /api/v1/users/undefined.
        this.setupAutoSavePerField();
      });
  }

  private loadProfilePicture(user: User): void {
    if (!user || !user.username) return;

    // Try to load the profile picture from the user object first
    if (user.profilePictureUrl) {
      this.profilePictureUrl = user.profilePictureUrl;
    } else {
      // If no profilePictureUrl in user object, generate it from username
      // This handles cases where picture was uploaded during registration
      this.profilePictureUrl = this.userService.getProfilePictureUrl(user.username);
    }
  }

  private populateForm(user: User): void {
    this.profileForm.patchValue({
      firstName:   user.firstName   || '',
      lastName:    user.lastName    || '',
      email:       user.email       || '',
      phoneNumber: user.phoneNumber || '',
      department:  user.department  || '',
      displayName: user.displayName || '',
    });
    
    // Ensure department is disabled initially
    this.profileForm.get('department')?.disable();
    this.isEditMode = false;
  }

  // ─── Edit mode ────────────────────────────────────────────────────────────

  toggleEditMode(): void {
    this.isEditMode = !this.isEditMode;

    if (this.isEditMode) {
      // ✅ FIX: Enable the department control when entering edit mode.
      this.profileForm.get('department')?.enable();
      this.clearMessages();
    } else {
      // Disable the department control when leaving edit mode.
      this.profileForm.get('department')?.disable();
      this.clearMessages();
      // Reset form to reflect the last saved state from currentUser
      if (this.currentUser) {
        this.populateForm(this.currentUser);
      }
    }
  }

  cancelEdit(): void {
    this.isEditMode = false;
    this.selectedFile = null;
    this.clearPreviewUrl();
    this.previewImageUrl = null;
    this.clearMessages();

    // Disable department select
    this.profileForm.get('department')?.disable();
    
    // Reset form to the last saved values from currentUser
    if (this.currentUser) {
      this.populateForm(this.currentUser);
    }
  }

  // ─── Profile picture ──────────────────────────────────────────────────────

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      if (this.processFile(file)) {
        this.uploadProfilePicture(file);
      }
    }
  }

  private processFile(file: File): boolean {
    if (!file.type.startsWith('image/')) {
      this.errorMessage = 'Please select a valid image file';
      return false;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.errorMessage = 'Image size must be less than 5MB';
      return false;
    }
    this.selectedFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      this.previewImageUrl = e.target?.result as string;
      this.clearMessages();
    };
    reader.readAsDataURL(file);
    return true;
  }

  private uploadProfilePicture(file: File): void {
    if (!this.currentUser?.username) {
      return;
    }

    console.log('🔄 Uploading profile picture...');

    this.userService
      .uploadProfilePicture(this.currentUser.username, file)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedUser: User) => {
          const persistentPictureUrl = this.previewImageUrl ?? updatedUser.profilePictureUrl ?? this.currentUser?.profilePictureUrl ?? null;
          // Preserve roles if the API returns an object without roles or with an empty array
          const updatedRoles = Array.isArray(updatedUser.roles) ? updatedUser.roles : [];
          const mergedRolesForUpdate = updatedRoles.length > 0 ? updatedRoles : (this.currentUser?.roles ?? []);

          const userWithPicture = {
            ...this.currentUser,
            ...updatedUser,
            roles: mergedRolesForUpdate,
            profilePictureUrl: persistentPictureUrl,
          } as User;

          this.currentUser = userWithPicture;
          
          // Also update AuthService so changes persist across navigation
          this.authService.updateCurrentUser(userWithPicture);
          
          this.profilePictureUrl = userWithPicture.profilePictureUrl ?? null;
          this.clearPreviewUrl();
          this.previewImageUrl = null;
          this.successMessage = 'Profile picture updated successfully!';
          this.snackBar.open('✅ Profile picture updated successfully!', 'Dismiss', { duration: 3000 });
          console.log('✅ Profile picture uploaded successfully');
        },
        error: (err: any) => {
          console.error('Profile picture upload failed:', err);
          this.errorMessage = 'Failed to upload profile picture. Please try again.';
        },
      });
  }

  // ─── Camera ───────────────────────────────────────────────────────────────

  startCamera(): void {
    if (this.cameraReady) {
      this.showCameraModal = true;
      return;
    }

    this.isStartingCamera = true;
    this.errorMessage = '';

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user' } })
      .then((stream) => {
        this.cameraStream = stream;
        this.cameraReady = true;
        this.showCameraModal = true;
        this.isStartingCamera = false;

        setTimeout(() => {
          if (this.cameraVideo) {
            this.cameraVideo.nativeElement.srcObject = stream;
          }
        }, 100);
      })
      .catch((error) => {
        console.error('Camera error:', error);
        this.errorMessage = 'Unable to access camera. Please check permissions.';
        this.isStartingCamera = false;
      });
  }

  capturePhoto(): void {
    if (!this.cameraVideo || !this.faceCanvas) {
      return;
    }

    const video = this.cameraVideo.nativeElement;
    const canvas = this.faceCanvas.nativeElement;
    const context = canvas.getContext('2d');

    if (context) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0);

      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], 'profile-photo.jpg', { type: 'image/jpeg' });
          if (this.processFile(file)) {
            this.uploadProfilePicture(file);
          }
          this.closeCameraModal();
        }
      }, 'image/jpeg');
    }
  }

  closeCameraModal(): void {
    this.showCameraModal = false;
    this.stopCamera();
  }

  private stopCamera(): void {
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach((track) => track.stop());
      this.cameraStream = null;
      this.cameraReady = false;
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private clearPreviewUrl(): void {
    if (this.previewImageUrl && this.previewImageUrl.startsWith('blob:')) {
      URL.revokeObjectURL(this.previewImageUrl);
    }
  }

  clearMessages(): void {
    this.successMessage = '';
    this.errorMessage = '';
  }

  async saveProfile(): Promise<void> {
    // Auto-save per field handles all persistence — kept for backward compatibility
    return;
  }

  triggerFileInput(): void {
    this.fileInput?.nativeElement.click();
  }

  getInitials(): string {
    if (!this.currentUser) return '?';
    const first = this.currentUser.firstName?.charAt(0) || '';
    const last  = this.currentUser.lastName?.charAt(0)  || '';
    return (first + last).toUpperCase() || '?';
  }

  onImageError(): void {
    console.warn('Profile picture failed to load, showing fallback');
    this.profilePictureUrl = null;
  }

  getRoleDisplay(): string {
    if (!this.currentUser?.roles?.length) {
      return 'No Role';
    }
    return this.currentUser.roles.map((r) => r.name).join(', ');
  }

  getStatusBadgeClass(): string {
    const status = this.currentUser?.status || 'UNKNOWN';
    return `status-badge status-${status.toLowerCase()}`;
  }

  ngOnDestroy(): void {
    this.stopCamera();
    this.clearPreviewUrl();
    this.destroy$.next();
    this.destroy$.complete();
  }
}
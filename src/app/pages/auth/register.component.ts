import { Component, OnInit } from '@angular/core';
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
import { RegisterPayload } from '../../core/models/sentinel.models';

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

  private stepFields: string[][] = [
    ['username', 'email', 'password', 'confirmPassword'],
    ['firstName', 'lastName', 'department'],
    ['terms'],
  ];

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.initializeForm();
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

    const value = this.registerForm.value;
    const payload: RegisterPayload = {
      username: value.username,
      email: value.email,
      password: value.password,
      firstName: value.firstName,
      lastName: value.lastName,
      department: value.department || undefined,
    };

    this.authService.register(payload).subscribe({
      next: () => {
        this.isLoading = false;
        this.router.navigate(['/dashboard']);
      },
      error: (error: any) => {
        this.isLoading = false;
        this.errorMessage =
          error?.error?.message || 'Registration failed. Please try again.';
      },
    });
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
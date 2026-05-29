import { Component, EventEmitter, Input, Output, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { Maintenance, Machine } from '../../../core/models/sentinel.models';
import { EquipmentService } from '../../../core/services/equipment.service';
import { Observable } from 'rxjs';

// Local type definition for expense categories (no longer using simple finance module)
type ExpenseCategory = 'MAINTENANCE' | 'PARTS' | 'LABOR' | 'EQUIPMENT' | 'OTHER';

interface PartUsed {
  name: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

@Component({
  selector: 'app-task-completion-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="modal-overlay" (click)="close()">
      <div class="modal-content" (click)="$event.stopPropagation()" data-card>
        <div class="modal-header">
          <h2>Complete Maintenance Task</h2>
          <button type="button" class="close-btn" (click)="close()">✕</button>
        </div>

        <form [formGroup]="form" (ngSubmit)="submit()" class="completion-form">
          <!-- Task Info -->
          <div class="task-info">
            <h3>{{ task?.description }}</h3>
            <p class="machine-name">Machine ID: {{ task?.machineId }}</p>
          </div>

          <!-- Step Indicator -->
          <div class="steps">
            <div class="step" [class.active]="currentStep() === 1" [class.completed]="currentStep() > 1">
              <span class="step-number">1</span>
              <span class="step-label">Rapport</span>
            </div>
            <div class="step" [class.active]="currentStep() === 2" [class.completed]="currentStep() > 2">
              <span class="step-number">2</span>
              <span class="step-label">Parts Used</span>
            </div>
            <div class="step" [class.active]="currentStep() === 3">
              <span class="step-number">3</span>
              <span class="step-label">Expense Report</span>
            </div>
          </div>

          <!-- Step 1: Maintenance Rapport -->
          <div *ngIf="currentStep() === 1" class="step-content">
            <h3>📋 Maintenance Rapport</h3>
            
            <div class="form-group">
              <label for="workPerformed">Work Performed *</label>
              <textarea
                id="workPerformed"
                formControlName="workPerformed"
                placeholder="Describe the work you performed..."
                rows="4"
              ></textarea>
              <small *ngIf="form.get('workPerformed')?.hasError('required')" class="error">
                Work performed is required
              </small>
            </div>

            <div class="form-group">
              <label for="issuesFound">Issues Found</label>
              <textarea
                id="issuesFound"
                formControlName="issuesFound"
                placeholder="Describe any issues you found..."
                rows="3"
              ></textarea>
            </div>

            <div class="form-group">
              <label for="recommendations">Recommendations</label>
              <textarea
                id="recommendations"
                formControlName="recommendations"
                placeholder="Any recommendations for future maintenance..."
                rows="3"
              ></textarea>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label for="timeSpent">Time Spent (hours) *</label>
                <input
                  id="timeSpent"
                  type="number"
                  formControlName="timeSpent"
                  placeholder="0.0"
                  step="0.5"
                  min="0"
                />
                <small *ngIf="form.get('timeSpent')?.hasError('required')" class="error">
                  Time spent is required
                </small>
              </div>

              <div class="form-group">
                <label for="completionStatus">Status *</label>
                <select id="completionStatus" formControlName="completionStatus">
                  <option value="COMPLETED">Completed</option>
                  <option value="PARTIALLY_COMPLETED">Partially Completed</option>
                  <option value="REQUIRES_FOLLOWUP">Requires Follow-up</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Step 2: Parts Used -->
          <div *ngIf="currentStep() === 2" class="step-content">
            <h3>⚙️ Parts Used</h3>
            
            <div class="parts-list" formArrayName="partsUsed">
              <div *ngFor="let part of partsUsed.controls; let i = index" 
                   [formGroupName]="i" 
                   class="part-item">
                <div class="part-header">
                  <span class="part-number">Part {{ i + 1 }}</span>
                  <button type="button" class="btn-remove" (click)="removePart(i)">
                    🗑️ Remove
                  </button>
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label>Part Name *</label>
                    <input
                      type="text"
                      formControlName="name"
                      placeholder="e.g., Motor Bearing"
                    />
                  </div>

                  <div class="form-group">
                    <label>Quantity *</label>
                    <input
                      type="number"
                      formControlName="quantity"
                      placeholder="1"
                      min="1"
                      (input)="calculatePartTotal(i)"
                    />
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label>Unit Cost ($) *</label>
                    <input
                      type="number"
                      formControlName="unitCost"
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      (input)="calculatePartTotal(i)"
                    />
                  </div>

                  <div class="form-group">
                    <label>Total Cost</label>
                    <input
                      type="number"
                      formControlName="totalCost"
                      readonly
                      class="readonly"
                    />
                  </div>
                </div>
              </div>
            </div>

            <button type="button" class="btn-add-part" (click)="addPart()">
              ➕ Add Part
            </button>

            <div class="parts-summary">
              <span>Total Parts Cost:</span>
              <span class="total-amount">{{ formatCurrency(getTotalPartsCost()) }}</span>
            </div>
          </div>

          <!-- Step 3: Expense Report -->
          <div *ngIf="currentStep() === 3" class="step-content">
            <h3>💰 Expense Report</h3>

            <div class="form-group">
              <label for="machineId">Machine *</label>
              <select 
                id="machineId" 
                formControlName="machineId"
                (change)="onMachineSelected()"
              >
                <option value="">Select a machine...</option>
                <option *ngFor="let machine of machines$ | async" [value]="machine.id">
                  {{ machine.name }} - {{ machine.serialNumber }} ({{ machine.location }})
                </option>
              </select>
              <small *ngIf="form.get('machineId')?.hasError('required')" class="error">
                Machine selection is required
              </small>
            </div>

            <div class="form-group">
              <label for="expenseTitle">Expense Title *</label>
              <input
                id="expenseTitle"
                type="text"
                formControlName="expenseTitle"
                placeholder="e.g., Machine #5 Repair - Parts & Labor"
              />
              <small *ngIf="form.get('expenseTitle')?.hasError('required')" class="error">
                Expense title is required
              </small>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label for="expenseCategory">Category *</label>
                <select id="expenseCategory" formControlName="expenseCategory">
                  <option value="MAINTENANCE">🔧 Maintenance</option>
                  <option value="PARTS">⚙️ Parts</option>
                  <option value="LABOR">👷 Labor</option>
                  <option value="EQUIPMENT">🏭 Equipment</option>
                  <option value="OTHER">📦 Other</option>
                </select>
              </div>

              <div class="form-group">
                <label for="laborCost">Labor Cost ($)</label>
                <input
                  id="laborCost"
                  type="number"
                  formControlName="laborCost"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  (input)="calculateTotalExpense()"
                />
              </div>
            </div>

            <div class="form-group">
              <label for="expenseDescription">Expense Description</label>
              <textarea
                id="expenseDescription"
                formControlName="expenseDescription"
                placeholder="Detailed description of the expense..."
                rows="3"
              ></textarea>
            </div>

            <div class="expense-breakdown">
              <h4>Expense Breakdown</h4>
              <div class="breakdown-item">
                <span>Parts Cost:</span>
                <span>{{ formatCurrency(getTotalPartsCost()) }}</span>
              </div>
              <div class="breakdown-item">
                <span>Labor Cost:</span>
                <span>{{ formatCurrency(form.get('laborCost')?.value || 0) }}</span>
              </div>
              <div class="breakdown-item total">
                <span>Total Expense:</span>
                <span>{{ formatCurrency(form.get('totalExpense')?.value || 0) }}</span>
              </div>
            </div>
          </div>

          <!-- Navigation Buttons -->
          <div class="form-actions">
            <button
              type="button"
              class="btn-secondary"
              (click)="previousStep()"
              *ngIf="currentStep() > 1"
            >
              ← Previous
            </button>

            <button
              type="button"
              class="btn-secondary"
              (click)="close()"
            >
              Cancel
            </button>

            <button
              type="button"
              class="btn-primary"
              (click)="nextStep()"
              *ngIf="currentStep() < 3"
              [disabled]="!isCurrentStepValid()"
            >
              Next →
            </button>

            <button
              type="submit"
              class="btn-primary"
              *ngIf="currentStep() === 3"
              [disabled]="!form.valid || isSubmitting()"
            >
              {{ isSubmitting() ? 'Submitting...' : '✓ Complete Task' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: var(--z-modal, 100);
      animation: fadeIn 0.2s ease;
    }

    .modal-content {
      background: var(--color-bg-elevated);
      border: 1px solid var(--color-border-strong);
      border-radius: var(--radius-xl, 22px);
      box-shadow: var(--shadow-xl);
      max-width: 700px;
      width: 90%;
      max-height: 90vh;
      overflow-y: auto;
      animation: slideUp 0.3s ease;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.5rem;
      border-bottom: 1px solid var(--color-border);
      background: var(--color-bg-sunken);

      h2 {
        margin: 0;
        font-size: 1.3rem;
        color: var(--color-text-primary);
      }

      .close-btn {
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        color: var(--color-text-muted);
        transition: color 0.2s ease;
        font-family: inherit;

        &:hover { color: var(--color-text-primary); }
      }
    }

    .task-info {
      padding: 1rem 1.5rem;
      background: var(--color-accent-dim);
      border-bottom: 1px solid var(--color-border);

      h3 {
        margin: 0 0 0.5rem 0;
        color: var(--color-text-primary);
        font-size: 1.1rem;
      }

      .machine-name {
        margin: 0;
        color: var(--color-text-secondary);
        font-size: 0.9rem;
      }
    }

    .steps {
      display: flex;
      justify-content: space-between;
      padding: 1.5rem;
      border-bottom: 1px solid var(--color-border);

      .step {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        position: relative;

        &:not(:last-child)::after {
          content: '';
          position: absolute;
          top: 15px;
          left: 60%;
          right: -40%;
          height: 2px;
          background: var(--color-border-strong);
        }

        &.completed::after { background: var(--color-success); }

        .step-number {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: var(--color-bg-sunken);
          color: var(--color-text-muted);
          border: 2px solid var(--color-border-strong);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 0.9rem;
          position: relative;
          z-index: 1;
        }

        &.active .step-number {
          background: var(--color-accent);
          color: var(--color-text-on-accent);
          border-color: var(--color-accent);
        }

        &.completed .step-number {
          background: var(--color-success);
          color: var(--color-text-on-accent);
          border-color: var(--color-success);
        }

        .step-label {
          font-size: 0.85rem;
          color: var(--color-text-muted);
        }

        &.active .step-label {
          color: var(--color-text-primary);
          font-weight: 600;
        }
      }
    }

    .completion-form {
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .step-content {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;

      h3 {
        margin: 0;
        color: var(--color-text-primary);
        font-size: 1.2rem;
      }
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;

      label {
        font-weight: 600;
        color: var(--color-text-primary);
        font-size: 0.9rem;
      }

      input, select, textarea {
        padding: 0.75rem;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm, 10px);
        font-size: 0.95rem;
        background: var(--color-bg-sunken);
        color: var(--color-text-primary);
        transition: all 0.2s ease;
        font-family: inherit;
        width: 100%;
        box-sizing: border-box;

        &:focus {
          outline: none;
          border-color: var(--color-border-focus);
          box-shadow: 0 0 0 3px var(--color-accent-dim);
        }

        &.readonly {
          background: var(--color-bg-elevated);
          cursor: not-allowed;
          opacity: 0.7;
        }

        &::placeholder { color: var(--color-text-disabled); }

        option {
          background: var(--color-bg-elevated);
          color: var(--color-text-primary);
        }
      }

      textarea {
        resize: vertical;
        min-height: 80px;
      }

      small.error {
        color: var(--color-danger-text);
        font-size: 0.85rem;
      }
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    .parts-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .part-item {
      padding: 1rem;
      background: var(--color-bg-sunken);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md, 14px);

      .part-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;

        .part-number {
          font-weight: 600;
          color: var(--color-text-primary);
        }

        .btn-remove {
          background: var(--color-danger-bg);
          color: var(--color-danger-text);
          border: 1px solid var(--color-danger-border);
          padding: 0.4rem 0.9rem;
          border-radius: var(--radius-xs, 6px);
          cursor: pointer;
          font-size: 0.85rem;
          transition: all 0.2s ease;
          font-family: inherit;

          &:hover { opacity: 0.8; }
        }
      }
    }

    .btn-add-part {
      padding: 0.75rem 1.5rem;
      background: var(--color-accent-dim);
      color: var(--color-accent-text);
      border: 1px solid var(--color-accent-glow, var(--color-accent-dim));
      border-radius: var(--radius-sm, 10px);
      cursor: pointer;
      font-weight: 600;
      transition: all 0.2s ease;
      font-family: inherit;

      &:hover { opacity: 0.85; }
    }

    .parts-summary {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem;
      background: var(--color-accent-dim);
      border-radius: var(--radius-md, 14px);
      font-weight: 600;
      color: var(--color-text-primary);

      .total-amount {
        font-size: 1.3rem;
        color: var(--color-accent-text);
      }
    }

    .expense-breakdown {
      padding: 1rem;
      background: var(--color-bg-sunken);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md, 14px);

      h4 {
        margin: 0 0 1rem 0;
        color: var(--color-text-primary);
        font-size: 1rem;
      }

      .breakdown-item {
        display: flex;
        justify-content: space-between;
        padding: 0.5rem 0;
        color: var(--color-text-secondary);

        &.total {
          border-top: 2px solid var(--color-border-strong);
          margin-top: 0.5rem;
          padding-top: 1rem;
          font-weight: 700;
          font-size: 1.1rem;
          color: var(--color-text-primary);

          span:last-child { color: var(--color-accent-text); }
        }
      }
    }

    .form-actions {
      display: flex;
      gap: 1rem;
      justify-content: flex-end;
      padding-top: 1rem;
      border-top: 1px solid var(--color-border);

      button {
        padding: 0.75rem 1.5rem;
        border: none;
        border-radius: var(--radius-sm, 10px);
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        font-family: inherit;

        &.btn-secondary {
          background: var(--color-bg-sunken);
          color: var(--color-text-primary);
          border: 1px solid var(--color-border);

          &:hover:not(:disabled) {
            background: var(--color-bg-elevated);
            border-color: var(--color-border-strong);
          }
        }

        &.btn-primary {
          background: var(--color-accent);
          color: var(--color-text-on-accent);

          &:hover:not(:disabled) {
            background: var(--color-accent-hover);
            transform: translateY(-2px);
            box-shadow: var(--shadow-accent);
          }

          &:disabled {
            background: var(--color-bg-elevated);
            color: var(--color-text-disabled);
            cursor: not-allowed;
          }
        }
      }
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    @keyframes slideUp {
      from { transform: translateY(20px); opacity: 0; }
      to   { transform: translateY(0);    opacity: 1; }
    }

    @media (max-width: 768px) {
      .modal-content { width: 95%; }
      .form-row { grid-template-columns: 1fr; }
      .steps .step .step-label { font-size: 0.75rem; }
    }
  `]
})
export class TaskCompletionModalComponent implements OnInit {
  @Input() task: Maintenance | null = null;
  @Output() completed = new EventEmitter<any>();
  @Output() cancelled = new EventEmitter<void>();

  currentStep = signal(1);
  isSubmitting = signal(false);

  form: FormGroup;
  machines$: Observable<Machine[]>;

  constructor(
    private fb: FormBuilder,
    private equipmentService: EquipmentService
  ) {
    this.machines$ = this.equipmentService.machines$;
    this.form = this.fb.group({
      // Step 1: Rapport
      workPerformed: ['', Validators.required],
      issuesFound: [''],
      recommendations: [''],
      timeSpent: ['', [Validators.required, Validators.min(0)]],
      completionStatus: ['COMPLETED', Validators.required],

      // Step 2: Parts
      partsUsed: this.fb.array([]),

      // Step 3: Expense
      machineId: ['', Validators.required],
      expenseTitle: ['', Validators.required],
      expenseCategory: ['MAINTENANCE', Validators.required],
      laborCost: [0, [Validators.min(0)]],
      expenseDescription: [''],
      totalExpense: [0],
    });

    // Add one part by default
    this.addPart();
  }

  ngOnInit(): void {
    // Load machines list
    this.equipmentService.loadMachines(0, 1000);
    
    // If task has machineId, pre-select it
    if (this.task?.machineId) {
      this.form.patchValue({ machineId: this.task.machineId });
      this.onMachineSelected();
    }
  }

  onMachineSelected(): void {
    const machineId = this.form.get('machineId')?.value;
    if (!machineId) return;

    // Get selected machine from the list
    this.machines$.subscribe(machines => {
      const selectedMachine = machines.find(m => m.id === Number(machineId));
      if (selectedMachine) {
        // Auto-populate expense title
        const title = `${selectedMachine.name} - Maintenance & Repair`;
        this.form.patchValue({ expenseTitle: title });
      }
    });
  }

  get partsUsed(): FormArray {
    return this.form.get('partsUsed') as FormArray;
  }

  addPart(): void {
    const partGroup = this.fb.group({
      name: ['', Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
      unitCost: [0, [Validators.required, Validators.min(0)]],
      totalCost: [0],
    });

    this.partsUsed.push(partGroup);
  }

  removePart(index: number): void {
    this.partsUsed.removeAt(index);
    this.calculateTotalExpense();
  }

  calculatePartTotal(index: number): void {
    const part = this.partsUsed.at(index);
    const quantity = part.get('quantity')?.value || 0;
    const unitCost = part.get('unitCost')?.value || 0;
    const total = quantity * unitCost;
    part.get('totalCost')?.setValue(total);
    this.calculateTotalExpense();
  }

  getTotalPartsCost(): number {
    return this.partsUsed.controls.reduce((sum, part) => {
      return sum + (part.get('totalCost')?.value || 0);
    }, 0);
  }

  calculateTotalExpense(): void {
    const partsCost = this.getTotalPartsCost();
    const laborCost = this.form.get('laborCost')?.value || 0;
    const total = partsCost + laborCost;
    this.form.get('totalExpense')?.setValue(total);
  }

  isCurrentStepValid(): boolean {
    if (this.currentStep() === 1) {
      return !!(this.form.get('workPerformed')?.valid && 
                this.form.get('timeSpent')?.valid);
    }
    if (this.currentStep() === 2) {
      return !!this.partsUsed.valid;
    }
    return true;
  }

  nextStep(): void {
    if (this.currentStep() < 3 && this.isCurrentStepValid()) {
      this.currentStep.update(step => step + 1);
    }
  }

  previousStep(): void {
    if (this.currentStep() > 1) {
      this.currentStep.update(step => step - 1);
    }
  }

  submit(): void {
    if (!this.form.valid) return;

    this.isSubmitting.set(true);

    const formValue = this.form.value;
    const completionData = {
      taskId: this.task?.id,
      rapport: {
        workPerformed: formValue.workPerformed,
        issuesFound: formValue.issuesFound,
        recommendations: formValue.recommendations,
        timeSpent: formValue.timeSpent,
        completionStatus: formValue.completionStatus,
      },
      partsUsed: formValue.partsUsed,
      expense: {
        machineId: formValue.machineId,
        title: formValue.expenseTitle,
        amount: formValue.totalExpense,
        category: formValue.expenseCategory,
        description: formValue.expenseDescription || this.generateExpenseDescription(formValue),
      },
    };

    this.completed.emit(completionData);
  }

  private generateExpenseDescription(formValue: any): string {
    const parts = formValue.partsUsed.map((p: any) => 
      `${p.name} (${p.quantity}x @ $${p.unitCost})`
    ).join(', ');
    
    return `Task: ${this.task?.description}\nParts: ${parts}\nLabor: ${formValue.timeSpent}h @ $${formValue.laborCost}`;
  }

  close(): void {
    this.cancelled.emit();
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  }
}

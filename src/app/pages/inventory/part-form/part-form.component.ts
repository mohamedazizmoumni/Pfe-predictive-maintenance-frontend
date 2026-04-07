import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { InventoryService } from '../../../core/services/inventory.service';

@Component({
  selector: 'app-part-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './part-form.component.html',
  styleUrls: ['./part-form.component.scss']
})
export class PartFormComponent {
  partForm: FormGroup;
  isEdit = false;
  loading = false;
  error: string | null = null;

  constructor(
    private fb: FormBuilder,
    private inventoryService: InventoryService,
    public router: Router,
    public route: ActivatedRoute
  ) {
    this.partForm = this.fb.group({
      name: ['', Validators.required],
      description: [''],
      partNumber: ['', Validators.required],
      category: [''],
      cost: [0, [Validators.min(0)]],
      minimumStock: [0, [Validators.required, Validators.min(0)]],
      reorderQuantity: [0, [Validators.min(0)]],
      unit: [''],
      supplier: [''],
      notes: ['']
    });
    // Detect edit mode
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit = true;
      this.loadPart(id);
    }
  }

  loadPart(id: string) {
    this.loading = true;
    this.inventoryService.getPartById(Number(id)).subscribe({
      next: (part: any) => {
        this.partForm.patchValue({
          name: part.name,
          description: part.description,
          partNumber: part.partNumber,
          category: part.category,
          cost: part.cost,
          minimumStock: part.minimumStock,
          reorderQuantity: part.reorderQuantity,
          unit: part.unit,
          supplier: part.supplier,
          notes: part.notes
        });
        this.loading = false;
      },
      error: (err: any) => {
        this.error = 'Failed to load part.';
        this.loading = false;
      }
    });
  }

  onSubmit() {
    if (this.partForm.invalid) return;
    this.loading = true;
    this.error = null;
    const formValue = this.partForm.value;
    const createPayload = {
      name: formValue.name,
      description: formValue.description,
      partNumber: formValue.partNumber,
      category: formValue.category,
      cost: formValue.cost,
      minimumStock: formValue.minimumStock,
      reorderQuantity: formValue.reorderQuantity,
      unit: formValue.unit,
      supplier: formValue.supplier,
      notes: formValue.notes
    };
    const id = this.route.snapshot.paramMap.get('id');
    if (this.isEdit && id) {
      const updatePayload = {
        name: formValue.name,
        description: formValue.description,
        cost: formValue.cost,
        minimumStock: formValue.minimumStock,
        reorderQuantity: formValue.reorderQuantity,
        supplier: formValue.supplier
      };
      this.inventoryService.updatePart(Number(id), updatePayload).subscribe({
        next: () => this.router.navigate(['../'], { relativeTo: this.route }),
        error: () => {
          this.error = 'Failed to update part.';
          this.loading = false;
        }
      });
    } else {
      this.inventoryService.createPart(createPayload).subscribe({
        next: () => this.router.navigate(['../'], { relativeTo: this.route }),
        error: () => {
          this.error = 'Failed to create part.';
          this.loading = false;
        }
      });
    }
  }
}

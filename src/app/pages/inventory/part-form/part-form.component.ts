import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { InventoryService } from '../../../core/services/inventory.service';

@Component({
  selector: 'app-part-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './part-form.component.html',
  styleUrls: ['./part-form.component.scss']
})
export class PartFormComponent implements OnInit {

  partForm: FormGroup;
  isEdit = false;
  loading = false;
  error: string | null = null;

  categories: any[] = []; // ✅ FIXED
  

  loadingCategories = false;
  part: any = {};

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
      category: ['', Validators.required], // ✅ FIXED
      cost: [0, [Validators.min(0)]],
      minimumStock: [0, [Validators.required, Validators.min(0)]],
      reorderQuantity: [0, [Validators.min(0)]],
      unit: [''],
      supplier: [''],
      notes: ['']
    });
  }

  ngOnInit(): void {
    this.loadCategories();

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit = true;
      this.loadPart(id);
    }
  }

  // ✅ Load categories
  loadCategories(): void {
    this.loadingCategories = true;

    this.inventoryService.getCategories().subscribe({
      next: (cats: any[]) => {
        this.categories = cats || [];
        this.loadingCategories = false;
      },
      error: () => {
        this.loadingCategories = false;
      }
    });
  }

  

  // ✅ Load part (edit mode)
  loadPart(id: string): void {
    this.loading = true;

    this.inventoryService.getPartById(Number(id)).subscribe({
      next: (part: any) => {
        this.part = part;

        this.partForm.patchValue({
          name: part.name,
          description: part.description,
          partNumber: part.partNumber,
          category: part.category, // ⚠️ if backend uses ID → change here
          cost: part.cost,
          minimumStock: part.minimumStock,
          reorderQuantity: part.reorderQuantity,
          unit: part.unit,
          supplier: part.supplier,
          notes: part.notes
        });

        this.loading = false;
      },
      error: () => {
        this.error = 'Failed to load part.';
        this.loading = false;
      }
    });
  }

  // ✅ Submit form
  onSubmit(): void {
    if (this.partForm.invalid) return;

    this.loading = true;
    this.error = null;

    const formValue = this.partForm.value;

    const payload = {
      name: formValue.name,
      description: formValue.description,
      partNumber: formValue.partNumber,
      category: formValue.category, // ⚠️ ID or name depending backend
      cost: formValue.cost,
      minimumStock: formValue.minimumStock,
      reorderQuantity: formValue.reorderQuantity,
      unit: formValue.unit,
      supplier: formValue.supplier,
      notes: formValue.notes
    };

    const id = this.route.snapshot.paramMap.get('id');

    if (this.isEdit && id) {
      this.inventoryService.updatePart(Number(id), payload).subscribe({
        next: () => this.router.navigate(['../'], { relativeTo: this.route }),
        error: () => {
          this.error = 'Failed to update part.';
          this.loading = false;
        }
      });

    } else {
      this.inventoryService.createPart(payload).subscribe({
        next: () => this.router.navigate(['../'], { relativeTo: this.route }),
        error: () => {
          this.error = 'Failed to create part.';
          this.loading = false;
        }
      });
    }
  }
}
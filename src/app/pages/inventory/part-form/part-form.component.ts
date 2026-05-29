import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { InventoryService } from '../../../core/services/inventory.service';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

@Component({
  selector: 'app-part-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, MatSnackBarModule],
  templateUrl: './part-form.component.html',
  styleUrls: ['./part-form.component.scss']
})
export class PartFormComponent implements OnInit {

  partForm: FormGroup;
  isEdit = false;
  loading = false;
  error: string | null = null;

  categories: any[] = [];
  subCategories: string[] = [];
  loadingCategories = false;
  part: any = {};

  // Image upload properties
  selectedImage: File | null = null;
  imagePreview: string | null = null;
  uploadingImage = false;

  constructor(
    private fb: FormBuilder,
    private inventoryService: InventoryService,
    public router: Router,
    public route: ActivatedRoute,
    private snackBar: MatSnackBar
  ) {
    this.partForm = this.fb.group({
      name: ['', Validators.required],
      description: [''],
      partNumber: ['', Validators.required],
      currentStock: [0, [Validators.required, Validators.min(0)]], // ✅ Added
      category: ['', Validators.required],
      subCategory: [''],
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

  /**
   * Called when the user selects a category in the part form.
   * Dynamically loads the matching subcategories and resets the subCategory field.
   */
  onCategoryChange(event: Event): void {
    const categoryName = (event.target as HTMLSelectElement).value;
    this.inventoryService.getSubCategories(categoryName).subscribe((subs) => {
      this.subCategories = subs;
      this.partForm.patchValue({ subCategory: '' });
    });
  }

  /**
   * Handle image file selection
   */
  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        this.error = 'Please select a valid image file (JPEG, PNG, GIF, WebP)';
        input.value = '';
        return;
      }

      // Validate file size (5MB max)
      const maxSize = 5 * 1024 * 1024; // 5MB in bytes
      if (file.size > maxSize) {
        this.error = 'Image size must not exceed 5MB. Please compress or resize the image.';
        input.value = '';
        return;
      }

      this.selectedImage = file;
      this.error = null;

      // Generate preview
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.imagePreview = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  /**
   * Remove selected image
   */
  removeImage(): void {
    this.selectedImage = null;
    this.imagePreview = null;
    
    // Reset file input
    const fileInput = document.getElementById('imageFile') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  /**
   * Delete existing image from server
   */
  deleteExistingImage(): void {
    if (!this.part?.id) return;

    if (!confirm('Are you sure you want to delete this image?')) {
      return;
    }

    this.uploadingImage = true;
    this.inventoryService.deletePartImage(this.part.id).subscribe({
      next: (updatedPart) => {
        this.part = updatedPart;
        this.imagePreview = null;
        this.uploadingImage = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'Failed to delete image';
        this.uploadingImage = false;
      }
    });
  }

  // ✅ Load part (edit mode)
  loadPart(id: string): void {
    this.loading = true;

    this.inventoryService.getPartById(Number(id)).subscribe({
      next: (part: any) => {
        this.part = part;

        // Set image preview if exists
        if (part.imageUrl) {
          this.imagePreview = part.imageUrl;
        }

        // Pre-populate subcategories for the selected category
        if (part.category) {
          this.inventoryService.getSubCategories(part.category).subscribe((subs) => {
            this.subCategories = subs;
          });
        }

        this.partForm.patchValue({
          name: part.name,
          description: part.description,
          partNumber: part.partNumber,
          currentStock: part.currentStock || 0, // ✅ Added
          category: part.category,
          subCategory: part.subCategory || '',
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
    if (this.partForm.invalid) {
      // Mark all fields as touched to show validation errors
      Object.keys(this.partForm.controls).forEach(key => {
        this.partForm.get(key)?.markAsTouched();
      });
      
      this.error = 'Please fill in all required fields (marked with *)';
      return;
    }

    this.loading = true;
    this.error = null;

    const formValue = this.partForm.value;

    // Validate required fields before sending
    if (!formValue.partNumber || formValue.partNumber.trim() === '') {
      this.error = 'Part Number is required and cannot be empty';
      this.loading = false;
      return;
    }

    const payload = {
      name: formValue.name?.trim(),
      description: formValue.description?.trim() || '',
      partNumber: formValue.partNumber?.trim(), // Ensure no whitespace
      currentStock: formValue.currentStock || 0,
      category: formValue.category,
      subCategory: formValue.subCategory || '',
      cost: formValue.cost || 0,
      minimumStock: formValue.minimumStock || 0,
      reorderQuantity: formValue.reorderQuantity || 0,
      unit: formValue.unit?.trim() || '',
      supplier: formValue.supplier?.trim() || '',
      notes: formValue.notes?.trim() || ''
    };

    console.log('📦 Sending payload:', payload);

    const id = this.route.snapshot.paramMap.get('id');

    if (this.isEdit && id) {
      // Update existing part
      this.inventoryService.updatePart(Number(id), payload).subscribe({
        next: (updatedPart) => {
          // Upload image if selected
          if (this.selectedImage) {
            this.uploadImage(updatedPart.id);
          } else {
            this.snackBar.open('✅ Part updated successfully!', 'Dismiss', { duration: 3000 });
            this.router.navigate(['../'], { relativeTo: this.route });
          }
        },
        error: (err: any) => {
          console.error('❌ Error updating part:', err);
          this.handleError(err, formValue.category);
        }
      });

    } else {
      // Create new part
      this.inventoryService.createPart(payload).subscribe({
        next: (createdPart) => {
          // Upload image if selected
          if (this.selectedImage) {
            this.uploadImage(createdPart.id);
          } else {
            this.snackBar.open('✅ Part created successfully!', 'Dismiss', { duration: 3000 });
            this.router.navigate(['../'], { relativeTo: this.route });
          }
        },
        error: (err: any) => {
          console.error('❌ Error creating part:', err);
          this.handleError(err, formValue.category);
        }
      });
    }
  }

  /**
   * Upload image after part creation/update
   */
  private uploadImage(partId: number): void {
    if (!this.selectedImage) {
      this.router.navigate(['../'], { relativeTo: this.route });
      return;
    }

    this.uploadingImage = true;
    this.inventoryService.uploadPartImage(partId, this.selectedImage).subscribe({
      next: () => {
        this.uploadingImage = false;
        this.snackBar.open(`✅ Part ${this.isEdit ? 'updated' : 'created'} successfully with image!`, 'Dismiss', { duration: 3000 });
        this.router.navigate(['../'], { relativeTo: this.route });
      },
      error: (err) => {
        console.error('❌ Error uploading image:', err);
        this.error = err?.error?.message || 'Part saved but image upload failed. You can try uploading the image again by editing the part.';
        this.uploadingImage = false;
        this.loading = false;
      }
    });
  }

  /**
   * Handle error responses
   */
  private handleError(err: any, categoryName: string): void {
    if (err?.error?.message?.includes('Category not found')) {
      this.error = `Category "${categoryName}" does not exist. Please create it first in "Manage Categories" or select an existing category.`;
    } else {
      this.error = err?.error?.message || 'Failed to save part.';
    }
    this.loading = false;
  }
}
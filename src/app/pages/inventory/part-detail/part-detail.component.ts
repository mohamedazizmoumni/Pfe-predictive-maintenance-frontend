import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { InventoryService } from '../../../core/services/inventory.service';

@Component({
  selector: 'app-part-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './part-detail.component.html',
  styleUrls: ['./part-detail.component.scss']
})
export class PartDetailComponent implements OnInit {
  part: any;
  loading = false;
  error: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private inventoryService: InventoryService
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loading = true;
      this.inventoryService.getPartById(Number(id)).subscribe({
        next: (part: any) => {
          this.part = part;
          this.loading = false;
        },
        error: () => {
          this.error = 'Failed to load part details.';
          this.loading = false;
        }
      });
    } else {
      this.error = 'No part ID provided.';
    }
  }

  goBack() {
    this.router.navigate(['../'], { relativeTo: this.route });
  }
}

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PortalService } from '../../../core/services/portal.service';
import { PortalMachineSummary } from '../../../core/models/sentinel.models';

@Component({
  selector: 'app-portal-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './portal-home.component.html',
  styleUrl: './portal-home.component.scss',
})
export class PortalHomeComponent implements OnInit {
  machines: PortalMachineSummary[] = [];
  isLoading = true;
  error: string | null = null;

  constructor(private portalService: PortalService) {}

  ngOnInit(): void {
    this.portalService.listMyMachines().subscribe({
      next: (machines) => {
        this.machines = machines;
        this.isLoading = false;
      },
      error: () => {
        this.error = 'Could not load your machines. Please try again later.';
        this.isLoading = false;
      },
    });
  }

  healthClass(score: number): string {
    if (score >= 70) return 'health-good';
    if (score >= 40) return 'health-warn';
    return 'health-critical';
  }
}

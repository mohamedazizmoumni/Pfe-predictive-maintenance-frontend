import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { DashboardRoutingService } from '../dashboards/dashboard-routing.service';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './not-found.component.html',
  styleUrl: './not-found.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundComponent implements OnInit {
  dashboardRoute = '/dashboards/admin';
  attemptedPath = '';

  constructor(
    private router: Router,
    private authService: AuthService,
    private dashboardRouting: DashboardRoutingService
  ) {}

  ngOnInit(): void {
    this.attemptedPath = this.router.url;
    this.dashboardRoute = this.dashboardRouting.getRouteForUser(this.authService.getCurrentUser());
  }
}

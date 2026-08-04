import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { DashboardRoutingService } from '../dashboards/dashboard-routing.service';

/** Maps the first path segment of a denied URL to a human-readable module name. */
const MODULE_LABELS: Record<string, string> = {
  equipment: 'Equipment',
  maintenance: 'Maintenance',
  alerts: 'Alerts',
  inventory: 'Inventory',
  finance: 'Finance',
  budgets: 'Budgets',
  'user-management': 'User Management',
  'stock-notifications': 'Stock Notifications',
  'predictive-dashboard': 'Predictive Maintenance',
  'ai-assistant': 'AI Assistant',
  'ai-risk-overview': 'AI Assistant',
  dashboards: 'this dashboard',
};

@Component({
  selector: 'app-access-denied',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './access-denied.component.html',
  styleUrl: './access-denied.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccessDeniedComponent implements OnInit {
  moduleLabel = 'this module';
  dashboardRoute = '/dashboards/admin';

  constructor(
    private route: ActivatedRoute,
    private authService: AuthService,
    private dashboardRouting: DashboardRoutingService
  ) {}

  ngOnInit(): void {
    const from = this.route.snapshot.queryParamMap.get('from');
    const firstSegment = from?.split('/').filter(Boolean)[0];
    if (firstSegment && MODULE_LABELS[firstSegment]) {
      this.moduleLabel = MODULE_LABELS[firstSegment];
    }

    this.dashboardRoute = this.dashboardRouting.getRouteForUser(this.authService.getCurrentUser());
  }
}

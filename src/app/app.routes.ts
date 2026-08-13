import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { redirectLoggedInGuard } from './core/guards/redirect-logged-in.guard';
import { dataRoleGuard } from './core/guards/role.guard';
import { SentinelLayoutComponent } from './layout/sentinel-layout.component';
import { LoginComponent } from './pages/auth/login.component';
import { EquipmentComponent } from './pages/equipment/equipment.component';
import { MaintenanceComponent } from './pages/maintenance/maintenance.component';
import { AlertsComponent } from './pages/alerts/alerts.component';
import { AccessDeniedComponent } from './pages/access-denied/access-denied.component';
import { InventoryComponent } from './pages/inventory/inventory.component';
import { PartsListComponent } from './pages/inventory/parts-list/parts-list.component';
import { PartFormComponent } from './pages/inventory/part-form/part-form.component';
import { PartDetailComponent } from './pages/inventory/part-detail/part-detail.component';
import { CategoriesComponent } from './pages/inventory/categories/categories.component';
import { ReorderRequestsComponent } from './pages/inventory/reorder-requests/reorder-requests.component';
import { StockOrdersComponent } from './pages/inventory/stock-orders/stock-orders.component';
import { InventoryAnalyticsComponent } from './pages/inventory/inventory-analytics/inventory-analytics.component';
import { ChatbotComponent } from './pages/chatbot/chatbot.component';
import { NlpDashboardComponent } from './pages/nlp-dashboard/nlp-dashboard.component';
import { RecommendationPageComponent } from './pages/recommendation/recommendation-page.component';
import { BudgetOverviewComponent } from './components/budget-overview/budget-overview.component';
import { SuperAdminDashboardComponent } from './pages/dashboards/role-dashboards/super-admin-dashboard/super-admin-dashboard.component';
import { AdminDashboardComponent } from './pages/dashboards/role-dashboards/admin-dashboard/admin-dashboard.component';
import { ManagerDashboardComponent } from './pages/dashboards/role-dashboards/manager-dashboard/manager-dashboard.component';
import { StockManagerDashboardComponent } from './pages/dashboards/role-dashboards/stock-manager-dashboard/stock-manager-dashboard.component';
import { TechnicianDashboardComponent } from './pages/dashboards/role-dashboards/technician-dashboard/technician-dashboard.component';

export const routes: Routes = [
  // ── Public marketing site (home/features/how-it-works/demo/contact) ────
  // Relocated to its own deployable project (sentinel-marketing) — see
  // environment.marketingUrl for where it's hosted. Not part of this app.

  // ── Convenience alias ──────────────────────────────────────────
  {
    path: 'login',
    redirectTo: 'auth/login',
    pathMatch: 'full',
  },

  // ── Auth routes (no layout) ────────────────────────────────────
  {
    path: 'auth',
    children: [
      {
        path: 'login',
        component: LoginComponent,
        canActivate: [redirectLoggedInGuard],
      },
      {
        // Face enrollment — only accessible when already authenticated
        // (user passed credentials in step 1 but has no face yet)
        path: 'face-enroll',
        loadComponent: () =>
          import('./pages/auth/face-enroll.component').then(
            (m) => m.FaceEnrollComponent
          ),
        canActivate: [authGuard],
      },
      {
        // Standalone face-only login (kept for future use / deep-link)
        path: 'face-login',
        loadComponent: () =>
          import('./pages/auth/face-login.component').then(
            (m) => m.FaceLoginComponent
          ),
        canActivate: [redirectLoggedInGuard],
      },
    ],
  },

  // ── Error / utility pages ──────────────────────────────────────
  {
    path: 'access-denied',
    component: AccessDeniedComponent,
    canActivate: [authGuard],
  },
  {
    path: 'unauthorized',
    component: AccessDeniedComponent,
    canActivate: [authGuard],
  },

  // ── Main application (with layout) ────────────────────────────
  {
    path: '',
    component: SentinelLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        redirectTo: 'dashboards/admin',
        pathMatch: 'full',
      },
      {
        path: 'dashboards',
        children: [
          {
            path: 'super-admin',
            component: SuperAdminDashboardComponent,
            canActivate: [dataRoleGuard],
            data: { requiredRoles: ['SUPER_ADMIN'] },
          },
          {
            path: 'admin',
            component: AdminDashboardComponent,
            canActivate: [dataRoleGuard],
            data: { requiredRoles: ['ADMIN', 'SUPER_ADMIN'] },
          },
          {
            path: 'finance',
            loadComponent: () =>
              import('./pages/finance/dashboard/finance-dashboard.component').then(
                (m) => m.FinanceDashboardComponent
              ),
            canActivate: [dataRoleGuard],
            data: { requiredRoles: ['FINANCE_MANAGER', 'ADMIN', 'SUPER_ADMIN'] },
          },
          {
            path: 'manager',
            component: ManagerDashboardComponent,
            canActivate: [dataRoleGuard],
            data: { requiredRoles: ['MANAGER', 'ADMIN', 'SUPER_ADMIN'] },
          },
          {
            path: 'stock-manager',
            component: StockManagerDashboardComponent,
            canActivate: [dataRoleGuard],
            data: { requiredRoles: ['STOCK_MANAGER', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'] },
          },
          {
            path: 'technician',
            component: TechnicianDashboardComponent,
            canActivate: [dataRoleGuard],
            data: { requiredRoles: ['TECHNICIAN', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'] },
          },
        ],
      },
      {
        path: 'chatbot',
        component: ChatbotComponent,
        data: { requiredRoles: [] },
      },
      {
        path: 'ai-assistant',
        component: NlpDashboardComponent,
        data: { requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'DATA_SCIENTIST', 'TECHNICIAN'] },
        canActivate: [dataRoleGuard],
      },
      {
        path: 'ai-risk-overview',
        component: NlpDashboardComponent,
        data: { requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'DATA_SCIENTIST', 'TECHNICIAN'] },
        canActivate: [dataRoleGuard],
      },
      {
        path: 'nlp-dashboard',
        redirectTo: 'ai-assistant',
        pathMatch: 'full',
      },
      {
        path: 'notifications',
        loadComponent: () =>
          import('./pages/notifications/notifications-page.component').then(
            (m) => m.NotificationsPageComponent
          ),
        canActivate: [authGuard],
        data: { requiredRoles: [] },
      },
      {
        path: 'stock-notifications',
        loadComponent: () =>
          import('./pages/stock-notifications/stock-notifications.component').then(
            (m) => m.StockNotificationsComponent
          ),
        canActivate: [authGuard],
        data: { requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'STOCK_MANAGER'] },
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./pages/profile/profile.component').then(
            (m) => m.ProfileComponent
          ),
        canActivate: [authGuard],
        data: { requiredRoles: [] },
      },
      {
        path: 'equipment',
        component: EquipmentComponent,
        data: { requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TECHNICIAN', 'VIEWER'] },
        canActivate: [dataRoleGuard],
      },
      {
        path: 'equipment/:id/visual',
        loadComponent: () =>
          import('./pages/equipment/machine-visualization.component').then(
            (m) => m.MachineVisualizationComponent
          ),
        data: { requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TECHNICIAN', 'VIEWER', 'FINANCE_MANAGER'] },
        canActivate: [dataRoleGuard],
      },
      {
        path: 'equipment/:id/passport',
        loadComponent: () =>
          import('./pages/equipment/machine-passport.component').then(
            (m) => m.MachinePassportComponent
          ),
        data: { requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TECHNICIAN', 'VIEWER', 'FINANCE_MANAGER', 'STOCK_MANAGER'] },
        canActivate: [dataRoleGuard],
      },
      {
        path: 'maintenance',
        component: MaintenanceComponent,
        data: { requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TECHNICIAN'] },
        canActivate: [dataRoleGuard],
      },
      {
        path: 'alerts',
        component: AlertsComponent,
        data: { requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'DATA_SCIENTIST', 'TECHNICIAN'] },
        canActivate: [dataRoleGuard],
      },
      {
        path: 'predictive-dashboard',
        loadComponent: () =>
          import('./pages/predictive-dashboard/predictive-dashboard.component').then(
            (m) => m.PredictiveDashboardComponent
          ),
        data: { requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'DATA_SCIENTIST', 'TECHNICIAN'] },
        canActivate: [dataRoleGuard],
      },
      {
        path: 'recommendations',
        loadComponent: () =>
          import('./pages/recommendation/recommendation-history.component').then(
            (m) => m.RecommendationHistoryComponent
          ),
        data: { requiredRoles: ['FINANCE_MANAGER', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'] },
        canActivate: [dataRoleGuard],
      },
      {
        path: 'recommendations/:machineId',
        component: RecommendationPageComponent,
        data: { requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TECHNICIAN', 'DATA_SCIENTIST', 'FINANCE_MANAGER'] },
        canActivate: [dataRoleGuard],
      },
      {
        path: 'portal-admin',
        loadComponent: () =>
          import('./pages/portal-admin/portal-admin.component').then(
            (m) => m.PortalAdminComponent
          ),
        data: { requiredRoles: ['ADMIN', 'SUPER_ADMIN', 'FINANCE_MANAGER'] },
        canActivate: [dataRoleGuard],
      },
      {
        path: 'maintenance/:id',
        loadComponent: () =>
          import('./pages/maintenance/maintenance-detail-page.component').then(
            (m) => m.MaintenanceDetailPageComponent
          ),
        data: { requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TECHNICIAN'] },
        canActivate: [dataRoleGuard],
      },
      {
        path: 'technician-calendar',
        loadComponent: () =>
          import('./pages/technician-calendar/technician-calendar.component')
            .then(m => m.TechnicianCalendarComponent),
      },

      // STOCK_MANAGER + MANAGER + ADMIN
      {
        path: 'inventory',
        children: [
          {
            path: '',
            component: InventoryComponent,
            data: { requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'STOCK_MANAGER', 'MANAGER'] },
            canActivate: [dataRoleGuard],
          },
          {
            path: 'parts',
            component: PartsListComponent,
            data: { requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'STOCK_MANAGER', 'MANAGER'] },
            canActivate: [dataRoleGuard],
          },
          {
            path: 'reorders',
            component: ReorderRequestsComponent,
            data: { requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'STOCK_MANAGER', 'MANAGER', 'FINANCE_MANAGER'] },
            canActivate: [dataRoleGuard],
          },
          {
            path: 'stock-orders',
            component: StockOrdersComponent,
            data: { requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'STOCK_MANAGER', 'MANAGER'] },
            canActivate: [dataRoleGuard],
          },
          {
            path: 'analytics',
            component: InventoryAnalyticsComponent,
            data: { requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'STOCK_MANAGER', 'MANAGER'] },
            canActivate: [dataRoleGuard],
          },
          {
            path: 'part-detail/:id',
            component: PartDetailComponent,
            data: { requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'STOCK_MANAGER', 'MANAGER'] },
            canActivate: [dataRoleGuard],
          },
          {
            path: 'part-form',
            component: PartFormComponent,
            data: { requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'STOCK_MANAGER'] },
            canActivate: [dataRoleGuard],
          },
          {
            path: 'part-form/:id',
            component: PartFormComponent,
            data: { requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'STOCK_MANAGER'] },
            canActivate: [dataRoleGuard],
          },
          {
            path: 'categories',
            component: CategoriesComponent,
            data: { requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'STOCK_MANAGER'] },
            canActivate: [dataRoleGuard],
          },
          {
            path: 'suppliers',
            loadComponent: () =>
              import('./pages/inventory/suppliers/suppliers.component').then(
                (m) => m.SuppliersComponent
              ),
            data: { requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'STOCK_MANAGER', 'MANAGER'] },
            canActivate: [dataRoleGuard],
          },
          {
            path: 'demand-forecast',
            loadComponent: () =>
              import('./pages/inventory/demand-forecast/demand-forecast.component').then(
                (m) => m.DemandForecastComponent
              ),
            data: { requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'STOCK_MANAGER', 'MANAGER'] },
            canActivate: [dataRoleGuard],
          },
        ],
      },

      // MANAGER + ADMIN
      {
        path: 'budgets',
        component: BudgetOverviewComponent,
        data: { requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'FINANCE_MANAGER'] },
        canActivate: [dataRoleGuard],
      },

      // ADMIN / SUPER_ADMIN: full access. MANAGER: scoped to technician accounts only
      // (enforced inside UserManagementComponent via isTechnicianScoped).
      {
        path: 'user-management',
        loadComponent: () =>
          import('./pages/user-management/user-management.component').then(
            (m) => m.UserManagementComponent
          ),
        data: { requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
        canActivate: [dataRoleGuard],
      },
      // Contact/demo-request inbox fed by the public marketing site.
      {
        path: 'inquiries',
        loadComponent: () =>
          import('./pages/inquiries/inquiries.component').then(
            (m) => m.InquiriesComponent
          ),
        data: { requiredRoles: ['SUPER_ADMIN', 'ADMIN'] },
        canActivate: [dataRoleGuard],
      },
      // TEAM CAPACITY — scheduling/capacity-planning folded into Manager
      // rather than a separate Maintenance Planner role.
      {
        path: 'team-capacity',
        loadComponent: () =>
          import('./pages/team-capacity/team-capacity.component').then(
            (m) => m.TeamCapacityComponent
          ),
        canActivate: [dataRoleGuard],
        data: { requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
      },
      // RELIABILITY — MTBF/MTTR + root-cause tracking, folded into Manager
      // rather than a separate Reliability Engineer role.
      {
        path: 'reliability',
        loadComponent: () =>
          import('./pages/reliability/reliability.component').then(
            (m) => m.ReliabilityComponent
          ),
        canActivate: [dataRoleGuard],
        data: { requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
      },
      // AUDIT CONSOLE — Super Admin / Admin governance log (extends Super
      // Admin's role rather than a separate Auditor role).
      {
        path: 'audit-console',
        loadComponent: () =>
          import('./pages/audit-console/audit-console.component').then(
            (m) => m.AuditConsoleComponent
          ),
        canActivate: [dataRoleGuard],
        data: { requiredRoles: ['SUPER_ADMIN', 'ADMIN'] },
      },
      {
        path: 'inventory/reservations',
        loadComponent: () =>
          import('./pages/inventory/reservations/reservations.component').then(
            (m) => m.ReservationsComponent
          ),
        canActivate: [dataRoleGuard],
        data: { requiredRoles: ['TECHNICIAN', 'MANAGER', 'STOCK_MANAGER', 'ADMIN', 'SUPER_ADMIN'] },
      },
      {
        path: 'export-center',
        loadComponent: () =>
          import('./pages/export-center/export-center.component').then(
            (m) => m.ExportCenterComponent
          ),
        canActivate: [dataRoleGuard],
        data: { requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TECHNICIAN', 'STOCK_MANAGER', 'FINANCE_MANAGER'] },
      },
      {
        path: 'work-order-templates',
        loadComponent: () =>
          import('./pages/work-order-templates/work-order-templates.component').then(
            (m) => m.WorkOrderTemplatesComponent
          ),
        canActivate: [dataRoleGuard],
        data: { requiredRoles: ['MANAGER', 'ADMIN', 'SUPER_ADMIN'] },
      },
      // CUSTOMER PORTAL — row-level scoped to the authenticated customer's
      // own linked machines (enforced server-side, see PortalAccessService).
      {
        path: 'portal',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./pages/portal/portal-home/portal-home.component').then(
                (m) => m.PortalHomeComponent
              ),
            canActivate: [dataRoleGuard],
            data: { requiredRoles: ['CUSTOMER'] },
          },
          {
            path: 'tickets',
            loadComponent: () =>
              import('./pages/portal/portal-tickets/portal-tickets.component').then(
                (m) => m.PortalTicketsComponent
              ),
            canActivate: [dataRoleGuard],
            data: { requiredRoles: ['CUSTOMER'] },
          },
          {
            path: 'machines/:id',
            loadComponent: () =>
              import('./pages/portal/portal-machine-detail/portal-machine-detail.component').then(
                (m) => m.PortalMachineDetailComponent
              ),
            canActivate: [dataRoleGuard],
            data: { requiredRoles: ['CUSTOMER'] },
          },
          {
            path: 'billing',
            loadComponent: () =>
              import('./pages/portal/portal-billing/portal-billing.component').then(
                (m) => m.PortalBillingComponent
              ),
            canActivate: [dataRoleGuard],
            data: { requiredRoles: ['CUSTOMER'] },
          },
        ],
      },
      {
        path: 'finance',
        children: [
          { path: '', redirectTo: 'expenses', pathMatch: 'full' },
          {
            path: 'expenses',
            loadComponent: () =>
              import('./pages/finance/expenses/expenses.component').then(
                (m) => m.ExpensesComponent
              ),
            canActivate: [dataRoleGuard],
            data: { requiredRoles: ['FINANCE_MANAGER', 'ADMIN', 'SUPER_ADMIN'] },
          },
          {
            path: 'budget',
            loadComponent: () =>
              import('./pages/finance/budget/budget.component').then(
                (m) => m.BudgetComponent
              ),
            canActivate: [dataRoleGuard],
            data: { requiredRoles: ['FINANCE_MANAGER', 'ADMIN', 'SUPER_ADMIN'] },
          },
          {
            path: 'dashboard',
            loadComponent: () =>
              import('./pages/finance/dashboard/finance-dashboard.component').then(
                (m) => m.FinanceDashboardComponent
              ),
            canActivate: [dataRoleGuard],
            data: { requiredRoles: ['FINANCE_MANAGER', 'ADMIN', 'SUPER_ADMIN'] },
          },
          {
            path: 'rapports',
            loadComponent: () =>
              import('./pages/rapports/rapport-approvals.component').then(
                (m) => m.RapportApprovalsComponent
              ),
            canActivate: [dataRoleGuard],
            data: { requiredRoles: ['FINANCE_MANAGER', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'] },
          },
          {
            path: 'maintenance-costs',
            loadComponent: () =>
              import('./pages/maintenance-costs/maintenance-costs.component').then(
                (m) => m.MaintenanceCostsComponent
              ),
            canActivate: [dataRoleGuard],
            data: { requiredRoles: ['FINANCE_MANAGER', 'ADMIN', 'SUPER_ADMIN'] },
          },
        ],
      },

      // ── Unmatched path within the authenticated shell ────────────
      // Rendered inside SentinelLayoutComponent (sidebar/header stay visible)
      // instead of silently bouncing an authenticated user back to /auth/login.
      {
        path: '**',
        loadComponent: () =>
          import('./pages/not-found/not-found.component').then(
            (m) => m.NotFoundComponent
          ),
      },
    ],
  },

  // ── Catch-all (unauthenticated / no layout matched) ─────────────
  {
    path: '**',
    redirectTo: 'auth/login',
  },
];

import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { redirectLoggedInGuard } from './core/guards/redirect-logged-in.guard';
import { dataRoleGuard } from './core/guards/role.guard';
import { SentinelLayoutComponent } from './layout/sentinel-layout.component';
import { LoginComponent } from './pages/auth/login.component';
import { RegisterComponent } from './pages/auth/register.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { EquipmentComponent } from './pages/equipment/equipment.component';
import { MaintenanceComponent } from './pages/maintenance/maintenance.component';
import { AlertsComponent } from './pages/alerts/alerts.component';
import { AccessDeniedComponent } from './pages/access-denied/access-denied.component';
import { InventoryComponent } from './pages/inventory/inventory.component';
import { PartFormComponent } from './pages/inventory/part-form/part-form.component';
import { PartDetailComponent } from './pages/inventory/part-detail/part-detail.component';
import { CategoriesComponent } from './pages/inventory/categories/categories.component';
import { ChatbotComponent } from './pages/chatbot/chatbot.component';
import { PredictiveDashboardComponent } from './pages/predictive-dashboard/predictive-dashboard.component';
import { RecommendationPageComponent } from './pages/recommendation/recommendation-page.component';
import { BudgetOverviewComponent } from './components/budget-overview/budget-overview.component';

export const routes: Routes = [
  {
    path: 'auth',
    children: [
      {
        path: 'login',
        component: LoginComponent,
        canActivate: [redirectLoggedInGuard],
      },
      {
        path: 'register',
        component: RegisterComponent,
        canActivate: [redirectLoggedInGuard],
      },
      {
        path: 'face-login',
        loadComponent: () =>
          import('./pages/auth/face-login.component').then(
            (m) => m.FaceLoginComponent
          ),
        canActivate: [redirectLoggedInGuard],
      },
    ],
  },
  {
    path: 'access-denied',
    component: AccessDeniedComponent,
    canActivate: [authGuard],
  },
  {
    path: '',
    component: SentinelLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        component: DashboardComponent,
        data: { requiredRoles: [] },
      },
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'equipment',
        component: EquipmentComponent,
        data: { requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TECHNICIAN', 'VIEWER'] },
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
        data: { requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'DATA_SCIENTIST'] },
        canActivate: [dataRoleGuard],
      },
      {
        path: 'inventory',
        component: InventoryComponent,
        data: { requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'STOCK_MANAGER', 'MANAGER'] },
        canActivate: [dataRoleGuard],
      },
      {
        path: 'chatbot',
        component: ChatbotComponent,
        data: { requiredRoles: [] },
      },
      {
        path: 'predictive-dashboard',
        component: PredictiveDashboardComponent,
        data: { requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TECHNICIAN', 'VIEWER', 'DATA_SCIENTIST'] },
        canActivate: [dataRoleGuard],
      },
      {
        path: 'recommendations',
        component: RecommendationPageComponent,
        data: { requiredRoles: [] },
      },
      {
        path: 'recommendations/:machineId',
        component: RecommendationPageComponent,
        data: { requiredRoles: [] },
      },
      {
        path: 'budgets',
        component: BudgetOverviewComponent,
        data: { requiredRoles: [] },
      },
      {
        path: 'inventory/part-detail/:id',
        component: PartDetailComponent,
        data: { requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'STOCK_MANAGER', 'MANAGER'] },
        canActivate: [dataRoleGuard],
      },
      {
        path: 'inventory/part-form',
        component: PartFormComponent,
        data: { requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'STOCK_MANAGER', 'MANAGER'] },
        canActivate: [dataRoleGuard],
      },
      {
        path: 'inventory/part-form/:id',
        component: PartFormComponent,
        data: { requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'STOCK_MANAGER', 'MANAGER'] },
        canActivate: [dataRoleGuard],
      },
      {
        path: 'inventory/categories',
        component: CategoriesComponent,
        data: { requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'STOCK_MANAGER', 'MANAGER'] },
        canActivate: [dataRoleGuard],
      },
      {
        path: 'equipment/:id/visual',
        loadComponent: () =>
          import('./pages/equipment/machine-visualization.component').then(
            (m) => m.MachineVisualizationComponent
          ),
        data: { requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TECHNICIAN', 'VIEWER'] },
        canActivate: [dataRoleGuard],
      },
      {
        path: 'user-management',
          loadComponent: () => import('./pages/user-management/user-management.component').then(m => m.UserManagementComponent),
        data: { requiredRoles: ['SUPER_ADMIN'] },
        canActivate: [dataRoleGuard],
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
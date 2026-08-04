import { ApplicationConfig } from '@angular/core';
import { importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import {
  provideHttpClient,
  HTTP_INTERCEPTORS,
  withFetch,
  withInterceptors,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { LucideAngularModule } from 'lucide-angular';

import { routes } from './app.routes';
import { AuthInterceptor } from './core/http/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { INVENTORY_ICONS } from './pages/inventory/inventory-analytics/lucide-icons';
import { AUTH_ICONS } from './pages/auth/auth-icons';
import { MANAGER_DASHBOARD_ICONS } from './pages/dashboards/role-dashboards/manager-dashboard/manager-dashboard-icons';
import { DIGITAL_TWIN_ICONS } from './pages/equipment/digital-twin/digital-twin-icons';
import { SIDEBAR_ICONS } from './layout/sidebar-icons';
import { MAINTENANCE_ICONS } from './pages/maintenance/maintenance-icons';
import { FINANCE_ICONS } from './pages/finance/dashboard/finance-icons';
import { MAINTENANCE_COSTS_ICONS } from './pages/maintenance-costs/maintenance-costs-icons';
import { CHATBOT_ICONS } from './pages/chatbot/chatbot-icons';
import { INQUIRIES_ICONS } from './pages/inquiries/inquiries-icons';
import { USER_MANAGEMENT_ICONS } from './pages/user-management/user-management-icons';
import { PARTS_LIST_ICONS } from './pages/inventory/parts-list/parts-list-icons';
import { BUDGET_ICONS } from './pages/finance/budget/budget-icons';
import { STOCK_NOTIFICATIONS_ICONS } from './pages/stock-notifications/stock-notifications-icons';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([errorInterceptor]), withInterceptorsFromDi()),
    provideAnimations(),
    importProvidersFrom(MatSnackBarModule),
    importProvidersFrom(LucideAngularModule.pick(INVENTORY_ICONS)),
    importProvidersFrom(LucideAngularModule.pick(AUTH_ICONS)),
    importProvidersFrom(LucideAngularModule.pick(MANAGER_DASHBOARD_ICONS)),
    importProvidersFrom(LucideAngularModule.pick(DIGITAL_TWIN_ICONS)),
    importProvidersFrom(LucideAngularModule.pick(SIDEBAR_ICONS)),
    importProvidersFrom(LucideAngularModule.pick(MAINTENANCE_ICONS)),
    importProvidersFrom(LucideAngularModule.pick(FINANCE_ICONS)),
    importProvidersFrom(LucideAngularModule.pick(MAINTENANCE_COSTS_ICONS)),
    importProvidersFrom(LucideAngularModule.pick(CHATBOT_ICONS)),
    importProvidersFrom(LucideAngularModule.pick(INQUIRIES_ICONS)),
    importProvidersFrom(LucideAngularModule.pick(USER_MANAGEMENT_ICONS)),
    importProvidersFrom(LucideAngularModule.pick(PARTS_LIST_ICONS)),
    importProvidersFrom(LucideAngularModule.pick(BUDGET_ICONS)),
    importProvidersFrom(LucideAngularModule.pick(STOCK_NOTIFICATIONS_ICONS)),
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true,
    },
  ],
};
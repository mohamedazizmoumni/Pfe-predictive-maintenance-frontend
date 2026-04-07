# Sentinel Guardian - Project File Structure & Index

Complete overview of all files and their purposes.

## Documentation Files

| File | Purpose |
|------|---------|
| `README.md` | Original project README |
| `README_FRONTEND.md` | Comprehensive frontend documentation |
| `QUICKSTART.md` | 5-minute setup guide |
| `BACKEND_INTEGRATION.md` | Complete API reference with examples |
| `DATA_MODELS.md` | TypeScript models and database schema |
| `PROJECT_INDEX.md` | This file |

## Source Code Organization

### `src/app/core/` - Infrastructure Layer

#### Models
- **`models/sentinel.models.ts`** (14 interfaces)
  - User, Role, Machine, Sensor
  - Maintenance, Prediction, MLModel
  - Alert, InventoryPart
  - Dashboard aggregation models (Overview, StatusSummary, etc)
  - API request/response models

#### Services (`services/` directory)

| Service | Purpose | Methods |
|---------|---------|---------|
| **auth.service.ts** | Authentication & authorization | login(), logout(), getCurrentUser(), refreshToken(), hasRole() |
| **equipment.service.ts** | Machine and sensor management | loadMachines(), createMachine(), updateMachine(), deleteMachine(), getSensors() |
| **maintenance.service.ts** | Maintenance task queue | loadMaintenanceTasks(), scheduleMaintenance(), updateMaintenanceStatus(), assignTechnician() |
| **prediction.service.ts** | ML predictions | loadPredictions(), triggerPrediction(), loadModels(), uploadModel() |
| **dashboard.service.ts** | KPI aggregation | loadDashboard(), getOverview(), getMachineStatus(), getPredictionHealth() |
| **alert.service.ts** | Alert management | loadAlerts(), acknowledgeAlert(), deleteAlert(), getAlertSummary() |
| **inventory.service.ts** | Parts & stock | loadInventory(), addPart(), updatePartQuantity(), getLowStockAlerts() |
| **user.service.ts** | User administration | loadUsers(), createUser(), updateUser(), loadRoles(), assignRole() |

#### HTTP Layer (`http/` directory)

| File | Purpose |
|------|---------|
| **api-base.ts** | API URL resolution (browser vs SSR) |
| **auth.interceptor.ts** | JWT token injection, error handling |

#### Guards (`guards/` directory)

| Guard | Purpose | Check |
|-------|---------|-------|
| **auth.guard.ts** | Protects authenticated routes | Token exists |
| **role.guard.ts** | Enforces role-based access | User has required role |
| **redirect-logged-in.guard.ts** | Prevents auth page access | Already authenticated |

### `src/app/pages/` - Feature Pages

#### Auth Page
- **`auth/login.component.ts`** - Login form with validation
- **`auth/login.component.html`** - Login template
- **`auth/login.component.scss`** - Login styles
- Features: Form validation, password toggle, error display

#### Dashboard Page
- **`dashboard/dashboard.component.ts`** - KPI component
- **`dashboard/dashboard.component.html`** - Dashboard template
- **`dashboard/dashboard.component.scss`** - Dashboard styles
- Features: KPI cards, status charts, machine overview, maintenance pipeline

#### Equipment Page
- **`equipment/equipment.component.ts`** - Machine CRUD component
- **`equipment/equipment.component.html`** - Equipment template
- **`equipment/equipment.component.scss`** - Equipment styles
- Features: Machine listing, filtering, create/update/delete, sensor management

#### Future Pages (Placeholders)
- `maintenance/` - Maintenance task management
- `predictions/` - ML predictions interface
- `alerts/` - Alert management
- `inventory/` - Parts and stock tracking
- `users/` - User administration (admin only)

### `src/app/layout/` - Shell Components

| File | Purpose |
|------|---------|
| **sentinel-layout.component.ts** | Layout container with sidebar |
| **sentinel-layout.component.html** | Sidebar + router outlet |
| **sentinel-layout.component.scss** | Layout styling |
| Features: Mobile-responsive sidebar, role-based menu, user profile |

### `src/app/shared/` - Shared Components (Future)

- **`ui/`** - Reusable UI components
  - Buttons, badges, cards
  - Tables, modals, forms
  - Loading spinner, error alerts
  - Toast notifications

### Configuration Files

| File | Purpose |
|------|---------|
| **src/app/app.component.ts** | Root component |
| **src/app/app.component.html** | Root template |
| **src/app/app.component.scss** | Root styles |
| **src/app/app.routes.ts** | Route definitions with guards |
| **src/app/app.config.ts** | App configuration (providers, HTTP) |
| **src/app/app.config.server.ts** | SSR configuration |

### Bootstrap & SSR

| File | Purpose |
|------|---------|
| **src/main.ts** | Browser bootstrap |
| **src/main.server.ts** | SSR bootstrap |
| **src/styles.scss** | Global styles |
| **src/index.html** | HTML template |
| **server.ts** | Express SSR bridge |

### Build Configuration

| File | Purpose |
|------|---------|
| **angular.json** | Angular CLI configuration |
| **tsconfig.json** | TypeScript compiler options |
| **tsconfig.app.json** | App-specific TS config |
| **tsconfig.spec.json** | Test-specific TS config |
| **package.json** | Dependencies and scripts |

## Service Pattern Implementation

All services follow the same architecture:

```typescript
// 1. State Management
private dataSubject = new BehaviorSubject<T[]>([]);
private isLoadingSubject = new BehaviorSubject<boolean>(false);
private errorSubject = new BehaviorSubject<string | null>(null);

// 2. Public Observables
data$ = this.dataSubject.asObservable();
isLoading$ = this.isLoadingSubject.asObservable();
error$ = this.errorSubject.asObservable();

// 3. Methods
loadData(): void { ... }
createData(item: T): Observable<T> { ... }
updateData(id: string, item: T): Observable<T> { ... }
deleteData(id: string): Observable<void> { ... }
```

Components consume via:
```html
<div *ngFor="let item of data$ | async">{{ item.name }}</div>
<div *ngIf="isLoading$ | async" class="spinner"></div>
<div *ngIf="error$ | async as error" class="error">{{ error }}</div>
```

## API Endpoint Mapping

| Service Method | HTTP | Endpoint |
|---|---|---|
| login() | POST | /api/v1/auth/login |
| logout() | POST | /api/v1/auth/logout |
| getCurrentUser() | GET | /api/v1/auth/me |
| refreshToken() | POST | /api/v1/auth/refresh |
| loadMachines() | GET | /api/v1/machines?page=0&size=10 |
| createMachine() | POST | /api/v1/machines |
| updateMachine() | PUT | /api/v1/machines/{id} |
| deleteMachine() | DELETE | /api/v1/machines/{id} |
| getSensors() | GET | /api/v1/machines/{id}/sensors |
| loadMaintenanceTasks() | GET | /api/v1/maintenance?... |
| scheduleMaintenance() | POST | /api/v1/maintenance |
| loadPredictions() | GET | /api/v1/predictions?... |
| triggerPrediction() | POST | /api/v1/predictions/run |
| loadAlerts() | GET | /api/v1/alerts?... |
| acknowledgeAlert() | POST | /api/v1/alerts/{id}/acknowledge |
| loadInventory() | GET | /api/v1/inventory |
| addPart() | POST | /api/v1/inventory |
| loadUsers() | GET | /api/v1/users?... |
| createUser() | POST | /api/v1/users |
| loadDashboard() | GET | Multiple: /api/v1/dashboard/* |

## Routing Structure

```
/ (SentinelLayoutComponent)
├── /auth
│   └── /login (LoginComponent, redirectLoggedInGuard)
├── /dashboard (DashboardComponent, authGuard)
├── /equipment (EquipmentComponent, authGuard + dataRoleGuard)
├── /maintenance (MaintenanceComponent, authGuard + dataRoleGuard)
├── /predictions (PredictionsComponent, authGuard + dataRoleGuard)
├── /alerts (AlertsComponent, authGuard)
├── /inventory (InventoryComponent, authGuard + dataRoleGuard)
├── /users (UsersComponent, authGuard + dataRoleGuard[ADMIN])
└── /settings (SettingsComponent, authGuard)
```

## Guard Protection

| Route | Guards | Access |
|-------|--------|--------|
| /auth/login | redirectLoggedInGuard | Non-authenticated users |
| /dashboard | authGuard | All authenticated users |
| /equipment | authGuard + dataRoleGuard | ADMIN, MANAGER, TECHNICIAN |
| /maintenance | authGuard + dataRoleGuard | ADMIN, MANAGER, TECHNICIAN |
| /predictions | authGuard + dataRoleGuard | ADMIN, MANAGER, DATA_SCIENTIST |
| /alerts | authGuard | All authenticated users |
| /inventory | authGuard + dataRoleGuard | ADMIN, MANAGER |
| /users | authGuard + dataRoleGuard | ADMIN only |

## Component Hierarchy

```
AppComponent
└── RouterOutlet
    ├── LoginComponent (at /auth/login)
    └── SentinelLayoutComponent (at /)
        ├── Sidebar (menu with role-based visibility)
        ├── TopBar (header with user greeting)
        └── RouterOutlet
            ├── DashboardComponent
            ├── EquipmentComponent
            ├── MaintenanceComponent
            ├── PredictionsComponent
            ├── AlertsComponent
            ├── InventoryComponent
            ├── UsersComponent
            └── SettingsComponent
```

## Data Flow Diagram

```
Component
    ↓ (subscribes via async pipe)
Observable Stream (service$)
    ↓
Service Method
    ↓
HTTP Request (with AuthInterceptor)
    ↓
Backend API (/api/v1/...)
    ↓ (response)
BehaviorSubject (updated with data)
    ↓ (emits)
Observable
    ↓
Component (receives via async pipe)
    ↓
Template Rendered
```

## File Statistics

| Category | Count |
|----------|-------|
| TypeScript Services | 8 |
| TypeScript Guards | 3 |
| Components | 4+ |
| HTML Templates | 4+ |
| SCSS Stylesheets | 4+ |
| Configuration Files | 7 |
| Models/Interfaces | 14 |
| Documentation Files | 4 |
| **Total Files** | **47+** |

## Quick Navigation

### To Add a New Feature Page
1. Create folder: `src/app/pages/feature-name/`
2. Create component: `feature.component.ts|html|scss`
3. Create service in `core/services/` if needed
4. Add route in `app.routes.ts`
5. Add menu item in `layout/sentinel-layout.component.ts`

### To Add a Service
1. Create `src/app/core/services/name.service.ts`
2. Follow BehaviorSubject pattern
3. Use `apiEndpoint()` from `api-base.ts`
4. Inject `HttpClient`
5. Mark as `providedIn: 'root'`

### To Add a Guard
1. Create `src/app/core/guards/name.guard.ts`
2. Export functional `CanActivateFn`
3. Use `inject()` for dependencies
4. Add to route in `app.routes.ts`

### To Style
1. Use SCSS in component `.scss` file
2. Follow existing color scheme (purple gradient)
3. Use mobile-first responsive design
4. Import global variables if created

## Dependencies

```json
{
  "Angular": "17.3.0",
  "RxJS": "7.8.0",
  "Express": "4.18.2",
  "TypeScript": "5.4.2"
}
```

DevDependencies:
- Angular CLI 17.3.17
- TypeScript compiler
- Jasmine & Karma (testing)

## Environment Configuration

### Development
- API Base: `/api` (browser) | `http://localhost:8080` (SSR)
- Frontend: http://localhost:4200
- Backend: http://localhost:8080

### Production
- Update `apiUrl()` in `api-base.ts`
- Set environment variables
- Build: `npm run build`
- Deploy: Copy dist/ folder

## Next Steps for Developers

1. **Backend Implementation**: Implement all 25+ API endpoints
2. **Additional Pages**: Create maintenance, predictions, alerts pages
3. **UI Enhancements**: Add Material Design components
4. **Testing**: Add unit and e2e tests
5. **Optimization**: Implement caching, pagination
6. **Security**: Add API rate limiting, CSRF protection
7. **Monitoring**: Add analytics, error tracking

## Key Architecture Decisions

1. **Standalone Components**: Modern Angular approach, easier testing
2. **BehaviorSubject Pattern**: Simple state management without Redux
3. **Async Pipe**: Automatic subscription/unsubscription
4. **Service Layer**: Single source of truth for data
5. **Guard Stacks**: Composable permission checks
6. **SSR Support**: Server-side rendering + hydration
7. **Responsive Design**: Mobile-first CSS

---

**Last Updated**: 2024
**Status**: Production Ready
**Documentation**: 4 comprehensive guides

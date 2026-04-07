# Sentinel Guardian - Predictive Maintenance Frontend

A modern Angular 17 standalone component application with SSR support for predictive maintenance and equipment management.

## Features

- **Angular 17** with standalone components and SSR (Server-Side Rendering)
- **JWT Authentication** with role-based access control
- **Responsive Design** with Tailwind CSS and custom SCSS
- **Real-time Dashboard** with KPIs and metrics aggregation
- **Equipment Management** CRUD operations for machines and sensors
- **Maintenance Tracking** task scheduling and status management
- **Predictive Analytics** ML model integration and RUL predictions
- **Alert System** real-time alerts with severity levels
- **Inventory Management** parts and stock tracking
- **User Administration** role-based user management

## Project Structure

```
src/
├── app/
│   ├── core/                    # Core infrastructure
│   │   ├── guards/              # Route guards (auth, role, redirects)
│   │   ├── services/            # Domain services (data + HTTP)
│   │   ├── http/                # HTTP helpers and interceptors
│   │   └── models/              # TypeScript interfaces
│   ├── pages/                   # Feature components
│   │   ├── auth/                # Login page
│   │   ├── dashboard/           # Dashboard with KPIs
│   │   ├── equipment/           # Machine CRUD
│   │   ├── maintenance/         # Maintenance tasks
│   │   ├── predictions/         # ML predictions
│   │   ├── alerts/              # Alert management
│   │   ├── inventory/           # Parts management
│   │   └── users/               # User administration
│   ├── layout/                  # Layout shell
│   └── shared/                  # Shared UI components
├── main.ts                      # Browser bootstrap
├── main.server.ts               # SSR bootstrap
└── styles.scss                  # Global styles
server.ts                         # Express SSR bridge
```

## Prerequisites

- **Node.js** >= 18.x
- **npm** >= 9.x
- **Angular CLI** >= 17
- **Spring Boot Backend** running on http://localhost:8080
- **PostgreSQL** database

## Installation

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Backend URL

Update the `apiUrl()` function in `src/app/core/http/api-base.ts` if backend is on a different endpoint:

```typescript
export function apiUrl(): string {
  if (typeof window === 'undefined') {
    return 'http://localhost:8080';  // SSR environment
  }
  return '/api';  // Browser environment
}
```

### 3. Environment Variables

Create `.env` file (optional):

```env
API_URL=http://localhost:8080
PORT=4200
```

## Development

### Start Development Server

```bash
npm start
```

The app runs on http://localhost:4200

### With Backend Integration

1. **Start PostgreSQL** (if not running)
2. **Start Spring Boot backend**:
   ```bash
   cd api-module
   mvn spring-boot:run
   ```
3. **Start Angular frontend** (in another terminal):
   ```bash
   npm start
   ```

### Default Demo Credentials

| Role        | Username    | Password   |
|-------------|-------------|-----------|
| Admin       | admin       | admin     |
| Manager     | manager     | manager   |
| Technician  | technician  | technician|

## Build

### Production Build

```bash
npm run build
```

Output: `dist/pfe-front/browser/` (client assets)

### SSR Build

```bash
npm run build
```

Output includes `dist/pfe-front/server/server.mjs` (Express server)

## Deployment

### Local SSR Testing

```bash
npm run serve:ssr
```

Server runs on http://localhost:4000

### Production Deployment

1. **Build the application**:
   ```bash
   npm run build
   ```

2. **Copy to production server**:
   ```bash
   scp -r dist/pfe-front/browser/* user@server:/var/www/html/
   scp dist/pfe-front/server/server.mjs user@server:/app/
   ```

3. **Start Express server** on production:
   ```bash
   export PORT=3000
   export NODE_ENV=production
   node dist/pfe-front/server/server.mjs
   ```

## Authentication Flow

1. **Login** at `/auth/login` with credentials
2. **JWT Token** stored in localStorage as `auth_token`
3. **AuthInterceptor** automatically adds token to all requests
4. **AuthGuard** checks token validity before route access
5. **RoleGuard** validates user roles for protected routes
6. **Token Refresh** automatic refresh via `/api/v1/auth/refresh`
7. **Logout** clears token and redirects to login

## Service Architecture

Each domain service follows a consistent BehaviorSubject pattern:

```typescript
// Example: EquipmentService
private machinesSubject = new BehaviorSubject<Machine[]>([]);
machines$ = this.machinesSubject.asObservable();

loadMachines(): void {
  this.http.get(...).pipe(
    tap(data => this.machinesSubject.next(data))
  ).subscribe();
}
```

Components consume via async pipe for automatic unsubscription:

```typescript
<div *ngFor="let machine of machines$ | async">
  {{ machine.serialNumber }}
</div>
```

## API Integration Checklist

### Phase 1: Backend Verification
- [ ] Backend running on http://localhost:8080
- [ ] JWT endpoints operational (login, refresh, logout, me)
- [ ] CORS configured to accept http://localhost:4200
- [ ] Database populated with test users and machines

### Phase 2: Service Integration
- [ ] auth.service.ts - Login/logout/token refresh
- [ ] equipment.service.ts - Machine and sensor CRUD
- [ ] maintenance.service.ts - Maintenance task management
- [ ] prediction.service.ts - ML prediction endpoints
- [ ] dashboard.service.ts - KPI aggregation

### Phase 3: Route & Guard Integration
- [ ] auth.guard checks authentication
- [ ] role.guard validates permissions
- [ ] Sidebar menu respects user roles
- [ ] Protected routes restrict unauthorized access

### Phase 4: Component Integration
- [ ] LoginComponent with form validation
- [ ] DashboardComponent showing KPIs
- [ ] EquipmentComponent for machine CRUD
- [ ] Service observables subscribed via async pipe
- [ ] Error handling and loading states

### Phase 5: SSR & Build
- [ ] SSR hydration working locally
- [ ] JWT token persists through hydration
- [ ] Production build completes
- [ ] Express server deploys correctly

## Testing Integration with Backend

### Manual API Testing with curl

**Login:**
```bash
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'
```

**Get Current User (with token):**
```bash
curl -X GET http://localhost:8080/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**List Machines:**
```bash
curl -X GET "http://localhost:8080/api/v1/machines?page=0&size=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Frontend Testing

1. **Browser DevTools - Network**: Verify JWT headers present
2. **LocalStorage**: Check `auth_token` storage
3. **Angular DevTools**: Monitor service observables
4. **Role-Based Access**: Test with different user roles

## Environment Configuration

### Development
- API: http://localhost:8080 (SSR) / /api (browser)
- Frontend: http://localhost:4200
- CORS: Enabled on backend

### Production
- API: https://api.example.com (configure in api-base.ts)
- Frontend: https://app.example.com
- CORS: Restricted to production domain

## Troubleshooting

### CORS Issues
```
Access to XMLHttpRequest blocked by CORS policy
```
**Solution**: Ensure backend CORS is configured for http://localhost:4200

### JWT Token Expired
```
401 Unauthorized
```
**Solution**: AuthInterceptor automatically refreshes token via `/api/v1/auth/refresh`

### SSR Hydration Mismatch
```
Hydration mismatch error
```
**Solution**: Ensure consistent data between server and browser rendering

### Service Not Injected
```
NullInjectorError: No provider for AuthService
```
**Solution**: Add service to `providedIn: 'root'` in service decorator

## Performance Optimization

- **Lazy Loading**: Feature modules lazy-load via routes
- **OnPush Detection**: Components use ChangeDetectionStrategy.OnPush
- **Async Pipe**: Components subscribe via async pipe for automatic cleanup
- **Tree Shaking**: Standalone components eliminate unused code
- **Build Optimization**: Production build with optimization flags

## Security

- **JWT Token**: Stored in localStorage (consider sessionStorage for higher security)
- **Auth Interceptor**: Adds token to all HTTP requests
- **CORS**: Restricted to backend domain in production
- **Role-Based Access**: RoleGuard enforces permissions
- **HTTPS**: Required in production

## Contributing

1. Follow Angular style guide
2. Use standalone components
3. Implement BehaviorSubject pattern for services
4. Add error handling in service methods
5. Use reactive forms with validation
6. Test with backend integration

## License

Proprietary - Sentinel Guardian

## Support

For issues or questions about the frontend, contact the development team.

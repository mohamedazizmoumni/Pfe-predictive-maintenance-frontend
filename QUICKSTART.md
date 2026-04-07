# Sentinel Guardian - Quick Start Guide

Get the Predictive Maintenance frontend up and running in 5 minutes.

## 1. Prerequisites

Ensure you have:
- **Node.js 18+** (check: `node -v`)
- **npm 9+** (check: `npm -v`)
- **Spring Boot backend** running on http://localhost:8080
- **PostgreSQL** with `pfe` database populated

## 2. Install & Run

### Clone and Install
```bash
cd ~/OneDrive/Desktop/pfeFront
npm install
```

### Start Development Server
```bash
npm start
```

The app opens at http://localhost:4200

### Login
Use demo credentials:
- **Username**: admin
- **Password**: admin

Alternative accounts:
- manager / manager
- technician / technician

## 3. Verify Backend Integration

### Check Backend is Running
```bash
curl http://localhost:8080/api/v1/auth/me
```

Should return a 401 (not authenticated, which is expected)

### Test with Token
```bash
# 1. Get token
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq -r '.token')

# 2. Use token
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/v1/auth/me
```

Should return user info

## 4. Test Frontend Features

### Dashboard
- Navigate to http://localhost:4200/dashboard
- Should show KPIs with data from backend
- Check Network tab → should see `/api/v1/dashboard/*` calls

### Equipment
- Click "Equipment" in sidebar
- Create a new machine
- Verify POST call to `/api/v1/machines`
- Should appear in the list

### Other Features
- **Maintenance**: Manage maintenance tasks
- **Alerts**: View system alerts
- **Settings**: User preferences (placeholder)

## 5. Troubleshooting

### Frontend not connecting to backend?
```
Undefined /api/v1/... errors
```
**Check**:
1. Backend running: `curl http://localhost:8080`
2. CORS enabled on backend
3. Network tab shows request to correct URL

### Login fails?
```
{"statusCode":401,"message":"Invalid credentials"}
```
**Check**:
1. Backend has users table populated
2. Default user exists (admin/admin)
3. Backend reachable: `curl http://localhost:8080/api/v1/auth/login`

### Token not being sent?
**Check**:
1. Browser DevTools → Application → LocalStorage
2. Should have `auth_token` key
3. Network tab → Request headers → Authorization: Bearer token

### Dashboard shows no data?
**Check**:
1. Backend database has machines, sensors, etc.
2. `/api/v1/dashboard/overview` returns 200
3. Token is valid and sent with request

## 6. Common Commands

```bash
# Start frontend (development)
npm start

# Build for production
npm run build

# Run ESLint
npm run lint

# Run unit tests
npm run test

# Test SSR locally
npm run build
npm run serve:ssr

# Serve on http://localhost:4000
```

## 7. Project Structure

```
src/
├── app/
│   ├── core/              # Services, guards, models
│   ├── pages/             # Feature pages
│   ├── layout/            # Shell layout
│   └── shared/            # Reusable components
├── main.ts                # Browser entry
└── main.server.ts         # SSR entry
```

## 8. Key Files

| File | Purpose |
|------|---------|
| `src/app/core/http/api-base.ts` | API URL configuration |
| `src/app/core/services/*.ts` | Domain services |
| `src/app/core/guards/*.ts` | Route protection |
| `src/app/app.routes.ts` | Route definitions |
| `src/app/app.config.ts` | App configuration |

## 9. API Integration

All services follow this pattern:

```typescript
// 1. Service defines state
private machinesSubject = new BehaviorSubject<Machine[]>([]);
machines$ = this.machinesSubject.asObservable();

// 2. Service loads data
loadMachines(): void {
  this.http.get(apiEndpoint('/api/v1/machines'))
    .pipe(tap(data => this.machinesSubject.next(data)))
    .subscribe();
}

// 3. Component subscribes
<div *ngFor="let m of machines$ | async">{{ m.serialNumber }}</div>
```

## 10. Authentication Flow

```
User fills form
      ↓
LoginComponent calls authService.login()
      ↓
HTTP POST to /api/v1/auth/login
      ↓
Backend returns JWT token
      ↓
Token stored in localStorage
      ↓
AuthInterceptor adds token to all requests
      ↓
Routes protected by authGuard
```

## 11. Next Steps

- [ ] **Customize**: Edit colors, fonts in SCSS files
- [ ] **Add Pages**: Create maintenance, alerts pages
- [ ] **Configure**: Update API URL in `api-base.ts`
- [ ] **Test**: Run with real backend data
- [ ] **Deploy**: Build and deploy to production

## 12. Need Help?

### Check These Files
- `README_FRONTEND.md` - Detailed documentation
- `BACKEND_INTEGRATION.md` - API endpoint reference
- `src/app/core/services/` - Service implementations

### Backend Issues?
Verify all endpoints in `BACKEND_INTEGRATION.md` are implemented

### Frontend Issues?
Check browser console (F12) for errors

## Production Deployment

### Build
```bash
npm run build
```

### Test Locally
```bash
npm run serve:ssr
```

### Deploy
```bash
# Copy dist folder to production server
# Run Express server on port 3000+
node dist/pfe-front/server/server.mjs
```

## Quick Reference - API Base URLs

| Environment | Base URL | When Used |
|-------------|----------|-----------|
| Browser | `/api` | http://localhost:4200 |
| SSR | `http://localhost:8080` | Server-side rendering |
| production | `https://api.example.com` | Production (update in api-base.ts) |

---

**Happy coding! 🚀**

For detailed docs, see `README_FRONTEND.md` and `BACKEND_INTEGRATION.md`

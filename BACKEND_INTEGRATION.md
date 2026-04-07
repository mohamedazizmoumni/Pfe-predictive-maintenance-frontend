# Sentinel Guardian - Backend Integration Guide

This document provides detailed instructions for integrating the Angular frontend with the Spring Boot backend.

## Quick Start Checklist

### Prerequisites
- [ ] Spring Boot 3.2.0 backend running on http://localhost:8080
- [ ] PostgreSQL 16 running on localhost:5432
- [ ] Database: `pfe` (user: postgres, password: admin)
- [ ] Flyway migrations (V1-V7) initialized
- [ ] Node.js 18+ and Angular CLI installed

### Backend Verification

Before running frontend, verify backend endpoints:

```bash
# 1. Check backend is running
curl http://localhost:8080/api/v1/auth/me

# 2. Login and get token
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'

# 3. Use token to verify auth works
TOKEN="your_token_here"
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/v1/auth/me
```

## Required Backend Endpoints

### Authentication Endpoints

**POST /api/v1/auth/login**
```json
Request:
{
  "username": "string",
  "password": "string"
}

Response: 200 OK
{
  "token": "jwt_token_string",
  "refreshToken": "refresh_token_string (optional)",
  "user": {
    "id": "string",
    "username": "string",
    "email": "string",
    "firstName": "string",
    "lastName": "string",
    "displayName": "string",
    "department": "string",
    "status": "ACTIVE|INACTIVE",
    "roles": [
      {
        "id": "string",
        "name": "ADMIN|MANAGER|TECHNICIAN|DATA_SCIENTIST|VIEWER",
        "permissions": []
      }
    ],
    "mfaEnabled": false,
    "lastLoginDate": "2024-01-01T00:00:00Z"
  }
}
```

**POST /api/v1/auth/logout**
```json
Response: 200 OK
{}
```

**POST /api/v1/auth/refresh**
```json
Request: {} (with auth header)
Response: 200 OK
{
  "token": "new_jwt_token",
  "refreshToken": "new_refresh_token",
  "user": { ... }
}
```

**GET /api/v1/auth/me**
```json
Response: 200 OK (with Authorization header)
{
  "id": "string",
  "username": "string",
  "email": "string",
  "firstName": "string",
  "lastName": "string",
  "displayName": "string",
  "department": "string",
  "status": "ACTIVE|INACTIVE",
  "roles": [...],
  "mfaEnabled": false,
  "lastLoginDate": "2024-01-01T00:00:00Z"
}
```

### Machine/Equipment Endpoints

**GET /api/v1/machines?page=0&size=10&status=OPERATIONAL**
```json
Response: 200 OK
{
  "content": [
    {
      "id": "string",
      "serialNumber": "string",
      "model": "string",
      "location": "string",
      "manufacturer": "string",
      "installationYear": 2024,
      "status": "OPERATIONAL|MAINTENANCE|FAULTY|INACTIVE",
      "sensors": [
        {
          "id": "string",
          "machineId": "string",
          "sensorType": "string",
          "unit": "string",
          "minThreshold": 0.0,
          "maxThreshold": 100.0
        }
      ],
      "createdDate": "2024-01-01T00:00:00Z",
      "lastModifiedDate": "2024-01-01T00:00:00Z"
    }
  ],
  "totalElements": 100,
  "totalPages": 10,
  "currentPage": 0
}
```

**POST /api/v1/machines**
```json
Request:
{
  "serialNumber": "SN-2024-001",
  "model": "Model X",
  "location": "Building A",
  "manufacturer": "TechCorp",
  "installationYear": 2024,
  "status": "OPERATIONAL"
}

Response: 201 Created
{ ...machine object... }
```

**GET /api/v1/machines/{id}**
```json
Response: 200 OK
{ ...machine object with sensors... }
```

**PUT /api/v1/machines/{id}**
```json
Request: (partial update)
{
  "status": "MAINTENANCE",
  "location": "Building B"
}

Response: 200 OK
{ ...updated machine... }
```

**DELETE /api/v1/machines/{id}**
```json
Response: 204 No Content
```

**GET /api/v1/machines/{id}/sensors**
```json
Response: 200 OK
[
  {
    "id": "string",
    "machineId": "string",
    "sensorType": "TEMPERATURE|VIBRATION|PRESSURE",
    "unit": "°C|m/s²|PSI",
    "minThreshold": 0.0,
    "maxThreshold": 100.0
  }
]
```

**POST /api/v1/machines/{id}/sensors**
```json
Request:
{
  "sensorType": "TEMPERATURE",
  "unit": "°C",
  "minThreshold": 0.0,
  "maxThreshold": 100.0
}

Response: 201 Created
{ ...sensor object... }
```

**GET /api/v1/machines/{id}/status**
```json
Response: 200 OK
{
  "machineId": "string",
  "status": "OPERATIONAL|MAINTENANCE|FAULTY|INACTIVE",
  "lastReading": "2024-01-01T00:00:00Z",
  "temperature": 45.2,
  "vibration": 2.1,
  "pressure": 101.3
}
```

### Maintenance Endpoints

**GET /api/v1/maintenance?page=0&size=10&status=SCHEDULED&priority=HIGH**
```json
Response: 200 OK
{
  "content": [
    {
      "id": "string",
      "machineId": "string",
      "type": "PREVENTIVE|CORRECTIVE|EMERGENCY",
      "priority": "LOW|MEDIUM|HIGH|CRITICAL",
      "description": "string",
      "status": "SCHEDULED|IN_PROGRESS|COMPLETED|APPROVED|CANCELLED",
      "scheduledDate": "2024-01-01T00:00:00Z",
      "startDate": "2024-01-01T00:00:00Z",
      "completedDate": "2024-01-01T00:00:00Z",
      "approvedDate": "2024-01-01T00:00:00Z",
      "estimatedDuration": 120,
      "assignedTechnicianId": "string",
      "notes": "string"
    }
  ],
  "totalElements": 50,
  "totalPages": 5,
  "currentPage": 0
}
```

**POST /api/v1/maintenance**
```json
Request:
{
  "machineId": "string",
  "type": "PREVENTIVE",
  "priority": "MEDIUM",
  "description": "Routine maintenance",
  "scheduledDate": "2024-02-01T10:00:00Z",
  "estimatedDuration": 120
}

Response: 201 Created
{ ...maintenance object... }
```

**GET /api/v1/maintenance/{id}**
```json
Response: 200 OK
{ ...maintenance object... }
```

**PUT /api/v1/maintenance/{id}**
```json
Request:
{
  "status": "IN_PROGRESS",
  "notes": "Started maintenance"
}

Response: 200 OK
{ ...updated maintenance... }
```

**DELETE /api/v1/maintenance/{id}**
```json
Response: 204 No Content
```

**GET /api/v1/machines/{id}/maintenance?page=0&size=10**
```json
Response: 200 OK
{ ...maintenance list for specific machine... }
```

**POST /api/v1/maintenance/{id}/assign**
```json
Request:
{
  "technicianId": "string"
}

Response: 200 OK
{ ...maintenance with assigned technician... }
```

### Prediction Endpoints

**GET /api/v1/predictions?page=0&size=10**
```json
Response: 200 OK
{
  "content": [
    {
      "id": "string",
      "machineId": "string",
      "modelId": "string",
      "predictionValue": 85.5,
      "confidenceScore": 0.92,
      "riskLevel": "LOW|MEDIUM|HIGH|CRITICAL",
      "predictionDate": "2024-01-01T00:00:00Z"
    }
  ],
  "totalElements": 100,
  "totalPages": 10,
  "currentPage": 0
}
```

**GET /api/v1/machines/{id}/predictions?page=0&size=10**
```json
Response: 200 OK
{ ...predictions for specific machine... }
```

**POST /api/v1/predictions/run**
```json
Request:
{
  "machineId": "string"
}

Response: 201 Created
{ ...prediction object... }
```

**GET /api/v1/ml-models**
```json
Response: 200 OK
[
  {
    "id": "string",
    "name": "RUL Model v1",
    "modelType": "GRADIENT_BOOSTING",
    "modelVersion": "1.0.0",
    "status": "ACTIVE|INACTIVE|ARCHIVED",
    "accuracy": 0.94,
    "precision": 0.91,
    "recall": 0.88,
    "f1Score": 0.89
  }
]
```

### Alert Endpoints

**GET /api/v1/alerts?page=0&size=10&severity=CRITICAL&status=OPEN**
```json
Response: 200 OK
{
  "content": [
    {
      "id": "string",
      "machineId": "string",
      "title": "High vibration detected",
      "description": "Vibration exceeded threshold",
      "severity": "LOW|MEDIUM|HIGH|CRITICAL",
      "status": "OPEN|ACKNOWLEDGED|RESOLVED",
      "createdDate": "2024-01-01T00:00:00Z",
      "acknowledgedDate": "2024-01-01T00:00:00Z",
      "resolvedDate": "2024-01-01T00:00:00Z"
    }
  ],
  "totalElements": 50,
  "totalPages": 5,
  "currentPage": 0
}
```

**POST /api/v1/alerts/{id}/acknowledge**
```json
Response: 200 OK
{ ...updated alert... }
```

**DELETE /api/v1/alerts/{id}**
```json
Response: 204 No Content
```

**GET /api/v1/alerts/summary**
```json
Response: 200 OK
{
  "LOW": 5,
  "MEDIUM": 3,
  "HIGH": 2,
  "CRITICAL": 0
}
```

### Dashboard Endpoints

**GET /api/v1/dashboard/overview**
```json
Response: 200 OK
{
  "uptimePercentage": 98.5,
  "maintenanceDueCount": 3,
  "openAlertsCount": 2,
  "totalMachinesCount": 25,
  "operationalMachinesCount": 23,
  "totalSensorsCount": 75
}
```

**GET /api/v1/dashboard/machines**
```json
Response: 200 OK
{
  "operational": 23,
  "maintenance": 1,
  "faulty": 1,
  "inactive": 0
}
```

**GET /api/v1/dashboard/predictions**
```json
Response: 200 OK
{
  "machinesAtRisk": 2,
  "avgConfidenceScore": 0.89,
  "recentPredictions": [...]
}
```

**GET /api/v1/dashboard/maintenance**
```json
Response: 200 OK
{
  "scheduled": 5,
  "inProgress": 2,
  "completed": 18,
  "cancelled": 1
}
```

### Inventory Endpoints

**GET /api/v1/inventory**
```json
Response: 200 OK
[
  {
    "id": "string",
    "partNumber": "PN-001",
    "name": "Ball Bearing",
    "description": "Precision ball bearing",
    "quantity": 50,
    "minStock": 10,
    "unit": "pieces",
    "location": "Shelf A1",
    "cost": 25.50,
    "lastUpdated": "2024-01-01T00:00:00Z"
  }
]
```

**POST /api/v1/inventory**
```json
Request:
{
  "partNumber": "PN-001",
  "name": "Ball Bearing",
  "description": "Precision ball bearing",
  "quantity": 50,
  "minStock": 10,
  "unit": "pieces",
  "location": "Shelf A1",
  "cost": 25.50
}

Response: 201 Created
{ ...part object... }
```

**PUT /api/v1/inventory/{id}**
```json
Request:
{
  "quantity": 75
}

Response: 200 OK
{ ...updated part... }
```

**GET /api/v1/inventory/low-stock**
```json
Response: 200 OK
[...parts below minimum stock...]
```

### User Management Endpoints

**GET /api/v1/users?page=0&size=10**
```json
Response: 200 OK
{
  "content": [...users...],
  "totalElements": 20,
  "totalPages": 2,
  "currentPage": 0
}
```

**POST /api/v1/users**
```json
Request:
{
  "username": "newuser",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "displayName": "John Doe",
  "department": "Engineering",
  "status": "ACTIVE",
  "roles": [{"id": "role_id"}]
}

Response: 201 Created
{ ...user object... }
```

**GET /api/v1/roles**
```json
Response: 200 OK
[
  {
    "id": "string",
    "name": "ADMIN",
    "permissions": [...]
  },
  {
    "id": "string",
    "name": "MANAGER",
    "permissions": [...]
  },
  {
    "id": "string",
    "name": "TECHNICIAN",
    "permissions": [...]
  },
  {
    "id": "string",
    "name": "DATA_SCIENTIST",
    "permissions": [...]
  },
  {
    "id": "string",
    "name": "VIEWER",
    "permissions": [...]
  }
]
```

## Frontend Testing Flow

### 1. Test Authentication
```bash
# Start frontend
npm start

# Navigate to http://localhost:4200/auth/login
# Login with: admin / admin
# Verify JWT token in localStorage
```

### 2. Test Dashboard
```
# After login, dashboard should load
# Verify KPIs are populated with data
# Check Network tab for /api/v1/dashboard/* calls
```

### 3. Test Equipment Page
```
# Navigate to Equipment
# Create a new machine
# Verify POST to /api/v1/machines
# List machines should show created machine
```

### 4. Test Role-Based Access
```
# Login as different roles:
# - Admin: full access
# - Manager: can view equipment, maintenance
# - Technician: view-only on most pages
# - Viewer: dashboard only

# Verify sidebar menu changes per role
# Verify role.guard prevents unauthorized access
```

### 5. Test Error Handling
```
# Kill backend to test 500 errors
# Create malformed network to test timeouts
# Test invalid JWT token handling
# Verify 401 redirects to login
```

## Backend Implementation Checklist

- [ ] All authentication endpoints implemented
- [ ] JWT token generation and validation
- [ ] Token refresh mechanism working
- [ ] CORS configured for http://localhost:4200
- [ ] All machine endpoints with pagination
- [ ] Sensor CRUD operations
- [ ] Maintenance task management
- [ ] Prediction endpoints with ML integration
- [ ] Alert system working
- [ ] Dashboard aggregation endpoints
- [ ] Inventory management
- [ ] User management with roles
- [ ] Error responses in correct format
- [ ] Request validation (input sanitization)
- [ ] Database transactions for multi-step operations

## Common Issues & Solutions

### CORS Error
```
Access to XMLHttpRequest at 'http://localhost:8080/api/v1/...' 
from origin 'http://localhost:4200' has been blocked by CORS policy
```
**Solution**: Add CORS configuration to Spring Boot:
```java
@Configuration
public class CorsConfig implements WebMvcConfigurer {
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
            .allowedOrigins("http://localhost:4200")
            .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
            .allowCredentials(true);
    }
}
```

### 401 Unauthorized
```
HTTP 401: Unauthorized
```
**Solution**: 
1. Verify JWT token is in Authorization header
2. Check token expiration
3. Verify secret key matches between backend and token

### Service Not Found (404)
```
HTTP 404: Not Found
```
**Solution**: Verify endpoint path matches exactly with frontend service calls

### Token Expiration
Frontend will automatically attempt refresh via:
```
POST /api/v1/auth/refresh
```
Ensure this endpoint returns valid new token

## Debugging Tips

### Enable Network Logging in Frontend
```typescript
// In auth.interceptor.ts
console.log('Request:', request);
console.log('Response:', response);
```

### Check Backend Logs
```bash
tail -f /path/to/spring-boot.log | grep "ERROR\|WARN"
```

### Test with Postman
Import endpoints and test manually before frontend integration

### Browser DevTools
1. Open Developer Tools (F12)
2. Go to Network tab
3. Make request in frontend
4. Inspect request/response headers and body

## Performance Tuning

### Frontend Optimization
- Enable lazy loading for feature routes
- Use OnPush change detection strategy
- Implement service-level caching

### Backend Optimization
- Add database indexes on frequently queried columns
- Implement pagination for large datasets
- Cache dashboard aggregate queries

## Security Considerations

1. **HTTPS in Production**: Use SSL/TLS certificate
2. **JWT Secret**: Use strong, random secret key
3. **Input Validation**: Sanitize all user inputs
4. **Rate Limiting**: Implement rate limiting on auth endpoints
5. **CORS Whitelist**: Only allow production frontend domain
6. **Session Timeout**: Implement reasonable token expiration

## Next Steps

After successful integration:

1. [ ] Run end-to-end tests
2. [ ] Performance testing with load tool
3. [ ] Security audit
4. [ ] Production deployment
5. [ ] Monitoring setup
6. [ ] Documentation finalization

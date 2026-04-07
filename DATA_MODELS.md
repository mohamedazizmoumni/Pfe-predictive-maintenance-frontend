# Sentinel Guardian - Frontend Data Models

This document describes the TypeScript models and expected backend database schema.

## Core Models (TypeScript Interfaces)

All models are defined in `src/app/core/models/sentinel.models.ts`

### User Model

```typescript
interface User {
  id: string;                        // UUID from backend
  username: string;                  // Unique username
  email: string;                     // User email
  firstName: string;                 // First name
  lastName: string;                  // Last name
  displayName: string;               // Display name (e.g., "John Doe")
  department: string;                // Department/team
  status: 'ACTIVE' | 'INACTIVE';     // User status
  roles: Role[];                     // Array of assigned roles
  mfaEnabled: boolean;               // Multi-factor auth enabled?
  lastLoginDate?: Date;              // Last login timestamp
}
```

### Role Model

```typescript
interface Role {
  id: string;                        // UUID
  name: 'ADMIN' | 'MANAGER' | 
        'TECHNICIAN' | 'DATA_SCIENTIST' | 'VIEWER';
  permissions: string[];             // Permission strings
}
```

**Role Definitions**:
- **ADMIN**: Full system access, user management
- **MANAGER**: Manage equipment, maintenance, inventory
- **TECHNICIAN**: Execute maintenance tasks
- **DATA_SCIENTIST**: Access to predictions and ML models
- **VIEWER**: Read-only access to dashboard

### Machine Model

```typescript
interface Machine {
  id: string;                                    // UUID
  serialNumber: string;                          // Unique identifier
  model: string;                                 // Model name
  location: string;                              // Physical location
  manufacturer: string;                          // Manufacturer name
  installationYear: number;                      // Year installed
  status: 'OPERATIONAL' | 'MAINTENANCE' | 
          'FAULTY' | 'INACTIVE';                // Current status
  sensors: Sensor[];                             // Attached sensors
  createdDate: Date;                             // Creation timestamp
  lastModifiedDate: Date;                        // Last update timestamp
}
```

### Sensor Model

```typescript
interface Sensor {
  id: string;                        // UUID
  machineId: string;                 // Foreign key to machine
  sensorType: string;                // e.g., "TEMPERATURE", "VIBRATION"
  unit: string;                      // Measurement unit (°C, m/s², PSI)
  minThreshold: number;              // Minimum alert threshold
  maxThreshold: number;              // Maximum alert threshold
}
```

### Maintenance Model

```typescript
interface Maintenance {
  id: string;                        // UUID
  machineId: string;                 // Foreign key to machine
  type: 'PREVENTIVE' | 'CORRECTIVE' | 'EMERGENCY';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;               // Task description
  status: 'SCHEDULED' | 'IN_PROGRESS' | 
          'COMPLETED' | 'APPROVED' | 'CANCELLED';
  scheduledDate: Date;               // Scheduled start time
  startDate?: Date;                  // Actual start time
  completedDate?: Date;              // Completion time
  approvedDate?: Date;               // Approval time
  estimatedDuration: number;         // Duration in minutes
  assignedTechnicianId?: string;     // Foreign key to technician user
  notes?: string;                    // Additional notes
}
```

### Prediction Model

```typescript
interface Prediction {
  id: string;                        // UUID
  machineId: string;                 // Foreign key to machine
  modelId: string;                   // Foreign key to ML model
  predictionValue: number;           // RUL (Remaining Useful Life)
  confidenceScore: number;           // 0.0 - 1.0
  riskLevel: 'LOW' | 'MEDIUM' | 
             'HIGH' | 'CRITICAL';    // Risk assessment
  predictionDate: Date;              // When prediction was made
}
```

### MLModel Model

```typescript
interface MLModel {
  id: string;                        // UUID
  name: string;                      // Model name
  modelType: string;                 // e.g., "RandomForest", "NeuralNetwork"
  modelVersion: string;              // Version number
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  accuracy: number;                  // 0.0 - 1.0
  precision: number;                 // 0.0 - 1.0
  recall: number;                    // 0.0 - 1.0
  f1Score: number;                   // 0.0 - 1.0
}
```

### Alert Model

```typescript
interface Alert {
  id: string;                        // UUID
  machineId: string;                 // Foreign key to machine
  title: string;                     // Alert title
  description: string;               // Detailed description
  severity: 'LOW' | 'MEDIUM' | 
            'HIGH' | 'CRITICAL';     // Alert severity
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
  createdDate: Date;                 // Creation timestamp
  acknowledgedDate?: Date;           // When acknowledged
  resolvedDate?: Date;               // When resolved
}
```

### InventoryPart Model

```typescript
interface InventoryPart {
  id: string;                        // UUID
  partNumber: string;                // Unique part number
  name: string;                      // Part name
  description: string;               // Description
  quantity: number;                  // Current quantity
  minStock: number;                  // Minimum stock level
  unit: string;                      // Unit (pieces, boxes, etc)
  location: string;                  // Storage location
  cost: number;                      // Unit cost
  lastUpdated: Date;                 // Last update timestamp
}
```

## Dashboard Models (Aggregated Data)

### DashboardOverview

```typescript
interface DashboardOverview {
  uptimePercentage: number;          // 0-100%
  maintenanceDueCount: number;       // Count of due maintenance
  openAlertsCount: number;           // Count of open alerts
  totalMachinesCount: number;        // Total machines
  operationalMachinesCount: number;  // Machines in service
  totalSensorsCount: number;         // Total sensors across all machines
}
```

### MachineStatusSummary

```typescript
interface MachineStatusSummary {
  operational: number;               // Count by status
  maintenance: number;
  faulty: number;
  inactive: number;
}
```

### PredictionHealth

```typescript
interface PredictionHealth {
  machinesAtRisk: number;            // Machines with HIGH/CRITICAL risk
  avgConfidenceScore: number;        // Average prediction confidence
  recentPredictions: Prediction[];   // Last N predictions
}
```

### MaintenancePipeline

```typescript
interface MaintenancePipeline {
  scheduled: number;                 // Count in SCHEDULED status
  inProgress: number;                // Count in IN_PROGRESS
  completed: number;                 // Count in COMPLETED
  cancelled: number;                 // Count in CANCELLED
}
```

## API Response Models

### LoginResponse

```typescript
interface LoginResponse {
  token: string;                     // JWT access token
  refreshToken?: string;             // Optional refresh token
  user: User;                        // Full user object
}
```

### Paginated Response

Used for all list endpoints:

```typescript
interface PaginatedResponse<T> {
  content: T[];                      // Array of items
  totalElements: number;             // Total count in database
  totalPages: number;                // Number of pages
  currentPage: number;               // Current page (0-based)
}
```

Example: `GET /api/v1/machines` returns:
```json
{
  "content": [Machine, Machine, ...],
  "totalElements": 100,
  "totalPages": 10,
  "currentPage": 0
}
```

## Expected Backend Database Schema

### Tables (Flyway Migrations V1-V7)

#### users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  display_name VARCHAR(255),
  department VARCHAR(255),
  status VARCHAR(50) DEFAULT 'ACTIVE',
  mfa_enabled BOOLEAN DEFAULT FALSE,
  last_login_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### roles
```sql
CREATE TABLE roles (
  id UUID PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### user_roles (junction table)
```sql
CREATE TABLE user_roles (
  user_id UUID REFERENCES users(id),
  role_id UUID REFERENCES roles(id),
  PRIMARY KEY (user_id, role_id)
);
```

#### machines
```sql
CREATE TABLE machines (
  id UUID PRIMARY KEY,
  serial_number VARCHAR(255) UNIQUE NOT NULL,
  model VARCHAR(255),
  location VARCHAR(255),
  manufacturer VARCHAR(255),
  installation_year INTEGER,
  status VARCHAR(50) DEFAULT 'OPERATIONAL',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### sensors
```sql
CREATE TABLE sensors (
  id UUID PRIMARY KEY,
  machine_id UUID REFERENCES machines(id) ON DELETE CASCADE,
  sensor_type VARCHAR(255),
  unit VARCHAR(50),
  min_threshold DECIMAL(10, 2),
  max_threshold DECIMAL(10, 2),
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### maintenance_tasks
```sql
CREATE TABLE maintenance_tasks (
  id UUID PRIMARY KEY,
  machine_id UUID REFERENCES machines(id),
  type VARCHAR(50),
  priority VARCHAR(50),
  description TEXT,
  status VARCHAR(50) DEFAULT 'SCHEDULED',
  scheduled_date TIMESTAMP,
  start_date TIMESTAMP,
  completed_date TIMESTAMP,
  approved_date TIMESTAMP,
  estimated_duration INTEGER,
  assigned_technician_id UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### predictions
```sql
CREATE TABLE predictions (
  id UUID PRIMARY KEY,
  machine_id UUID REFERENCES machines(id),
  model_id UUID REFERENCES ml_models(id),
  prediction_value DECIMAL(10, 2),
  confidence_score DECIMAL(3, 2),
  risk_level VARCHAR(50),
  prediction_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### ml_models
```sql
CREATE TABLE ml_models (
  id UUID PRIMARY KEY,
  name VARCHAR(255),
  model_type VARCHAR(255),
  model_version VARCHAR(50),
  status VARCHAR(50) DEFAULT 'ACTIVE',
  accuracy DECIMAL(3, 2),
  precision DECIMAL(3, 2),
  recall DECIMAL(3, 2),
  f1_score DECIMAL(3, 2),
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### alerts
```sql
CREATE TABLE alerts (
  id UUID PRIMARY KEY,
  machine_id UUID REFERENCES machines(id),
  title VARCHAR(255),
  description TEXT,
  severity VARCHAR(50),
  status VARCHAR(50) DEFAULT 'OPEN',
  created_at TIMESTAMP DEFAULT NOW(),
  acknowledged_at TIMESTAMP,
  resolved_at TIMESTAMP
);
```

#### inventory
```sql
CREATE TABLE inventory (
  id UUID PRIMARY KEY,
  part_number VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  description TEXT,
  quantity INTEGER,
  min_stock INTEGER,
  unit VARCHAR(50),
  location VARCHAR(255),
  cost DECIMAL(10, 2),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Validation Rules

### User
- username: Required, unique, 3-50 characters
- email: Valid email format
- status: Only ACTIVE or INACTIVE

### Machine
- serialNumber: Required, unique
- status: Only valid status values

### Maintenance
- machineId: Must exist in machines table
- type: Only valid types
- priority: Only valid priorities
- estimatedDuration: Positive integer (minutes)

### Sensor
- machineId: Must exist
- minThreshold < maxThreshold

## Data Type Mappings

| TypeScript | JSON | PostgreSQL |
|-----------|------|------------|
| string | "text" | VARCHAR |
| number | 123 | DECIMAL/INTEGER |
| boolean | true/false | BOOLEAN |
| Date | "2024-01-01T..." | TIMESTAMP |
| UUID | "550e8400-..." | UUID |

## Timestamps

All entities should include:
- `createdAt` (ISO 8601): When created
- `updatedAt` (ISO 8601): When last modified

Example: `"createdDate": "2024-01-15T10:30:00Z"`

## Sample Data for Testing

### Admin User
```json
{
  "username": "admin",
  "password": "admin",
  "email": "admin@example.com",
  "firstName": "Admin",
  "lastName": "User",
  "displayName": "Admin User",
  "department": "IT",
  "status": "ACTIVE",
  "roles": ["ADMIN"]
}
```

### Sample Machine
```json
{
  "serialNumber": "SN-2024-001",
  "model": "Model X-2000",
  "location": "Building A, Floor 2",
  "manufacturer": "TechCorp Inc",
  "installationYear": 2022,
  "status": "OPERATIONAL"
}
```

### Sample Sensor
```json
{
  "sensorType": "TEMPERATURE",
  "unit": "°C",
  "minThreshold": 0.0,
  "maxThreshold": 100.0
}
```

## Migration Sequence (Flyway V1-V7)

1. **V1**: Create users, roles, user_roles tables
2. **V2**: Create machines table
3. **V3**: Create sensors table
4. **V4**: Create maintenance_tasks table
5. **V5**: Create predictions and ml_models tables
6. **V6**: Create alerts table
7. **V7**: Create inventory table

Each migration should include:
- Table creation
- Primary keys
- Foreign keys
- Indexes on frequently queried columns
- Sample data insertion

---

This schema aligns with JPA/Hibernate entity mapping and provides complete data structure for the Sentinel Guardian application.

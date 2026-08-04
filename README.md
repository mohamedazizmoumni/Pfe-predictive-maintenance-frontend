# Sentinel AI — Operations Dashboard Frontend

## Overview

This repository contains the frontend application for the **Sentinel AI Operations Platform**, an enterprise dashboard designed for AI-driven predictive maintenance and industrial intelligence.

The application provides maintenance teams and industrial operators with a centralized interface to monitor equipment health, analyze machine behavior, manage maintenance activities, and interact with AI-powered decision support capabilities.

The platform enables organizations to move from reactive maintenance toward proactive, data-driven industrial operations.


---

# Core Capabilities

The Sentinel AI dashboard provides role-based access to different operational workflows.

## Machine Monitoring

Real-time visualization of industrial assets through:

- Live machine telemetry
- Equipment health indicators
- Operational status monitoring
- Machine performance analytics
- Digital asset tracking


## Predictive Maintenance

AI-assisted maintenance intelligence including:

- Remaining Useful Life (RUL) estimation
- Failure risk analysis
- Predictive insights
- Machine degradation monitoring
- Maintenance recommendations


## Alert Management

Centralized alert management system:

- Real-time anomaly notifications
- Failure risk alerts
- Alert classification
- Operational follow-up workflows


## Maintenance Management

Maintenance teams can manage:

- Maintenance planning
- Work orders
- Intervention tracking
- Technician assignments
- Maintenance history


## Inventory Management

Inventory intelligence features:

- Spare parts tracking
- Stock monitoring
- Inventory operations
- Maintenance resource management


## AI Assistant

Integrated AI capabilities supporting:

- Industrial diagnosis assistance
- Natural language interaction
- Maintenance recommendations
- Operational insights


---

# Platform Architecture

The Sentinel AI ecosystem is composed of multiple applications:

```
Sentinel AI Platform

├── Sentinel AI Client Website
│
│   Public presentation website
│   - Services showcase
│   - Company information
│   - Contact interface
│
├── Sentinel Operations Dashboard
│   (This Repository)
│
│   Angular enterprise interface
│   - Machine monitoring
│   - Predictive maintenance
│   - Alerts
│   - Maintenance workflows
│   - Inventory
│   - AI assistance
│
├── Spring Boot Backend
│
│   Backend services
│   - Authentication
│   - Authorization
│   - Business logic
│   - Data management
│   - REST APIs
│
└── Machine Learning Service
    |
    - RUL prediction
    - Anomaly detection
    - AI analysis services
```


---

# Repository Ecosystem

| Repository | Responsibility |
|------------|----------------|
| This repository | Angular dashboard frontend |
| Pfe-predictive-maintenance-backend | Spring Boot API, authentication, business services |
| ml_service | FastAPI machine learning services |


---

# Technology Stack

## Frontend Framework

| Technology | Purpose |
|------------|---------|
| Angular 17 | Frontend framework |
| TypeScript | Application development |
| RxJS | Reactive state management |
| Standalone Components | Angular component architecture |
| Angular Router | Navigation and lazy loading |


## UI & Visualization

| Technology | Purpose |
|------------|---------|
| Chart.js | Data visualization |
| Lucide Angular | Icon system |
| Angular Material | Selected UI components |
| Custom CSS Design System | Enterprise interface styling |


## Communication

| Technology | Purpose |
|------------|---------|
| REST API | Backend communication |
| STOMP | WebSocket messaging |
| SockJS | Real-time communication fallback |


---

# Application Architecture

The application follows a modular Angular architecture.

```
src/app/

├── core/
│
│   ├── authentication
│   ├── authorization guards
│   ├── API communication
│   ├── domain services
│   └── TypeScript models
│
├── layout/
│
│   └── Sentinel application shell
│       ├── Sidebar navigation
│       ├── Header
│       └── Global workspace layout
│
├── pages/
│
│   ├── Dashboards
│   ├── Equipment monitoring
│   ├── Maintenance
│   ├── Inventory
│   ├── Finance
│   ├── Alerts
│   ├── Predictive analytics
│   ├── Recommendations
│   └── AI assistant
│
└── shared/

    Reusable UI components
```


---

# Role-Based Dashboards

The application supports multiple operational roles with dedicated interfaces.

Examples include:

- Administrator
- Maintenance Manager
- Technician
- Operations Manager
- Inventory Manager


Each role receives access to specific:

- Pages
- Navigation items
- Actions
- Data views


Authorization is enforced through:

- Route guards
- Role-based navigation filtering
- Backend authorization


---

# Real-Time Data Architecture

The dashboard communicates with the backend through WebSocket connections for live industrial information.

## Machine Telemetry Stream

Connection:

```
/ws-machine
```

Topics:

```
/topic/machines
/topic/alerts
```

Used for:

- Live equipment updates
- Telemetry visualization
- Alert streaming


## AI Diagnostic Stream

Connection:

```
/ws-nlp
```

Topics:

```
/topic/nlp-alerts
/topic/machine-insights
```

Used for:

- AI assistant responses
- Machine diagnosis
- Intelligent recommendations


The frontend communicates exclusively with the backend layer. Machine learning services are accessed through backend APIs.


---

# Local Development

## Requirements

Install:

- Node.js 18+
- npm
- Angular CLI 17


Verify:

```bash
node --version
npm --version
ng version
```


---

# Installation

Clone the repository:

```bash
git clone <repository-url>
```

Navigate:

```bash
cd Pfe-Predictive-Maintenance-Frontend
```


Install dependencies:

```bash
npm install
```


---

# Running the Application

Start the development server:

```bash
npm start
```

The application will run at:

```
http://localhost:4200
```


The frontend expects the backend API to be available at:

```
http://localhost:8080
```


---

# Backend Communication Configuration

Development API routing is configured through:

```
proxy.conf.json
```

Example:

```
/api  →  http://localhost:8080
```


Environment configuration:

```
src/environments/
```

Contains:

- API URL configuration
- WebSocket endpoints
- Deployment-specific settings


---

# Production Build

Generate the production bundle:

```bash
npm run build
```


Output:

```
dist/
```


The application can be deployed using:

- Vercel
- Netlify
- AWS Amplify
- Nginx
- Any static hosting platform


---

# Testing

Run unit tests:

```bash
npm test
```


Testing framework:

- Jasmine
- Karma


---

# Development Commands

| Command | Description |
|---------|-------------|
| npm install | Install dependencies |
| npm start | Start development server |
| npm run build | Production build |
| npm test | Run unit tests |


---

# Design Principles

The Sentinel AI dashboard follows enterprise software design principles:

- Clear operational visibility
- Data-driven interfaces
- Scalable frontend architecture
- Role-based user experience
- Real-time industrial monitoring
- Professional industrial UX design


---

# License

This project is developed as part of an engineering project focused on AI-driven predictive maintenance and industrial intelligence.
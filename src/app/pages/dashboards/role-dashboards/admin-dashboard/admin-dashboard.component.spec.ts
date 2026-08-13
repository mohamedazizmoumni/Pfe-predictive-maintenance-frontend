import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { AdminDashboardComponent } from './admin-dashboard.component';
import { MachineService } from '../../../../core/services/machine.service';
import { MaintenanceService } from '../../../../core/services/maintenance.service';
import { AlertApiService } from '../../../../core/services/alert.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { Machine } from '../../../../core/models/machine.model';
import { Maintenance, AlertResponse } from '../../../../core/models/sentinel.models';

describe('AdminDashboardComponent', () => {
  let fixture: ComponentFixture<AdminDashboardComponent>;
  let component: AdminDashboardComponent;
  let machineService: jasmine.SpyObj<MachineService>;
  let maintenanceService: jasmine.SpyObj<MaintenanceService>;
  let alertService: jasmine.SpyObj<AlertApiService>;
  let notificationService: jasmine.SpyObj<NotificationService>;

  const machines: Machine[] = [
    { id: 1, serialNumber: 'SN-1', name: 'Press-1', model: 'X1', status: 'OPERATIONAL' } as Machine,
    { id: 2, serialNumber: 'SN-2', name: 'Press-2', model: 'X1', status: 'MAINTENANCE' } as Machine,
    { id: 3, serialNumber: 'SN-3', name: 'Press-3', model: 'X1', status: 'FAULTY' } as Machine,
  ];

  const maintenance: Maintenance[] = [
    { id: '1', machineId: 1, type: 'CORRECTIVE', description: 'Bearing swap', status: 'SCHEDULED', priority: 'HIGH', scheduledDate: new Date().toISOString(), estimatedDuration: 60 },
    { id: '2', machineId: 2, type: 'PREVENTIVE', description: 'Lube check', status: 'IN_PROGRESS', priority: 'LOW', scheduledDate: new Date().toISOString(), estimatedDuration: 30 },
    { id: '3', machineId: 3, type: 'PREVENTIVE', description: 'Belt replace', status: 'COMPLETED', priority: 'LOW', scheduledDate: new Date().toISOString(), estimatedDuration: 45 },
  ];

  const alerts: AlertResponse[] = [
    { id: 1, machineId: 3, title: 'Critical vibration', severity: 'CRITICAL', createdDate: new Date().toISOString() } as AlertResponse,
  ];

  function configure(): void {
    machineService = jasmine.createSpyObj('MachineService', ['getAll']);
    maintenanceService = jasmine.createSpyObj('MaintenanceService', ['getAllMaintenanceTasks']);
    alertService = jasmine.createSpyObj('AlertApiService', ['list']);
    notificationService = jasmine.createSpyObj('NotificationService', ['error', 'success', 'warn']);

    TestBed.configureTestingModule({
      imports: [AdminDashboardComponent],
      providers: [
        { provide: MachineService, useValue: machineService },
        { provide: MaintenanceService, useValue: maintenanceService },
        { provide: AlertApiService, useValue: alertService },
        { provide: NotificationService, useValue: notificationService },
      ],
    });
  }

  it('shows a loading state before data arrives', () => {
    configure();
    machineService.getAll.and.returnValue(new Observable<Machine[]>());
    maintenanceService.getAllMaintenanceTasks.and.returnValue(of({ content: [] } as any));
    alertService.list.and.returnValue(of({ content: [] } as any));

    fixture = TestBed.createComponent(AdminDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.loading()).toBeTrue();
  });

  it('aggregates machines, maintenance, and alerts into KPI cards on success', () => {
    configure();
    machineService.getAll.and.returnValue(of(machines));
    maintenanceService.getAllMaintenanceTasks.and.returnValue(of({ content: maintenance } as any));
    alertService.list.and.returnValue(of({ content: alerts } as any));

    fixture = TestBed.createComponent(AdminDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.loading()).toBeFalse();
    expect(component.error()).toBeNull();

    const kpis = component.kpiCards();
    expect(kpis.find((c) => c.label === 'Machines')?.value).toBe(3);
    expect(kpis.find((c) => c.label === 'Operational')?.value).toBe(1);
    expect(kpis.find((c) => c.label === 'Maintenance')?.value).toBe(2);
    expect(kpis.find((c) => c.label === 'Critical alerts')?.value).toBe(1);
  });

  it('falls back to an empty machine list when the machines call fails, without erroring the whole dashboard', () => {
    configure();
    machineService.getAll.and.returnValue(throwError(() => new Error('network down')));
    maintenanceService.getAllMaintenanceTasks.and.returnValue(of({ content: [] } as any));
    alertService.list.and.returnValue(of({ content: [] } as any));

    fixture = TestBed.createComponent(AdminDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.loading()).toBeFalse();
    expect(component.error()).toBeNull();
    expect(component.machines()).toEqual([]);
    expect(notificationService.error).not.toHaveBeenCalled();
  });

  it('individually swallows a failed maintenance fetch instead of failing the whole dashboard', () => {
    configure();
    machineService.getAll.and.returnValue(of(machines));
    maintenanceService.getAllMaintenanceTasks.and.returnValue(throwError(() => new Error('db down')));
    alertService.list.and.returnValue(of({ content: alerts } as any));

    fixture = TestBed.createComponent(AdminDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.loading()).toBeFalse();
    expect(component.error()).toBeNull();
    expect(component.maintenance()).toEqual([]);
    // The rest of the fan-out still lands even though maintenance failed.
    expect(component.alerts()).toEqual(alerts);
  });

  it('refresh() re-triggers loadDashboardData()', () => {
    configure();
    machineService.getAll.and.returnValue(of(machines));
    maintenanceService.getAllMaintenanceTasks.and.returnValue(of({ content: maintenance } as any));
    alertService.list.and.returnValue(of({ content: alerts } as any));

    fixture = TestBed.createComponent(AdminDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    machineService.getAll.calls.reset();
    component.refresh();

    expect(machineService.getAll).toHaveBeenCalledTimes(1);
  });
});

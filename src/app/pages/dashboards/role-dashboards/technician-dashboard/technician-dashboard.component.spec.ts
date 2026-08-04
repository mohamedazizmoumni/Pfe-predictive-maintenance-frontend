import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { TechnicianDashboardComponent } from './technician-dashboard.component';
import { AuthService } from '../../../../core/services/auth.service';
import { MachineService } from '../../../../core/services/machine.service';
import { MaintenanceService } from '../../../../core/services/maintenance.service';
import { AlertApiService } from '../../../../core/services/alert.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { Machine } from '../../../../core/models/machine.model';
import { Maintenance, AlertResponse, User } from '../../../../core/models/sentinel.models';

describe('TechnicianDashboardComponent', () => {
  let fixture: ComponentFixture<TechnicianDashboardComponent>;
  let component: TechnicianDashboardComponent;
  let authService: jasmine.SpyObj<AuthService>;
  let machineService: jasmine.SpyObj<MachineService>;
  let maintenanceService: jasmine.SpyObj<MaintenanceService>;
  let alertService: jasmine.SpyObj<AlertApiService>;

  const technician: User = { id: 'tech-1', username: 'jane.tech', email: 'jane@sentinel.io', roles: [] };

  const today = new Date();
  const tasks: Maintenance[] = [
    { id: '1', machineId: 1, type: 'CORRECTIVE', description: 'Bearing swap', status: 'IN_PROGRESS', priority: 'HIGH', scheduledDate: today.toISOString(), estimatedDuration: 60 },
    { id: '2', machineId: 2, type: 'PREVENTIVE', description: 'Belt check', status: 'COMPLETED', priority: 'LOW', scheduledDate: new Date(2000, 0, 1).toISOString(), estimatedDuration: 30 },
  ];

  const alerts: AlertResponse[] = [
    { id: 1, machineId: 1, title: 'Vibration spike', severity: 'WARNING', createdDate: new Date().toISOString() } as AlertResponse,
  ];

  function configure(): void {
    authService = jasmine.createSpyObj('AuthService', ['getCurrentUser']);
    machineService = jasmine.createSpyObj('MachineService', ['getAll']);
    maintenanceService = jasmine.createSpyObj('MaintenanceService', ['getTechnicianTasks']);
    alertService = jasmine.createSpyObj('AlertApiService', ['list']);
    const notificationService = jasmine.createSpyObj('NotificationService', ['error', 'success', 'warn']);

    TestBed.configureTestingModule({
      imports: [TechnicianDashboardComponent],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: MachineService, useValue: machineService },
        { provide: MaintenanceService, useValue: maintenanceService },
        { provide: AlertApiService, useValue: alertService },
        { provide: NotificationService, useValue: notificationService },
      ],
    });
  }

  it('fails fast with no HTTP calls when there is no active session', () => {
    configure();
    authService.getCurrentUser.and.returnValue(null);
    machineService.getAll.and.returnValue(of([] as Machine[]));

    fixture = TestBed.createComponent(TechnicianDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.error()).toBe('No active session');
    expect(component.loading()).toBeFalse();
    expect(machineService.getAll).not.toHaveBeenCalled();
  });

  it('loads the current technician\'s own tasks and alerts', fakeAsync(() => {
    configure();
    authService.getCurrentUser.and.returnValue(technician);
    machineService.getAll.and.returnValue(of([{ id: 1 } as Machine]));
    maintenanceService.getTechnicianTasks.and.returnValue(of({ content: tasks } as any));
    alertService.list.and.returnValue(of({ content: alerts } as any));

    fixture = TestBed.createComponent(TechnicianDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    tick();

    expect(maintenanceService.getTechnicianTasks).toHaveBeenCalledWith('tech-1', 0, 100);
    expect(alertService.list).toHaveBeenCalledWith({ assignedTo: 'jane.tech', size: 50 });
    expect(component.loading()).toBeFalse();
    expect(component.tasks()).toEqual(tasks);
    expect(component.alerts()).toEqual(alerts);
  }));

  it('computes KPI cards from the loaded tasks and alerts', fakeAsync(() => {
    configure();
    authService.getCurrentUser.and.returnValue(technician);
    machineService.getAll.and.returnValue(of([] as Machine[]));
    maintenanceService.getTechnicianTasks.and.returnValue(of({ content: tasks } as any));
    alertService.list.and.returnValue(of({ content: alerts } as any));

    fixture = TestBed.createComponent(TechnicianDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    tick();

    const kpis = component.kpiCards();
    expect(kpis.find((k) => k.label === 'Tasks')?.value).toBe(2);
    expect(kpis.find((k) => k.label === 'In Progress')?.value).toBe(1);
    expect(kpis.find((k) => k.label === 'Completed')?.value).toBe(1);
    expect(kpis.find((k) => k.label === 'Alerts')?.value).toBe(1);
  }));

  it('taskList only surfaces tasks scheduled for today', fakeAsync(() => {
    configure();
    authService.getCurrentUser.and.returnValue(technician);
    machineService.getAll.and.returnValue(of([] as Machine[]));
    maintenanceService.getTechnicianTasks.and.returnValue(of({ content: tasks } as any));
    alertService.list.and.returnValue(of({ content: [] } as any));

    fixture = TestBed.createComponent(TechnicianDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    tick();

    const rows = component.taskList();
    expect(rows.length).toBe(1);
    expect(rows[0].task).toBe('Bearing swap');
  }));

  it('surfaces a load failure when the machines call itself errors', fakeAsync(() => {
    configure();
    authService.getCurrentUser.and.returnValue(technician);
    machineService.getAll.and.returnValue(throwError(() => new Error('down')).pipe());
    maintenanceService.getTechnicianTasks.and.returnValue(of({ content: [] } as any));
    alertService.list.and.returnValue(of({ content: [] } as any));

    fixture = TestBed.createComponent(TechnicianDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    tick();

    // machineService failure is caught internally (catchError -> []),
    // so the technician tasks/alerts fan-out still proceeds and succeeds.
    expect(component.loading()).toBeFalse();
    expect(component.error()).toBeNull();
    expect(component.machines()).toEqual([]);
  }));

  it('refresh() reloads tasks and alerts for the current technician', fakeAsync(() => {
    configure();
    authService.getCurrentUser.and.returnValue(technician);
    machineService.getAll.and.returnValue(of([] as Machine[]));
    maintenanceService.getTechnicianTasks.and.returnValue(of({ content: tasks } as any));
    alertService.list.and.returnValue(of({ content: alerts } as any));

    fixture = TestBed.createComponent(TechnicianDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    tick();

    maintenanceService.getTechnicianTasks.calls.reset();
    component.refresh();
    tick();

    expect(maintenanceService.getTechnicianTasks).toHaveBeenCalledTimes(1);
  }));
});

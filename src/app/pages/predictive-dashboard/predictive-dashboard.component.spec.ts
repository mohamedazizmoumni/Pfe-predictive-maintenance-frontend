import { ComponentFixture, TestBed, discardPeriodicTasks, fakeAsync, tick } from '@angular/core/testing';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { PredictiveDashboardComponent } from './predictive-dashboard.component';
import { PredictiveApiService } from '../../core/services/predictive-api.service';
import { EquipmentService } from '../../core/services/equipment.service';
import { ToastService } from '../../core/services/toast.service';
import { AlertApiService } from '../../core/services/alert.service';
import { AuthService } from '../../core/services/auth.service';

describe('PredictiveDashboardComponent', () => {
  let component: PredictiveDashboardComponent;
  let fixture: ComponentFixture<PredictiveDashboardComponent>;

  let predictiveApi: jasmine.SpyObj<PredictiveApiService>;
  let equipmentService: jasmine.SpyObj<EquipmentService> & { machines$: BehaviorSubject<any[]> };
  let alertApi: jasmine.SpyObj<AlertApiService>;
  let authService: { currentUser$: BehaviorSubject<any> };
  let router: jasmine.SpyObj<Router>;
  let toastService: jasmine.SpyObj<ToastService>;
  let queryParamMap$: BehaviorSubject<any>;

  beforeEach(async () => {
    predictiveApi = jasmine.createSpyObj<PredictiveApiService>('PredictiveApiService', [
      'getSimulatedReadings',
      'getSensorData',
      'getFailureReports',
      'downloadFailureReportsPdf',
      'runPredictiveNow',
    ]);

    alertApi = jasmine.createSpyObj<AlertApiService>('AlertApiService', ['list']);

    equipmentService = jasmine.createSpyObj<EquipmentService>('EquipmentService', ['loadMachines']) as jasmine.SpyObj<EquipmentService> & {
      machines$: BehaviorSubject<any[]>;
    };
    equipmentService.machines$ = new BehaviorSubject<any[]>([
      {
        id: '1',
        name: 'Compressor-1',
        serialNumber: 'SN-001',
        model: 'M-200',
        manufacturer: 'Sentinel Corp',
        location: 'Plant A',
        status: 'OPERATIONAL',
      },
    ]) as any;

    authService = {
      currentUser$: new BehaviorSubject({
        roles: [{ id: '1', name: 'MANAGER' }],
      }),
    };

    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    toastService = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error']);

    queryParamMap$ = new BehaviorSubject(
      convertToParamMap({ page: '0', size: '20', sensorPage: '0', sensorSize: '100', sort: 'createdAt,desc' })
    );

    predictiveApi.getSimulatedReadings.and.returnValue(
      of([
        {
          machineId: 1,
          machineName: 'Compressor-1',
          timestamp: '2026-04-09T10:00:00Z',
          usageHours: 80,
          anomalyCount: 1,
          risk: 0.8,
          predictedFailureDays: 4,
          sensorValues: { TEMP: 74 },
        },
      ])
    );

    predictiveApi.getSensorData.and.returnValue(
      of({
        content: [
          {
            id: 701,
            timestamp: '2026-04-09T10:00:01Z',
            machineId: 1,
            sensorCode: 'TEMP01',
            sensorName: 'Bearing Temp',
            sensorType: 'TEMPERATURE',
            value: 75.4,
            unit: 'C',
            isAnomaly: false,
          },
        ],
        totalElements: 1,
        totalPages: 1,
        number: 0,
        size: 100,
      })
    );

    predictiveApi.getFailureReports.and.returnValue(
      of({
        content: [
          {
            id: 501,
            machineId: 1,
            machineName: 'Compressor-1',
            currentSensorState: '{"TEMP":74}',
            predictedFailureDays: 4,
            risk: 0.8,
            requiredParts: [],
            recommendedAction: 'Inspect seals',
            estimatedCost: 800,
            createdAt: '2026-04-09T09:00:00Z',
          },
        ],
        totalElements: 1,
        totalPages: 1,
        number: 0,
        size: 20,
      })
    );

    predictiveApi.downloadFailureReportsPdf.and.returnValue(
      of(new Blob(['report'], { type: 'application/pdf' }))
    );

    predictiveApi.runPredictiveNow.and.returnValue(of({ status: 'accepted' }));

    alertApi.list.and.returnValue(
      of({
        content: [
          {
            id: 900,
            machineId: 1,
            title: 'Prediction threshold exceeded',
            severity: 'WARNING',
            status: 'NEW',
            category: 'PREDICTION',
            viewed: false,
            createdDate: '2026-04-09T08:00:00Z',
          },
        ],
        totalElements: 1,
        totalPages: 1,
        number: 0,
        size: 20,
      } as any)
    );

    await TestBed.configureTestingModule({
      imports: [PredictiveDashboardComponent],
      providers: [
        { provide: PredictiveApiService, useValue: predictiveApi },
        { provide: EquipmentService, useValue: equipmentService },
        { provide: AlertApiService, useValue: alertApi },
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: queryParamMap$.asObservable(),
            snapshot: { queryParams: {} },
          },
        },
        { provide: ToastService, useValue: toastService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PredictiveDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('integration happy path: opens dashboard and fetches simulated/sensor data', () => {
    expect(predictiveApi.getSimulatedReadings).toHaveBeenCalled();
    expect(predictiveApi.getSensorData).toHaveBeenCalled();
    expect(component.simulatedReadings.length).toBe(1);
    expect(component.sensorDataPage?.content.length).toBe(1);

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Live Simulated Readings');
    expect(compiled.textContent).toContain('Dynamic Sensor Data Table');
    expect(compiled.textContent).toContain('Compressor-1');
  });

  it('integration happy path: loads failure reports and alerts widgets', () => {
    expect(predictiveApi.getFailureReports).toHaveBeenCalled();
    expect(alertApi.list).toHaveBeenCalled();
    expect(component.reportsPage?.content.length).toBe(1);
    expect(component.selectedReport?.id).toBe(501);

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Failure Reports');
    expect(compiled.textContent).toContain('Related Alerts');
  });

  it('integration happy path: dashboard polls every 5 seconds', fakeAsync(() => {
    (component as any).startLivePolling();

    const initialReadingsCalls = predictiveApi.getSimulatedReadings.calls.count();
    const initialSensorCalls = predictiveApi.getSensorData.calls.count();

    tick(5000);

    expect(predictiveApi.getSimulatedReadings.calls.count()).toBeGreaterThan(initialReadingsCalls);
    expect(predictiveApi.getSensorData.calls.count()).toBeGreaterThan(initialSensorCalls);

    component.ngOnDestroy();
    discardPeriodicTasks();
  }));

  it('integration happy path: machine filter updates URL and section queries', fakeAsync(() => {
    component.machineFilterControl.setValue('1');
    tick(260);

    expect(router.navigate).toHaveBeenCalled();

    queryParamMap$.next(
      convertToParamMap({
        machineId: '1',
        page: '0',
        size: '20',
        sensorPage: '0',
        sensorSize: '100',
        sort: 'createdAt,desc',
      })
    );

    const lastReportCall = predictiveApi.getFailureReports.calls.mostRecent();
    const lastSensorCall = predictiveApi.getSensorData.calls.mostRecent();
    expect(lastReportCall).toBeDefined();
    expect(lastSensorCall).toBeDefined();

    const lastReportQuery = lastReportCall!.args[0] as any;
    const lastSensorQuery = lastSensorCall!.args[0] as any;
    expect(lastReportQuery.machineId).toBe(1);
    expect(lastSensorQuery.machineId).toBe(1);
  }));

  it('integration happy path: run-now refreshes dashboard widgets', () => {
    const readingsBefore = predictiveApi.getSimulatedReadings.calls.count();
    const sensorBefore = predictiveApi.getSensorData.calls.count();
    const reportsBefore = predictiveApi.getFailureReports.calls.count();
    const alertsBefore = alertApi.list.calls.count();

    component.runPredictiveNow();

    expect(predictiveApi.runPredictiveNow).toHaveBeenCalled();
    expect(predictiveApi.getSimulatedReadings.calls.count()).toBeGreaterThan(readingsBefore);
    expect(predictiveApi.getSensorData.calls.count()).toBeGreaterThan(sensorBefore);
    expect(predictiveApi.getFailureReports.calls.count()).toBeGreaterThan(reportsBefore);
    expect(alertApi.list.calls.count()).toBeGreaterThan(alertsBefore);
  });

  it('integration happy path: export failure report download is triggered', () => {
    const anchor = document.createElement('a');
    const clickSpy = spyOn(anchor, 'click');
    spyOn(document, 'createElement').and.returnValue(anchor);
    spyOn(URL, 'createObjectURL').and.returnValue('blob:test');
    spyOn(URL, 'revokeObjectURL');

    component.exportFailureReportsPdf();

    expect(predictiveApi.downloadFailureReportsPdf).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(toastService.success).toHaveBeenCalled();
  });

  it('renders reports error state when API fails', () => {
    predictiveApi.getFailureReports.and.returnValue(
      throwError(() => ({ message: 'Failed to fetch failure reports', statusCode: 500 }))
    );

    queryParamMap$.next(convertToParamMap({ page: '0', size: '20', sensorPage: '0', sensorSize: '100', sort: 'createdAt,desc' }));
    fixture.detectChanges();

    expect(component.reportsError).toBe('Failed to fetch failure reports');
  });

  it('parses currentSensorState fallback when JSON is invalid', () => {
    const result = component.parseSensorState({
      id: 1,
      machineId: 1,
      machineName: 'Compressor-1',
      currentSensorState: '{invalid-json',
      predictedFailureDays: 4,
      risk: 0.9,
      requiredParts: [],
      recommendedAction: 'Inspect bearings',
      estimatedCost: 400,
      createdAt: '2026-04-09T10:00:00Z',
    });

    expect(result.parseFailed).toBeTrue();
    expect(result.raw).toContain('invalid-json');
  });

  it('applies risk badge thresholds for high medium and low', () => {
    expect(component.getRiskClass(0.9)).toContain('risk--high');
    expect(component.getRiskClass(0.7)).toContain('risk--medium');
    expect(component.getRiskClass(0.69)).toContain('risk--low');
  });
});

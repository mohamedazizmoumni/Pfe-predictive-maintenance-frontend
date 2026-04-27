import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { PredictiveApiService } from './predictive-api.service';
import { apiEndpoint } from '../http/api-base';

describe('PredictiveApiService', () => {
  let service: PredictiveApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [PredictiveApiService],
    });

    service = TestBed.inject(PredictiveApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('calls /v1/ml/health', () => {
    let response: unknown;

    service.getMlHealth().subscribe((payload) => {
      response = payload;
    });

    const req = httpMock.expectOne(apiEndpoint('/v1/ml/health'));
    expect(req.request.method).toBe('GET');

    req.flush({ status: 'UP' });

    expect(response).toEqual({ status: 'UP' });
  });

  it('submits prediction payload', () => {
    const payload = { features: [Array.from({ length: 89 }, (_, i) => i)] };

    service.predict(payload).subscribe();

    const req = httpMock.expectOne(apiEndpoint('/v1/ml/predict'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);

    req.flush({ prediction: [0.81] });
  });

  it('applies failure report query params including machine filter', () => {
    let response: any;

    service.getFailureReports({ machineId: 17, page: 2, size: 10, sort: 'createdAt,desc' }).subscribe((payload) => {
      response = payload;
    });

    const req = httpMock.expectOne((request) => {
      return request.url === apiEndpoint('/v1/machines/failure-reports')
        && request.params.get('machineId') === '17'
        && request.params.get('page') === '2'
        && request.params.get('size') === '10';
    });

    expect(req.request.method).toBe('GET');
    req.flush({
      content: [
        {
          id: 99,
          machineId: 17,
          machineName: 'Compressor-17',
          currentSensorState: '{"TEMP":80}',
          predictedFailureDays: 3,
          risk: 0.93,
          requiredParts: null,
          recommendedAction: 'Replace valve',
          estimatedCost: 1200,
          createdAt: '2026-04-09T12:00:00Z',
        },
      ],
      totalElements: 1,
      totalPages: 1,
      number: 2,
      size: 10,
    });

    expect(response.content[0].requiredParts).toEqual([]);
    expect(response.content[0].machineName).toBe('Compressor-17');
  });

  it('maps sensor-data endpoint and query params', () => {
    let response: any;

    service.getSensorData({ machineId: 5, page: 1, size: 50, sort: 'timestamp,desc' }).subscribe((payload) => {
      response = payload;
    });

    const req = httpMock.expectOne((request) => {
      return request.url === apiEndpoint('/v1/machines/sensor-data')
        && request.params.get('machineId') === '5'
        && request.params.get('page') === '1'
        && request.params.get('size') === '50'
        && request.params.get('sort') === 'timestamp,desc';
    });

    expect(req.request.method).toBe('GET');

    req.flush({
      content: [
        {
          id: 17,
          machine_id: 5,
          readingTime: '2026-04-09T12:10:00Z',
          code: 'TEMP01',
          name: 'Bearing Temp',
          type: 'TEMPERATURE',
          sensorValue: 81.5,
          unit: 'C',
          anomaly: true,
        },
      ],
      totalElements: 1,
      totalPages: 1,
      number: 1,
      size: 50,
    });

    expect(response.content[0]).toEqual({
      id: 17,
      timestamp: '2026-04-09T12:10:00Z',
      machineId: 5,
      sensorCode: 'TEMP01',
      sensorName: 'Bearing Temp',
      sensorType: 'TEMPERATURE',
      value: 81.5,
      unit: 'C',
      isAnomaly: true,
    });
  });

  it('posts run-now predictive command', () => {
    let response: unknown;

    service.runPredictiveNow().subscribe((payload) => {
      response = payload;
    });

    const req = httpMock.expectOne(apiEndpoint('/v1/machines/predictive/run-now'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});

    req.flush({ status: 'accepted' });
    expect(response).toEqual({ status: 'accepted' });
  });

  it('downloads failure reports pdf as blob', () => {
    let received: Blob | undefined;

    service.downloadFailureReportsPdf().subscribe((blob) => {
      received = blob;
    });

    const req = httpMock.expectOne((request) => {
      return request.url === apiEndpoint('/v1/machines/failure-reports')
        && request.params.get('downloadPdf') === 'true';
    });

    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');

    const blob = new Blob(['pdf-content'], { type: 'application/pdf' });
    req.flush(blob);

    expect(received).toBeTruthy();
    expect(received?.type).toBe('application/pdf');
  });

  it('normalizes backend errors', () => {
    let normalizedMessage: string | undefined;
    let statusCode: number | undefined;

    service.getMlModelInfo().subscribe({
      next: () => undefined,
      error: (error) => {
        normalizedMessage = error.message;
        statusCode = error.statusCode;
      },
    });

    const req = httpMock.expectOne(apiEndpoint('/v1/ml/model-info'));
    req.flush({ message: 'Model service unavailable' }, { status: 503, statusText: 'Service Unavailable' });

    expect(normalizedMessage).toBe('Model service unavailable');
    expect(statusCode).toBe(503);
  });
});

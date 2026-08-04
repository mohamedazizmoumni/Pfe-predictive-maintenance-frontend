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

  it('calls /ml/health', () => {
    let response: unknown;

    service.getMlHealth().subscribe((payload) => {
      response = payload;
    });

    const req = httpMock.expectOne(apiEndpoint('/ml/health'));
    expect(req.request.method).toBe('GET');

    req.flush({ status: 'UP' });

    expect(response).toEqual({ status: 'UP' });
  });

  it('submits prediction payload to /ml/predict', () => {
    const payload = { features: [Array.from({ length: 89 }, (_, i) => i)] };

    service.predict(payload).subscribe();

    const req = httpMock.expectOne(apiEndpoint('/ml/predict'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);

    req.flush({ prediction: [0.81] });
  });

  it('normalizes backend errors (message key)', () => {
    let normalizedMessage: string | undefined;
    let statusCode: number | undefined;

    service.getMlModelInfo().subscribe({
      next: () => undefined,
      error: (error) => {
        normalizedMessage = error.message;
        statusCode = error.statusCode;
      },
    });

    const req = httpMock.expectOne(apiEndpoint('/ml/model-info'));
    req.flush({ message: 'Model service unavailable' }, { status: 503, statusText: 'Service Unavailable' });

    expect(normalizedMessage).toBe('Model service unavailable');
    expect(statusCode).toBe(503);
  });

  it('builds a failure report by joining machine, latest prediction, and recommendation calls', () => {
    let response: any;

    service.getFailureReports({ machineId: 17, page: 0, size: 20 }).subscribe((payload) => {
      response = payload;
    });

    const machineReq = httpMock.expectOne(apiEndpoint('/machines/17'));
    machineReq.flush({ id: 17, name: 'Compressor-17' });

    const predictionReq = httpMock.expectOne(apiEndpoint('/machines/17/predictions/latest'));
    predictionReq.flush({ id: 99, rulValue: 3, riskLevel: 'HIGH', createdDate: '2026-04-09T12:00:00Z' });

    const recommendationReq = httpMock.expectOne(apiEndpoint('/recommendations/machine/17'));
    recommendationReq.flush({ recommendedAction: 'Replace valve', estimatedCost: 1200 });

    expect(response.content.length).toBe(1);
    expect(response.content[0]).toEqual(
      jasmine.objectContaining({
        machineId: 17,
        machineName: 'Compressor-17',
        predictedFailureDays: 3,
        recommendedAction: 'Replace valve',
        estimatedCost: 1200,
      })
    );
  });

  it('returns an empty page from getFailureReports without a machineId', () => {
    let response: any;

    service.getFailureReports({}).subscribe((payload) => {
      response = payload;
    });

    expect(response).toEqual({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 });
  });

  it('maps prediction history into sensor-data points', () => {
    let response: any;

    service.getSensorData({ machineId: 5, page: 1, size: 50 }).subscribe((payload) => {
      response = payload;
    });

    const req = httpMock.expectOne((request) => {
      return request.url === apiEndpoint('/machines/5/predictions')
        && request.params.get('page') === '1'
        && request.params.get('size') === '50';
    });

    expect(req.request.method).toBe('GET');

    req.flush({
      content: [
        {
          id: 17,
          machine_id: 5,
          readingTime: '2026-04-09T12:10:00Z',
          rulValue: 81.5,
          anomaly: true,
        },
      ],
      totalElements: 1,
      totalPages: 1,
      number: 1,
      size: 50,
    });

    expect(response.content[0]).toEqual(
      jasmine.objectContaining({
        id: 17,
        machineId: 5,
        timestamp: '2026-04-09T12:10:00Z',
        value: 81.5,
        isAnomaly: true,
      })
    );
  });

  it('returns an empty page from getSensorData without a machineId', () => {
    let response: any;

    service.getSensorData({}).subscribe((payload) => {
      response = payload;
    });

    expect(response).toEqual({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 100 });
  });

  it('posts run-now to /ml/run-predictions', () => {
    let response: unknown;

    service.runPredictiveNow().subscribe((payload) => {
      response = payload;
    });

    const req = httpMock.expectOne(apiEndpoint('/ml/run-predictions'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});

    req.flush({ status: 'accepted' });
    expect(response).toEqual({ status: 'accepted' });
  });

  it('propagates the real error on a failed run-now instead of a fake success', () => {
    let receivedError: any;

    service.runPredictiveNow().subscribe({
      next: () => fail('expected an error, not a success value'),
      error: (error) => {
        receivedError = error;
      },
    });

    const req = httpMock.expectOne(apiEndpoint('/ml/run-predictions'));
    req.flush({ message: 'ML service unreachable' }, { status: 503, statusText: 'Service Unavailable' });

    expect(receivedError.statusCode).toBe(503);
    expect(receivedError.message).toBe('ML service unreachable');
  });

  it('downloads failure reports as a client-built PDF blob', (done) => {
    service.downloadFailureReportsPdf(17).subscribe((blob) => {
      expect(blob instanceof Blob).toBe(true);
      expect(blob.type).toBe('application/pdf');
      expect(blob.size).toBeGreaterThan(0);
      done();
    });

    httpMock.expectOne(apiEndpoint('/machines/17')).flush({ id: 17, name: 'Compressor-17' });
    httpMock.expectOne(apiEndpoint('/machines/17/predictions/latest')).flush({ rulValue: 3, riskLevel: 'HIGH' });
    httpMock.expectOne(apiEndpoint('/recommendations/machine/17')).flush({ recommendedAction: 'Replace valve' });
  });

  it('downloads failure reports as a CSV blob', (done) => {
    service.downloadFailureReportsCsv(17).subscribe((blob) => {
      expect(blob instanceof Blob).toBe(true);
      expect(blob.type).toContain('text/csv');
      done();
    });

    httpMock.expectOne(apiEndpoint('/machines/17')).flush({ id: 17, name: 'Compressor-17' });
    httpMock.expectOne(apiEndpoint('/machines/17/predictions/latest')).flush({ rulValue: 3, riskLevel: 'HIGH' });
    httpMock.expectOne(apiEndpoint('/recommendations/machine/17')).flush({ recommendedAction: 'Replace valve' });
  });

  it('rejects PDF/CSV export without a machineId', (done) => {
    service.downloadFailureReportsPdf().subscribe({
      next: () => fail('expected an error'),
      error: (error) => {
        expect(error.statusCode).toBe(400);
        done();
      },
    });
  });
});

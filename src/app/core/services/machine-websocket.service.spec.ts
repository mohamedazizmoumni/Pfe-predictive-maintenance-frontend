import { TestBed } from '@angular/core/testing';
import { MachineWebSocketService, MachineTelemetry } from './machine-websocket.service';
import { AuthService } from './auth.service';
import { AlertStreamEvent } from '../models/sentinel.models';

describe('MachineWebSocketService', () => {
  let service: MachineWebSocketService;
  let authServiceSpy: jasmine.SpyObj<AuthService>;

  beforeEach(() => {
    authServiceSpy = jasmine.createSpyObj('AuthService', ['getAccessToken']);

    TestBed.configureTestingModule({
      providers: [
        MachineWebSocketService,
        { provide: AuthService, useValue: authServiceSpy },
      ],
    });

    service = TestBed.inject(MachineWebSocketService);
  });

  afterEach(() => {
    // The service never actually opened a real socket in these tests, but
    // disconnect() must still be safe to call unconditionally.
    service.disconnect();
  });

  it('starts disconnected with no telemetry or alert events', () => {
    expect(service.isConnected()).toBeFalse();

    let connected: boolean | undefined;
    const sub = service.connected$.subscribe((c) => (connected = c));
    sub.unsubscribe();

    expect(connected).toBeFalse();
  });

  it('connect() refuses to open a socket when no auth token is available', () => {
    authServiceSpy.getAccessToken.and.returnValue(null);
    spyOn(localStorage, 'getItem').and.returnValue(null);

    service.connect();

    // No token -> the STOMP client is never constructed, so there is
    // nothing to be "connected" to.
    expect((service as any).client).toBeNull();
    expect(service.isConnected()).toBeFalse();
  });

  it('disconnect() is a safe no-op when never connected', () => {
    expect(() => service.disconnect()).not.toThrow();
    expect(service.isConnected()).toBeFalse();
  });

  it('parses a single telemetry object pushed on the machines topic', () => {
    const telemetry: MachineTelemetry = {
      machineId: 7,
      temperature: 88.5,
      vibration: 0.42,
      health: 76,
      timestamp: '2026-07-28T10:00:00Z',
    };

    // Bypass the real STOMP transport: install a fake client so we can
    // exercise the private subscription/parsing logic directly.
    const fakeSubscribe = jasmine.createSpy('subscribe').and.callFake((_topic: string, cb: (msg: { body: string }) => void) => {
      cb({ body: JSON.stringify(telemetry) });
      return { unsubscribe: () => {} } as any;
    });
    (service as any).client = { connected: true, subscribe: fakeSubscribe, deactivate: () => {} };

    let received: unknown;
    service.telemetry$.subscribe((t) => (received = t));

    (service as any).subscribeToMachines();

    expect(fakeSubscribe).toHaveBeenCalledWith('/topic/machines', jasmine.any(Function));
    expect(received).toEqual(telemetry);
  });

  it('fans out an array telemetry payload into individual emissions', () => {
    const batch: MachineTelemetry[] = [
      { machineId: 1, temperature: 70, vibration: 0.1, health: 90, timestamp: 't1' },
      { machineId: 2, temperature: 75, vibration: 0.2, health: 80, timestamp: 't2' },
    ];

    const fakeSubscribe = jasmine.createSpy('subscribe').and.callFake((_topic: string, cb: (msg: { body: string }) => void) => {
      cb({ body: JSON.stringify(batch) });
      return { unsubscribe: () => {} } as any;
    });
    (service as any).client = { connected: true, subscribe: fakeSubscribe, deactivate: () => {} };

    const emissions: (MachineTelemetry | null)[] = [];
    service.telemetry$.subscribe((t) => emissions.push(t));

    (service as any).subscribeToMachines();

    // Initial null + both batch entries emitted in order.
    expect(emissions).toEqual([null, batch[0], batch[1]]);
  });

  it('does not throw and does not subscribe when the client is not connected', () => {
    (service as any).client = { connected: false, subscribe: jasmine.createSpy('subscribe'), deactivate: () => {} };

    expect(() => (service as any).subscribeToMachines()).not.toThrow();
    expect((service as any).client.subscribe).not.toHaveBeenCalled();
  });

  it('silently ignores an unparsable telemetry message instead of throwing', () => {
    const fakeSubscribe = jasmine.createSpy('subscribe').and.callFake((_topic: string, cb: (msg: { body: string }) => void) => {
      cb({ body: 'not-json' });
      return { unsubscribe: () => {} } as any;
    });
    (service as any).client = { connected: true, subscribe: fakeSubscribe, deactivate: () => {} };

    expect(() => (service as any).subscribeToMachines()).not.toThrow();
  });

  it('parses alert incident events pushed on the alerts topic', () => {
    const event: AlertStreamEvent = {
      alertId: 5,
      machineId: 7,
      title: 'Press-14 degrading',
      severity: 'WARNING' as any,
      status: 'NEW' as any,
      eventType: 'CREATED' as any,
      timestamp: '2026-07-28T10:00:00Z',
    };

    const fakeSubscribe = jasmine.createSpy('subscribe').and.callFake((_topic: string, cb: (msg: { body: string }) => void) => {
      cb({ body: JSON.stringify(event) });
      return { unsubscribe: () => {} } as any;
    });
    (service as any).client = { connected: true, subscribe: fakeSubscribe, deactivate: () => {} };

    let received: unknown;
    service.alertEvents$.subscribe((e) => (received = e));

    (service as any).subscribeToAlerts();

    expect(fakeSubscribe).toHaveBeenCalledWith('/topic/alerts', jasmine.any(Function));
    expect(received).toEqual(event);
  });

  it('disconnect() unsubscribes, deactivates the client, and resets all streams', () => {
    const unsubscribeSpy = jasmine.createSpy('unsubscribe');
    const deactivateSpy = jasmine.createSpy('deactivate');

    (service as any).subscription = { unsubscribe: unsubscribeSpy };
    (service as any).alertsSubscription = { unsubscribe: unsubscribeSpy };
    (service as any).client = { deactivate: deactivateSpy };
    (service as any).telemetrySubject.next({ machineId: 1, temperature: 1, vibration: 1, health: 1, timestamp: 't' });
    (service as any).connectedSubject.next(true);

    service.disconnect();

    expect(unsubscribeSpy).toHaveBeenCalledTimes(2);
    expect(deactivateSpy).toHaveBeenCalledTimes(1);
    expect((service as any).client).toBeNull();
    expect(service.isConnected()).toBeFalse();

    let telemetry: MachineTelemetry | null | undefined;
    service.telemetry$.subscribe((t) => (telemetry = t));
    expect(telemetry).toBeNull();
  });
});

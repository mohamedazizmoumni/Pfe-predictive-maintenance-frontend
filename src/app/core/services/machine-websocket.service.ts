import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Client, StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { AuthService } from './auth.service';
import { AlertStreamEvent } from '../models/sentinel.models';
import { environment } from '../../../environments/environment';

/**
 * Real-time machine telemetry data received from backend
 */
export interface MachineTelemetry {
  machineId: number;
  serialNumber?: string;
  name?: string;
  status?: string;
  
  // Core metrics
  temperature: number;
  vibration: number;
  health: number;
  
  // Additional metrics from backend
  remainingUsefulLife?: number;
  riskScore?: number;
  bearingWear?: number;
  thermalStress?: number;
  lubricationLevel?: number;
  fatigueIndex?: number;
  efficiencyScore?: number;  // Backend uses this for OEE
  efficiency?: number;        // Backend uses this for utilization
  
  // Sensor data
  powerConsumption?: number;
  pressure?: number;
  acousticEmission?: number;
  current?: number;
  voltage?: number;
  rotationSpeed?: number;     // Backend uses this for performance
  
  // Environmental
  ambientTemperature?: number;
  loadFactor?: number;
  operatingSpeed?: number;
  operatingHours?: number;
  
  // Status flags
  isCritical?: boolean;
  isDegrading?: boolean;

  // ML prediction (may be trained-model output OR a rule-based fallback when
  // the ML service was unreachable — check mlPredictionAvailable/modelVersion
  // before presenting these as a live model prediction)
  predictedRUL?: number;
  anomalyProbability?: number;
  riskLevel?: string;
  failureProbability?: number;
  predictedFailureType?: string;
  recommendedAction?: string;
  confidenceScore?: number;
  requiresImmediateAction?: boolean;
  /** False when this reading's prediction fields came from the backend's rule-based fallback, not the trained model. */
  mlPredictionAvailable?: boolean;
  /** "fallback-1.0" when mlPredictionAvailable is false; the real model's version string otherwise. */
  modelVersion?: string;

  timestamp: string;
}

/**
 * Real environmental sensor reading (e.g. ESP32 + DHT11), independent of the
 * simulated MachineTelemetry stream above. Broadcast per-machine on
 * /topic/machines/{machineId}/environment.
 */
export interface EnvironmentReading {
  machineId: number;
  temperature: number;
  humidity: number;
  riskLevel: 'NORMAL' | 'WARNING' | 'CRITICAL' | string;
  recommendations?: string[];
  timestamp: string;
}

/**
 * WebSocket service for receiving real-time machine telemetry from backend.
 * 
 * IMPORTANT: This service ONLY receives data from the backend.
 * It does NOT generate, simulate, or modify any machine data.
 * The backend is the single source of truth for all machine telemetry.
 */
@Injectable({
  providedIn: 'root'
})
export class MachineWebSocketService implements OnDestroy {
  private client: Client | null = null;
  private subscription: StompSubscription | null = null;
  private alertsSubscription: StompSubscription | null = null;
  private environmentSubscription: StompSubscription | null = null;
  private environmentMachineId: number | null = null;

  // Stream of machine telemetry data from backend
  private telemetrySubject = new BehaviorSubject<MachineTelemetry | null>(null);
  public telemetry$: Observable<MachineTelemetry | null> = this.telemetrySubject.asObservable();

  // Stream of real environmental readings (ESP32/DHT11), scoped to whichever
  // machine subscribeToEnvironment() was last called for.
  private environmentSubject = new BehaviorSubject<EnvironmentReading | null>(null);
  public environment$: Observable<EnvironmentReading | null> = this.environmentSubject.asObservable();

  // Stream of live alert incident events (CREATED/UPDATED/RESOLVED) from
  // backend — broadcast by the same MachineStreamingService tick, over the
  // same connection, on the /topic/alerts destination.
  private alertEventSubject = new BehaviorSubject<AlertStreamEvent | null>(null);
  public alertEvents$: Observable<AlertStreamEvent | null> = this.alertEventSubject.asObservable();

  // Connection status
  private connectedSubject = new BehaviorSubject<boolean>(false);
  public connected$: Observable<boolean> = this.connectedSubject.asObservable();

  private readonly WS_ENDPOINT = `${environment.wsUrl}/ws-machine`;
  private readonly TOPIC = '/topic/machines';
  private readonly ALERTS_TOPIC = '/topic/alerts';
  
  constructor(private authService: AuthService) {
    console.log('🔌 MachineWebSocketService initialized');
  }

  /**
   * Get JWT token from localStorage
   */
  private getAuthToken(): string | null {
    return this.authService.getAccessToken() ?? localStorage.getItem('access_token') ?? localStorage.getItem('token');
  }

  /**
   * Connect to the WebSocket server and subscribe to machine telemetry updates
   */
  connect(): void {
    if (this.client?.connected) {
      console.log('⚠️ WebSocket already connected');
      return;
    }

    const token = this.getAuthToken();
    if (!token) {
      console.error('❌ No authentication token found. Cannot connect to WebSocket.');
      return;
    }

    console.log('🔌 Connecting to WebSocket:', this.WS_ENDPOINT);
    console.log('🔑 Using authentication token');

    this.client = new Client({
      webSocketFactory: () => new SockJS(this.WS_ENDPOINT) as WebSocket,
      
      // Add JWT token to connection headers
      connectHeaders: {
        'Authorization': `Bearer ${token}`
      },
      
      debug: (str) => {
        console.log('🔌 STOMP Debug:', str);
      },
      
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,

      onConnect: () => {
        console.log('✅ WebSocket connected successfully');
        this.connectedSubject.next(true);
        this.subscribeToMachines();
        this.subscribeToAlerts();
        if (this.environmentMachineId !== null) {
          this.subscribeToEnvironment(this.environmentMachineId);
        }
      },

      onStompError: (frame) => {
        console.error('❌ STOMP error:', frame.headers['message']);
        console.error('Details:', frame.body);
        this.connectedSubject.next(false);
      },

      onWebSocketClose: () => {
        console.log('🔌 WebSocket connection closed');
        this.connectedSubject.next(false);
      },

      onWebSocketError: (error) => {
        console.error('❌ WebSocket error:', error);
        this.connectedSubject.next(false);
      }
    });

    this.client.activate();
  }

  /**
   * Subscribe to machine telemetry topic
   */
  private subscribeToMachines(): void {
    if (!this.client?.connected) {
      console.error('❌ Cannot subscribe: WebSocket not connected');
      return;
    }

    console.log('📡 Subscribing to topic:', this.TOPIC);

    this.subscription = this.client.subscribe(this.TOPIC, (message) => {
      try {
        const parsed = JSON.parse(message.body);
        
        // Backend might send array or single object
        const telemetryData = Array.isArray(parsed) ? parsed : [parsed];
        
        console.log('📊 Received machine telemetry from backend:', telemetryData);
        console.log('📊 Raw telemetry data (first item):', JSON.stringify(telemetryData[0], null, 2));
        
        // Emit each telemetry object
        telemetryData.forEach((telemetry: MachineTelemetry) => {
          console.log('📊 Processing telemetry:', {
            machineId: telemetry.machineId,
            temperature: telemetry.temperature,
            vibration: telemetry.vibration,
            health: telemetry.health,
            efficiency: telemetry.efficiency,
            efficiencyScore: telemetry.efficiencyScore,
            rotationSpeed: telemetry.rotationSpeed,
            timestamp: telemetry.timestamp
          });
          this.telemetrySubject.next(telemetry);
        });
      } catch (error) {
        console.error('❌ Error parsing telemetry message:', error);
      }
    });

    console.log('✅ Subscribed to machine telemetry updates');
  }

  /**
   * Subscribe to the live alert incident topic. One consistent payload
   * shape per event, distinguished by `eventType`: CREATED (new incident,
   * opened with an email already sent server-side), UPDATED (severity
   * changed on an already-active incident), or RESOLVED (machine recovered
   * — the incident is closed automatically).
   */
  private subscribeToAlerts(): void {
    if (!this.client?.connected) {
      console.error('❌ Cannot subscribe: WebSocket not connected');
      return;
    }

    console.log('📡 Subscribing to topic:', this.ALERTS_TOPIC);

    this.alertsSubscription = this.client.subscribe(this.ALERTS_TOPIC, (message) => {
      try {
        const parsed = JSON.parse(message.body);
        const events = Array.isArray(parsed) ? parsed : [parsed];

        events.forEach((event: AlertStreamEvent) => {
          console.log('🚨 Received alert event:', event.eventType, event);
          this.alertEventSubject.next(event);
        });
      } catch (error) {
        console.error('❌ Error parsing alert event message:', error);
      }
    });

    console.log('✅ Subscribed to alert incident updates');
  }

  /**
   * Subscribe to real environmental readings (ESP32/DHT11) for one machine.
   * Unlike /topic/machines (subscribed once for all machines), this topic is
   * per-machine, so callers must invoke this once they know which machine's
   * detail page they're viewing. Safe to call before connect() resolves —
   * the machineId is remembered and subscribed automatically in onConnect.
   */
  subscribeToEnvironment(machineId: number): void {
    this.environmentMachineId = machineId;

    if (!this.client?.connected) {
      // Will be subscribed once the connection is established.
      return;
    }

    if (this.environmentSubscription) {
      this.environmentSubscription.unsubscribe();
      this.environmentSubscription = null;
    }

    const topic = `/topic/machines/${machineId}/environment`;
    console.log('📡 Subscribing to topic:', topic);

    this.environmentSubscription = this.client.subscribe(topic, (message) => {
      try {
        const reading: EnvironmentReading = JSON.parse(message.body);
        console.log('🌡️ Received environmental reading:', reading);
        this.environmentSubject.next(reading);
      } catch (error) {
        console.error('❌ Error parsing environmental reading message:', error);
      }
    });
  }

  /**
   * Stop receiving environmental readings (e.g. user navigated away from the
   * machine detail page).
   */
  unsubscribeFromEnvironment(): void {
    this.environmentMachineId = null;
    if (this.environmentSubscription) {
      this.environmentSubscription.unsubscribe();
      this.environmentSubscription = null;
    }
    this.environmentSubject.next(null);
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
      console.log('📡 Unsubscribed from machine telemetry');
    }

    if (this.alertsSubscription) {
      this.alertsSubscription.unsubscribe();
      this.alertsSubscription = null;
      console.log('📡 Unsubscribed from alert incident updates');
    }

    if (this.environmentSubscription) {
      this.environmentSubscription.unsubscribe();
      this.environmentSubscription = null;
      console.log('📡 Unsubscribed from environmental readings');
    }
    this.environmentMachineId = null;

    if (this.client) {
      this.client.deactivate();
      this.client = null;
      console.log('🔌 WebSocket disconnected');
    }

    this.connectedSubject.next(false);
    this.telemetrySubject.next(null);
    this.alertEventSubject.next(null);
    this.environmentSubject.next(null);
  }

  /**
   * Check if WebSocket is currently connected
   */
  isConnected(): boolean {
    return this.client?.connected ?? false;
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}

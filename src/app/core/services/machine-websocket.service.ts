import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Client, StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { AuthService } from './auth.service';

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
  
  // Stream of machine telemetry data from backend
  private telemetrySubject = new BehaviorSubject<MachineTelemetry | null>(null);
  public telemetry$: Observable<MachineTelemetry | null> = this.telemetrySubject.asObservable();
  
  // Connection status
  private connectedSubject = new BehaviorSubject<boolean>(false);
  public connected$: Observable<boolean> = this.connectedSubject.asObservable();
  
  private readonly WS_ENDPOINT = 'http://localhost:8080/ws-machine';
  private readonly TOPIC = '/topic/machines';
  
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
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
      console.log('📡 Unsubscribed from machine telemetry');
    }

    if (this.client) {
      this.client.deactivate();
      this.client = null;
      console.log('🔌 WebSocket disconnected');
    }

    this.connectedSubject.next(false);
    this.telemetrySubject.next(null);
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

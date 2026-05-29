import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, firstValueFrom, map, throwError } from 'rxjs';
import { Client, StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { AuthService } from './auth.service';
import { HttpClient } from '@angular/common/http';
import { apiEndpoint } from '../http/api-base';
import {
  AiDiagnosisRequest,
  AiMaintenanceDiagnosis,
  AiInsight,
  NlpAlert,
  NlpFeedItem,
  Recommendation,
  RiskLevel,
  TechnicianReportResult,
} from '../models/nlp.models';

@Injectable({ providedIn: 'root' })
export class NlpService implements OnDestroy {
  private client: Client | null = null;
  private subscriptionAlerts: StompSubscription | null = null;
  private subscriptionInsights: StompSubscription | null = null;

  private feedSubject = new BehaviorSubject<NlpFeedItem[]>([]);
  public feed$: Observable<NlpFeedItem[]> = this.feedSubject.asObservable();

  private recommendationsSubject = new BehaviorSubject<Recommendation[]>([]);
  public recommendations$ = this.recommendationsSubject.asObservable();

  private connectedSubject = new BehaviorSubject<boolean>(false);
  public connected$ = this.connectedSubject.asObservable();

  private readonly WS_ENDPOINT = 'http://localhost:8080/ws-nlp';
  private readonly TOPIC_ALERTS = '/topic/nlp-alerts';
  private readonly TOPIC_INSIGHTS = '/topic/machine-insights';
  private readonly ANALYZE_ENDPOINT = apiEndpoint('/nlp/analyze');

  constructor(private authService: AuthService, private http: HttpClient) {}

  private getAuthToken(): string | null {
    return this.authService.getAccessToken() ?? localStorage.getItem('access_token') ?? localStorage.getItem('token');
  }

  connect(): void {
    if (this.client?.connected) return;

    const token = this.getAuthToken();
    if (!token) return;

    this.client = new Client({
      webSocketFactory: () => new SockJS(this.WS_ENDPOINT) as WebSocket,
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      reconnectDelay: 5000,
      onConnect: () => {
        this.connectedSubject.next(true);
        this.subscribeToTopics();
      },
      onWebSocketClose: () => this.connectedSubject.next(false),
      onWebSocketError: () => this.connectedSubject.next(false),
    });

    this.client.activate();
  }

  private subscribeToTopics(): void {
    if (!this.client?.connected) return;

    this.subscriptionAlerts = this.client.subscribe(this.TOPIC_ALERTS, (message) => {
      try {
        const payload = JSON.parse(message.body) as NlpAlert | NlpAlert[];
        const items = Array.isArray(payload) ? payload : [payload];
        const feed = this.feedSubject.getValue();
        const newItems = items.map((a) => ({ alert: a } as NlpFeedItem));
        this.feedSubject.next([...newItems, ...feed].slice(0, 200));
      } catch (e) {
        console.error('Failed parsing NLP alert', e);
      }
    });

    this.subscriptionInsights = this.client.subscribe(this.TOPIC_INSIGHTS, (message) => {
      try {
        const payload = JSON.parse(message.body) as AiInsight | AiInsight[];
        const items = Array.isArray(payload) ? payload : [payload];
        const feed = this.feedSubject.getValue();
        const newItems = items.map((i) => ({ insight: i } as NlpFeedItem));
        this.feedSubject.next([...newItems, ...feed].slice(0, 200));
      } catch (e) {
        console.error('Failed parsing NLP insight', e);
      }
    });
  }

  disconnect(): void {
    if (this.subscriptionAlerts) {
      this.subscriptionAlerts.unsubscribe();
      this.subscriptionAlerts = null;
    }
    if (this.subscriptionInsights) {
      this.subscriptionInsights.unsubscribe();
      this.subscriptionInsights = null;
    }
    if (this.client) {
      this.client.deactivate();
      this.client = null;
    }
    this.connectedSubject.next(false);
  }

  analyzeReport(payload: AiDiagnosisRequest): Observable<AiMaintenanceDiagnosis> {
    const body: AiDiagnosisRequest = {
      machineId: payload.machineId,
      text: payload.text,
    };

    return this.http.post<Partial<AiMaintenanceDiagnosis> & Record<string, any>>(this.ANALYZE_ENDPOINT, body).pipe(
      map((response) => this.normalizeDiagnosis(response, payload.text)),
      catchError((error) => {
        console.error('Failed to analyze technician report', error);

        if (this.isUnavailableGateway(error)) {
          console.warn('NLP backend returned 502. Using local fallback diagnosis.');
          return of(this.createFallbackDiagnosis(payload));
        }

        return throwError(() => new Error('AI diagnosis is temporarily unavailable.'));
      })
    );
  }

  diagnoseIssue(text: string, machineId: number): Observable<AiMaintenanceDiagnosis> {
    return this.analyzeReport({ machineId, text });
  }

  analyzeReportPromise(payload: AiDiagnosisRequest): Promise<AiMaintenanceDiagnosis> {
    return firstValueFrom(this.analyzeReport(payload));
  }

  async fetchRecommendations(): Promise<Recommendation[]> {
    try {
      const res = await firstValueFrom(this.http.get<Recommendation[]>(apiEndpoint('/nlp/recommendations')));
      this.recommendationsSubject.next(res ?? []);
      return res ?? [];
    } catch (e) {
      console.error('Failed to fetch recommendations', e);
      this.recommendationsSubject.next([]);
      return [];
    }
  }

  ngOnDestroy(): void {
    this.disconnect();
  }

  private normalizeDiagnosis(
    response: Partial<AiMaintenanceDiagnosis> & Record<string, any>,
    sourceText: string
  ): AiMaintenanceDiagnosis {
    return {
      issueType: this.normalizeIssueType(response.issueType ?? response['failureType'] ?? response['summary']),
      severity: this.normalizeSeverity(response.severity ?? response['riskLevel']),
      confidence: this.normalizeConfidence(response.confidence ?? response['score']),
      probableCauses: this.normalizeTextList(response.probableCauses ?? response['rootCauses'] ?? response['causes']),
      recommendedActions: this.normalizeTextList(response.recommendedActions ?? response['recommendations'] ?? response['actions']),
      machineName: response.machineName,
      machineId: response.machineId,
      analyzedAt: response.analyzedAt ?? new Date().toISOString(),
      sourceText,
    };
  }

  private normalizeTextList(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value
        .map((item) => {
          if (typeof item === 'string') {
            return item.trim();
          }

          if (item && typeof item === 'object') {
            const candidate = (item as any).cause ?? (item as any).title ?? (item as any).description ?? (item as any).name ?? (item as any).label;
            return typeof candidate === 'string' ? candidate.trim() : '';
          }

          return '';
        })
        .filter(Boolean);
    }

    if (typeof value === 'string' && value.trim()) {
      return [value.trim()];
    }

    return [];
  }

  private normalizeIssueType(value: unknown): string {
    if (typeof value !== 'string' || !value.trim()) {
      return 'Unknown issue';
    }

    return value
      .trim()
      .replace(/[_-]+/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  private normalizeSeverity(value: unknown): RiskLevel {
    const raw = typeof value === 'string' ? value.toUpperCase() : '';

    if (raw === 'LOW' || raw === 'MEDIUM' || raw === 'HIGH' || raw === 'CRITICAL') {
      return raw;
    }

    return 'LOW';
  }

  private normalizeConfidence(value: unknown): number {
    const numeric = typeof value === 'number' ? value : Number(value);

    if (!Number.isFinite(numeric)) {
      return 0;
    }

    return Math.min(1, Math.max(0, numeric));
  }

  private isUnavailableGateway(error: unknown): boolean {
    const status = typeof error === 'object' && error !== null ? (error as { status?: unknown }).status : undefined;
    return status === 502;
  }

  private createFallbackDiagnosis(payload: AiDiagnosisRequest): AiMaintenanceDiagnosis {
    const { machineId, text: sourceText } = payload;
    const text = sourceText.toLowerCase();

    if (/(overheat|temperature|heat|cooling fan|fan)/.test(text)) {
      return {
        issueType: 'Thermal anomaly detected',
        severity: 'HIGH',
        confidence: 0.42,
        probableCauses: ['Cooling airflow restriction', 'Fan degradation', 'Excessive load or poor ventilation'],
        recommendedActions: [
          'Inspect cooling fans and heat sinks',
          'Check temperature sensors and airflow pathways',
          'Reduce load until the machine returns to normal temperature',
        ],
        machineId,
        analyzedAt: new Date().toISOString(),
        sourceText,
      };
    }

    if (/(vibration|vibrating|noise|noisy|bearing)/.test(text)) {
      return {
        issueType: 'Mechanical vibration detected',
        severity: 'MEDIUM',
        confidence: 0.4,
        probableCauses: ['Loose mounting', 'Bearing wear', 'Imbalance or misalignment'],
        recommendedActions: [
          'Inspect mounting bolts and alignment',
          'Check bearings for wear or play',
          'Record vibration readings before and after intervention',
        ],
        machineId,
        analyzedAt: new Date().toISOString(),
        sourceText,
      };
    }

    if (/(hydraulic|pressure|pump|leak)/.test(text)) {
      return {
        issueType: 'Hydraulic pressure instability',
        severity: 'HIGH',
        confidence: 0.39,
        probableCauses: ['Pressure fluctuation in pump circuit', 'Fluid leak', 'Sensor drift or contamination'],
        recommendedActions: [
          'Inspect the hydraulic circuit for leaks',
          'Validate pump pressure and sensor calibration',
          'Check fluid level and contamination indicators',
        ],
        machineId,
        analyzedAt: new Date().toISOString(),
        sourceText,
      };
    }

    if (/(conveyor|slowdown|motor|belt|production line)/.test(text)) {
      return {
        issueType: 'Throughput degradation detected',
        severity: 'MEDIUM',
        confidence: 0.37,
        probableCauses: ['Motor strain', 'Belt slippage', 'Downstream blockage or scheduling issue'],
        recommendedActions: [
          'Check conveyor tension and motor load',
          'Inspect for obstructions along the line',
          'Review recent production and maintenance events',
        ],
        machineId,
        analyzedAt: new Date().toISOString(),
        sourceText,
      };
    }

    return {
      issueType: 'Manual inspection required',
      severity: 'LOW',
      confidence: 0.2,
      probableCauses: ['NLP backend unavailable', 'Insufficient machine-specific indicators in the text'],
      recommendedActions: [
        'Review the machine context and recent maintenance history',
        'Retry the diagnosis once the NLP backend is available',
        'Capture sensor readings or a more specific symptom description',
      ],
      machineId,
      analyzedAt: new Date().toISOString(),
      sourceText,
    };
  }
}

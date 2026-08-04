// nlp.service.ts
import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject, of } from 'rxjs';
import { catchError, firstValueFrom, map, throwError } from 'rxjs';
import { Client, StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { AuthService } from './auth.service';
import { HttpClient } from '@angular/common/http';
import { apiEndpoint } from '../http/api-base';
import { environment } from '../../../environments/environment';
import {
  AiDiagnosisRequest,
  AiImageAnalysis,
  AiImageDiagnosisRequest,
  AiMaintenanceDiagnosis,
  AiInsight,
  MachineContext,
  NlpAlert,
  NlpFeedItem,
  Recommendation,
  RiskLevel,
} from '../models/nlp.models';

@Injectable({ providedIn: 'root' })
export class NlpService implements OnDestroy {
  private client: Client | null = null;
  private subscriptionAlerts: StompSubscription | null = null;
  private subscriptionInsights: StompSubscription | null = null;

  private feedSubject = new BehaviorSubject<NlpFeedItem[]>([]);
  public feed$: Observable<NlpFeedItem[]> = this.feedSubject.asObservable();

  // Equipment-photo analyses complete in the background (see analyzeImage()
  // below) and arrive here over the same WebSocket topics as text alerts —
  // routed to their own stream instead of feed$ since they don't share that
  // shape (no failureType/recommendation/rootCause) and the dashboard needs
  // to match a result back to a specific pending chat bubble by id.
  private imageAnalysisSubject = new Subject<Record<string, any>>();
  public imageAnalysisComplete$: Observable<Record<string, any>> = this.imageAnalysisSubject.asObservable();

  private recommendationsSubject = new BehaviorSubject<Recommendation[]>([]);
  public recommendations$ = this.recommendationsSubject.asObservable();

  private connectedSubject = new BehaviorSubject<boolean>(false);
  public connected$: Observable<boolean> = this.connectedSubject.asObservable();

  private readonly WS_ENDPOINT      = `${environment.wsUrl}/ws-nlp`;
  private readonly TOPIC_ALERTS     = '/topic/nlp-alerts';
  private readonly TOPIC_INSIGHTS   = '/topic/machine-insights';
  private readonly ANALYZE_ENDPOINT       = apiEndpoint('/nlp/analyze');
  private readonly ANALYZE_IMAGE_ENDPOINT = apiEndpoint('/nlp/analyze-image');

  constructor(private authService: AuthService, private http: HttpClient) {}

  private getAuthToken(): string | null {
    return (
      this.authService.getAccessToken() ??
      localStorage.getItem('access_token') ??
      localStorage.getItem('token')
    );
  }

  // ── WebSocket ──────────────────────────────────────────────────────────────
  connect(): void {
    if (this.client?.connected) return;

    const token = this.getAuthToken();
    if (!token) return;

    this.client = new Client({
      webSocketFactory: () => new SockJS(this.WS_ENDPOINT) as WebSocket,
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 5000,
      onConnect:        () => { this.connectedSubject.next(true); this.subscribeToTopics(); },
      onWebSocketClose: () => this.connectedSubject.next(false),
      onWebSocketError: () => this.connectedSubject.next(false),
    });

    this.client.activate();
  }

  private subscribeToTopics(): void {
    if (!this.client?.connected) return;

    this.subscriptionAlerts = this.client.subscribe(this.TOPIC_ALERTS, (message) => {
      try {
        const payload = JSON.parse(message.body) as Record<string, any> | Record<string, any>[];
        const items   = Array.isArray(payload) ? payload : [payload];
        const [imageItems, alertItems] = this.partitionImageAnalysisPayloads(items);
        imageItems.forEach((item) => this.imageAnalysisSubject.next(item));

        if (alertItems.length === 0) return;
        const feed = this.feedSubject.getValue();
        this.feedSubject.next([...alertItems.map((a) => ({ alert: a as NlpAlert } as NlpFeedItem)), ...feed].slice(0, 200));
      } catch (e) { console.error('Failed parsing NLP alert', e); }
    });

    this.subscriptionInsights = this.client.subscribe(this.TOPIC_INSIGHTS, (message) => {
      try {
        const payload = JSON.parse(message.body) as Record<string, any> | Record<string, any>[];
        const items   = Array.isArray(payload) ? payload : [payload];
        // Image-analysis completions already went out on TOPIC_ALERTS above —
        // just drop the duplicate here rather than emitting it twice.
        const [, insightItems] = this.partitionImageAnalysisPayloads(items);

        if (insightItems.length === 0) return;
        const feed = this.feedSubject.getValue();
        this.feedSubject.next([...insightItems.map((i) => ({ insight: i as AiInsight } as NlpFeedItem)), ...feed].slice(0, 200));
      } catch (e) { console.error('Failed parsing NLP insight', e); }
    });
  }

  /** Image-analysis payloads are the only ones carrying attachmentId — everything else is a regular text alert/insight. */
  private partitionImageAnalysisPayloads(
    items: Record<string, any>[],
  ): [Record<string, any>[], Record<string, any>[]] {
    const imageItems: Record<string, any>[] = [];
    const rest: Record<string, any>[] = [];
    for (const item of items) {
      (item && 'attachmentId' in item ? imageItems : rest).push(item);
    }
    return [imageItems, rest];
  }

  disconnect(): void {
    this.subscriptionAlerts?.unsubscribe();
    this.subscriptionInsights?.unsubscribe();
    this.subscriptionAlerts   = null;
    this.subscriptionInsights = null;
    this.client?.deactivate();
    this.client = null;
    this.connectedSubject.next(false);
  }

  // ── HTTP analysis ──────────────────────────────────────────────────────────
  analyzeReport(payload: AiDiagnosisRequest): Observable<AiMaintenanceDiagnosis> {
    // Build full request — include machine context so Python can answer
    // questions about the machine (temperature, health, alerts, etc.)
    const body: AiDiagnosisRequest = {
      machineId:      payload.machineId,
      text:           payload.text,
      source:         payload.source ?? 'technician_report',
      machineContext: payload.machineContext,  // ← pass through from caller
    };

    return this.http.post<Record<string, any>>(this.ANALYZE_ENDPOINT, body).pipe(
      map((response) => this.normalizeDiagnosis(response, payload.text)),
      catchError((error) => {
        console.error('Failed to analyze technician report', error);

        if (this.isUnavailableGateway(error)) {
          console.warn('NLP backend returned 502. Using local fallback diagnosis.');
          return of(this.createFallbackDiagnosis(payload));
        }

        return throwError(() => new Error('AI diagnosis is temporarily unavailable.'));
      }),
    );
  }

  diagnoseIssue(text: string, machineId: number): Observable<AiMaintenanceDiagnosis> {
    return this.analyzeReport({ machineId, text });
  }

  // ── HTTP image analysis (local vision model) ───────────────────────────────
  analyzeImage(payload: AiImageDiagnosisRequest): Observable<AiImageAnalysis> {
    const formData = new FormData();
    formData.append('image', payload.image);

    const params: Record<string, string> = { machineId: String(payload.machineId) };
    if (payload.context) params['context'] = payload.context;
    const query = new URLSearchParams(params).toString();

    return this.http.post<Record<string, any>>(`${this.ANALYZE_IMAGE_ENDPOINT}?${query}`, formData).pipe(
      map((response) => this.normalizeImageAnalysis(response)),
      catchError((error) => {
        console.error('Failed to analyze equipment photo', error);
        return throwError(() => new Error(
          error?.error?.message || error?.message || 'Photo analysis is temporarily unavailable.',
        ));
      }),
    );
  }

  private normalizeImageAnalysis(response: Record<string, any>): AiImageAnalysis {
    const status = (response['status'] as string | undefined)?.toUpperCase();
    return {
      id:           response['id'] as number | undefined,
      status:       status === 'COMPLETE' || status === 'FAILED' ? status : 'PENDING',
      description:  (response['description'] as string | undefined) ?? '',
      riskLevel:    this.normalizeSeverity(response['riskLevel']),
      keywords:     this.normalizeTextList(response['keywords']),
      message:      (response['message'] as string | undefined) || (response['description'] as string | undefined) || '',
      modelBackend: response['modelBackend'] as string | undefined,
      attachmentId: response['attachmentId'] as number | undefined,
      analyzedAt:   (response['createdAt'] as string | undefined) ?? new Date().toISOString(),
    };
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

  ngOnDestroy(): void { this.disconnect(); }

  // ── Response normalisation ─────────────────────────────────────────────────
  private normalizeDiagnosis(
    response: Record<string, any>,
    sourceText: string,
  ): AiMaintenanceDiagnosis {
    // Python returns: failureType, riskLevel, rootCause, recommendation, message, intent, isQuestion
    // We map these to the AiMaintenanceDiagnosis shape the component uses.
    const rootCause      = response['rootCause']      as string | undefined;
    const recommendation = response['recommendation'] as string | undefined;

    return {
      issueType:  this.normalizeIssueType(
        response['issueType'] ?? response['failureType'] ?? response['summary'],
      ),
      severity:   this.normalizeSeverity(
        response['severity'] ?? response['riskLevel'],
      ),
      confidence: this.normalizeConfidence(
        response['confidence'] ?? response['score'],
      ),

      // rootCause is a single string from Python — wrap in array for the UI list
      probableCauses: this.normalizeTextList(
        response['probableCauses'] ??
        response['rootCauses']     ??
        response['causes']         ??
        (rootCause ? [rootCause] : undefined),
      ),

      // recommendation is a single string from Python — wrap in array for the UI list
      recommendedActions: this.normalizeTextList(
        response['recommendedActions'] ??
        response['recommendations']    ??
        response['actions']            ??
        (recommendation ? [recommendation] : undefined),
      ),

      // Conversational fields — use Python's message directly as the chat reply
      message:    (response['message']    as string  | undefined) ?? '',
      intent:     (response['intent']     as string  | undefined) as any,
      isQuestion: (response['isQuestion'] as boolean | undefined) ?? false,

      machineName: response['machineName'] as string | undefined,
      machineId:   response['machineId']   as string | number | undefined,
      analyzedAt:  (response['analyzedAt'] as string | undefined) ?? new Date().toISOString(),
      sourceText,
    };
  }

  // ── helpers ────────────────────────────────────────────────────────────────
  private normalizeTextList(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value
        .map((item) => {
          if (typeof item === 'string') return item.trim();
          if (item && typeof item === 'object') {
            const candidate =
              (item as any).cause       ??
              (item as any).title       ??
              (item as any).description ??
              (item as any).name        ??
              (item as any).label;
            return typeof candidate === 'string' ? candidate.trim() : '';
          }
          return '';
        })
        .filter(Boolean);
    }

    if (typeof value === 'string' && value.trim()) return [value.trim()];
    return [];
  }

  private normalizeIssueType(value: unknown): string {
    if (typeof value !== 'string' || !value.trim()) return 'Unknown issue';
    return value
      .trim()
      .replace(/[_-]+/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  private normalizeSeverity(value: unknown): RiskLevel {
    const raw = typeof value === 'string' ? value.toUpperCase() : '';
    if (raw === 'LOW' || raw === 'MEDIUM' || raw === 'HIGH' || raw === 'CRITICAL') return raw;
    return 'LOW';
  }

  private normalizeConfidence(value: unknown): number {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
  }

  private isUnavailableGateway(error: unknown): boolean {
    const status =
      typeof error === 'object' && error !== null
        ? (error as { status?: unknown }).status
        : undefined;
    return status === 502;
  }

  private createFallbackDiagnosis(payload: AiDiagnosisRequest): AiMaintenanceDiagnosis {
    const { machineId, text: sourceText } = payload;
    const text = sourceText.toLowerCase();

    if (/(overheat|temperature|heat|cooling fan|fan)/.test(text)) {
      return {
        issueType: 'Thermal Anomaly Detected', severity: 'HIGH', confidence: 0.42,
        message: 'Overheating detected. Inspect cooling fans and verify airflow immediately.',
        probableCauses: ['Cooling airflow restriction', 'Fan degradation', 'Excessive load'],
        recommendedActions: ['Inspect cooling fans and heat sinks', 'Check temperature sensors', 'Reduce load until temperature normalises'],
        machineId, analyzedAt: new Date().toISOString(), sourceText,
      };
    }

    if (/(vibration|vibrating|noise|noisy|bearing)/.test(text)) {
      return {
        issueType: 'Mechanical Vibration Detected', severity: 'MEDIUM', confidence: 0.40,
        message: 'Abnormal vibration detected. Check bearings and mounting.',
        probableCauses: ['Loose mounting', 'Bearing wear', 'Imbalance or misalignment'],
        recommendedActions: ['Inspect mounting bolts and alignment', 'Check bearings for wear', 'Record vibration readings'],
        machineId, analyzedAt: new Date().toISOString(), sourceText,
      };
    }

    if (/(hydraulic|pressure|pump|leak)/.test(text)) {
      return {
        issueType: 'Hydraulic Pressure Instability', severity: 'HIGH', confidence: 0.39,
        message: 'Hydraulic issue detected. Inspect the circuit for leaks and pressure loss.',
        probableCauses: ['Pressure fluctuation', 'Fluid leak', 'Sensor drift'],
        recommendedActions: ['Inspect hydraulic circuit for leaks', 'Validate pump pressure', 'Check fluid level'],
        machineId, analyzedAt: new Date().toISOString(), sourceText,
      };
    }

    if (/(conveyor|slowdown|motor|belt|production line)/.test(text)) {
      return {
        issueType: 'Throughput Degradation Detected', severity: 'MEDIUM', confidence: 0.37,
        message: 'Production slowdown detected. Check motor load and belt tension.',
        probableCauses: ['Motor strain', 'Belt slippage', 'Downstream blockage'],
        recommendedActions: ['Check conveyor tension and motor load', 'Inspect for obstructions', 'Review recent maintenance events'],
        machineId, analyzedAt: new Date().toISOString(), sourceText,
      };
    }

    return {
      issueType: 'Manual Inspection Required', severity: 'LOW', confidence: 0.20,
      message: 'Not enough specific indicators to diagnose. Please describe the symptoms in more detail — include temperatures, sounds, error codes, or pressure readings.',
      probableCauses: ['Insufficient machine-specific indicators in the text'],
      recommendedActions: ['Provide more detail about the symptoms', 'Include sensor readings or error codes', 'Retry with a more specific description'],
      machineId, analyzedAt: new Date().toISOString(), sourceText,
    };
  }
}

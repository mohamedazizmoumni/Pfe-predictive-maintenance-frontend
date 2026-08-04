import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiEndpoint } from '../http/api-base';
import { AttachmentResponse } from '../models/sentinel.models';

/**
 * Repair-evidence photo attachments. Backed by the generic, polymorphic
 * /api/v1/attachments endpoint (entityType/entityId, not a per-record API) —
 * see AttachmentController on the backend.
 */
@Injectable({ providedIn: 'root' })
export class AttachmentService {
  private readonly baseUrl = apiEndpoint('/attachments');

  constructor(private http: HttpClient) {}

  upload(file: File, entityType: string, entityId: number): Observable<AttachmentResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<AttachmentResponse>(
      `${this.baseUrl}?entityType=${encodeURIComponent(entityType)}&entityId=${entityId}`,
      formData,
    );
  }

  list(entityType: string, entityId: number): Observable<AttachmentResponse[]> {
    return this.http.get<AttachmentResponse[]>(
      `${this.baseUrl}?entityType=${encodeURIComponent(entityType)}&entityId=${entityId}`,
    );
  }

  downloadUrl(id: number): string {
    return `${this.baseUrl}/${id}/download`;
  }
}

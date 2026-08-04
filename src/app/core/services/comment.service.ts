import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiEndpoint } from '../http/api-base';
import { CommentRequest, CommentResponse } from '../models/sentinel.models';

@Injectable({ providedIn: 'root' })
export class CommentService {
  private readonly baseUrl = apiEndpoint('/comments');

  constructor(private http: HttpClient) {}

  list(entityType: string, entityId: number): Observable<CommentResponse[]> {
    const params = new HttpParams().set('entityType', entityType).set('entityId', entityId);
    return this.http.get<CommentResponse[]>(this.baseUrl, { params });
  }

  add(request: CommentRequest): Observable<CommentResponse> {
    return this.http.post<CommentResponse>(this.baseUrl, request);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { apiEndpoint } from '../http/api-base';
import { ChatbotRequest, ChatbotResponse } from '../models/sentinel.models';

@Injectable({
  providedIn: 'root',
})
export class ChatbotService {
  constructor(private http: HttpClient) {}

  ask(body: ChatbotRequest): Observable<ChatbotResponse> {
    return this.http
      .post<ChatbotResponse>(apiEndpoint('/v1/chatbot/ask'), body)
      .pipe(
        catchError((error) => {
          const message = error?.error?.error || 'Chatbot service is unavailable. Please try again later.';
          return throwError(() => new Error(message));
        })
      );
  }
}

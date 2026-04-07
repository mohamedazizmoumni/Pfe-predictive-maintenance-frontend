import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ChatbotService } from './chatbot.service';
import { ChatbotRequest, ChatbotResponse } from '../models/sentinel.models';
import { apiEndpoint } from '../http/api-base';

describe('ChatbotService', () => {
  let service: ChatbotService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ChatbotService],
    });

    service = TestBed.inject(ChatbotService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should send POST /v1/chatbot/ask with body', () => {
    const payload: ChatbotRequest = { question: 'Hello world' };
    const mockResponse: ChatbotResponse = {
      answer: 'Hi there',
      authorized: true,
      userRoles: ['ADMIN'],
    };

    let received: ChatbotResponse | undefined;

    service.ask(payload).subscribe((res) => (received = res));

    const req = httpMock.expectOne(apiEndpoint('/v1/chatbot/ask'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);

    req.flush(mockResponse);

    expect(received).toEqual(mockResponse);
  });

  it('should map backend error into Error instance', () => {
    const payload: ChatbotRequest = { question: 'Hello' };

    let errorMessage: string | undefined;

    service.ask(payload).subscribe({
      next: () => undefined,
      error: (err: Error) => {
        errorMessage = err.message;
      },
    });

    const req = httpMock.expectOne(apiEndpoint('/v1/chatbot/ask'));
    expect(req.request.method).toBe('POST');

    req.flush({ error: 'Backend failure' }, { status: 503, statusText: 'Service Unavailable' });

    expect(errorMessage).toBe('Backend failure');
  });
});

import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiEndpoint } from '../http/api-base';

export type InquiryType = 'CONTACT' | 'DEMO_REQUEST';
export type InquiryStatus = 'NEW' | 'REVIEWED' | 'CLOSED';

export interface ContactInquiry {
  id: number;
  inquiryType: InquiryType;
  fullName: string;
  email: string;
  company?: string;
  phone?: string;
  subject?: string;
  message: string;
  status: InquiryStatus;
  reviewedBy?: string;
  reviewedDate?: string;
  createdDate: string;
}

export interface InquiryPage {
  content: ContactInquiry[];
  totalElements: number;
  totalPages: number;
  number: number;
}

@Injectable({ providedIn: 'root' })
export class InquiryService {
  constructor(private http: HttpClient) {}

  list(status?: InquiryStatus | 'all', page = 0, size = 20): Observable<InquiryPage> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (status && status !== 'all') {
      params = params.set('status', status);
    }
    return this.http.get<InquiryPage>(apiEndpoint('/inquiries'), { params });
  }

  unreadCount(): Observable<{ count: number }> {
    return this.http.get<{ count: number }>(apiEndpoint('/inquiries/unread-count'));
  }

  updateStatus(id: number, status: InquiryStatus): Observable<ContactInquiry> {
    return this.http.patch<ContactInquiry>(apiEndpoint(`/inquiries/${id}/status`), { status });
  }
}

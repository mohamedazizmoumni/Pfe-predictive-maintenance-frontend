import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { apiEndpoint } from '../http/api-base';

/**
 * Server-side PDF reports (Priority 5). Uses a real authenticated blob
 * request (not a plain `<a href>`, which wouldn't carry the JWT the backend
 * requires) then triggers a normal browser download from the response.
 */
@Injectable({ providedIn: 'root' })
export class ReportService {
  constructor(private http: HttpClient) {}

  downloadMaintenanceInterventionReport(rapportId: number): void {
    this.http
      .get(apiEndpoint(`/reports/maintenance-rapports/${rapportId}`), { responseType: 'blob' })
      .subscribe((blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `maintenance-report-${rapportId}.pdf`;
        link.click();
        window.URL.revokeObjectURL(url);
      });
  }
}

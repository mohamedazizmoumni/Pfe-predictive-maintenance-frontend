import { Injectable } from '@angular/core';
import { Observable, map, catchError, of } from 'rxjs';
import { PreferenceService } from './preference.service';

/**
 * Persists which dashboard widgets a user has hidden, per dashboard, via the
 * generic /api/v1/preferences store — key "dashboardLayout:<dashboardKey>",
 * value a JSON array of hidden widget ids.
 */
@Injectable({ providedIn: 'root' })
export class DashboardPreferencesService {
  constructor(private preferenceService: PreferenceService) {}

  private key(dashboardKey: string): string {
    return `dashboardLayout:${dashboardKey}`;
  }

  getHiddenWidgets(dashboardKey: string): Observable<Set<string>> {
    return this.preferenceService.get(this.key(dashboardKey)).pipe(
      map((raw) => {
        if (!raw) return new Set<string>();
        try {
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? new Set<string>(parsed) : new Set<string>();
        } catch {
          return new Set<string>();
        }
      }),
      catchError(() => of(new Set<string>())),
    );
  }

  setHiddenWidgets(dashboardKey: string, hidden: Set<string>): Observable<void> {
    return this.preferenceService.set(this.key(dashboardKey), JSON.stringify(Array.from(hidden)));
  }
}

import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

export const errorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 404) {
        console.warn('Not found:', req.url);
      } else if (error.status === 500) {
        console.error('Server error status:', error.status);
      } else if (error.status === 0) {
        console.error('Network error');
      }

      return throwError(() => error);
    })
  );

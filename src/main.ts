import './polyfills';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { environment } from './environments/environment';

// The app has ~200 console.log/debug/info call sites used for local
// debugging (session storage, WebSocket lifecycle, ML request tracing,
// etc.) that were never meant to reach a real deployment. Rather than
// touching every call site individually, silence the noisy methods here
// once optimization/production builds are active — console.error and
// console.warn stay untouched since those carry real diagnostic value.
if (environment.production) {
  /* eslint-disable no-console */
  console.log = () => {};
  console.debug = () => {};
  console.info = () => {};
  /* eslint-enable no-console */
}

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));

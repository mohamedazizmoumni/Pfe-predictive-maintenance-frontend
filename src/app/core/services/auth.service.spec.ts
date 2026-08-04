import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { apiEndpoint } from '../http/api-base';
import { LoginResponse } from '../models/sentinel.models';

/** Builds a syntactically-valid (unsigned) JWT so AuthService's atob()-based decoding works. */
function makeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.signature`;
}

function futureExp(secondsFromNow = 3600): number {
  return Math.floor(Date.now() / 1000) + secondsFromNow;
}

function pastExp(secondsAgo = 3600): number {
  return Math.floor(Date.now() / 1000) - secondsAgo;
}

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AuthService],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('starts unauthenticated with no stored session', () => {
    expect(service.isAuthenticated()).toBeFalse();
    expect(service.getCurrentUser()).toBeNull();
    expect(service.getAccessToken()).toBeNull();
  });

  it('persists tokens and decodes the user from the access token on login', () => {
    const token = makeJwt({ sub: 'jane.tech', username: 'jane.tech', email: 'jane@sentinel.io', exp: futureExp(), roles: ['TECHNICIAN'] });
    const response: LoginResponse = { token, refreshToken: 'refresh-abc' };

    let emitted: LoginResponse | undefined;
    service.login({ username: 'jane.tech', password: 'secret' }).subscribe((r) => (emitted = r));

    const req = httpMock.expectOne(apiEndpoint('/auth/login'));
    expect(req.request.method).toBe('POST');
    req.flush(response);

    expect(emitted).toEqual(response);
    expect(service.getAccessToken()).toBe(token);
    expect(service.getRefreshToken()).toBe('refresh-abc');
    expect(service.isAuthenticated()).toBeTrue();
    expect(service.getCurrentUser()?.username).toBe('jane.tech');
    expect(service.getCurrentUser()?.roles.map((r) => r.name)).toContain('TECHNICIAN');
  });

  it('uses the backend-provided numeric id, not the JWT subject (which is the username)', () => {
    // Regression test: JwtTokenProvider.generateAccessToken sets the JWT
    // `sub` claim to the *username*, and the backend's LoginResponse puts
    // id/username/email as flat top-level fields (no nested `user`). If
    // the frontend ever falls back to reading `sub` as the id, or looks
    // for a `response.user` object that doesn't exist on this endpoint,
    // `getCurrentUser()?.id` silently becomes the username string instead
    // of the real numeric id — which then 500s any backend call that
    // expects a numeric id (e.g. GET /maintenance?assignedTechnicianId=).
    const token = makeJwt({ sub: 'technicien1', email: 'tech1@sentinel.io', exp: futureExp(), roles: ['TECHNICIAN'] });
    const response: LoginResponse = { token, refreshToken: 'refresh-abc', id: 42, username: 'technicien1' } as LoginResponse;

    service.login({ username: 'technicien1', password: 'secret' }).subscribe();

    const req = httpMock.expectOne(apiEndpoint('/auth/login'));
    req.flush(response);

    expect(service.getCurrentUser()?.id).toBe('42');
    expect(service.getCurrentUser()?.username).toBe('technicien1');
  });

  it('propagates login errors without persisting a session', () => {
    let caught: unknown;
    service.login({ username: 'jane.tech', password: 'wrong' }).subscribe({
      error: (err) => (caught = err),
    });

    const req = httpMock.expectOne(apiEndpoint('/auth/login'));
    req.flush({ message: 'Bad credentials' }, { status: 401, statusText: 'Unauthorized' });

    expect(caught).toBeTruthy();
    expect(service.isAuthenticated()).toBeFalse();
    expect(service.getAccessToken()).toBeNull();
  });

  it('treats a token past its exp claim as not authenticated', () => {
    const expiredToken = makeJwt({ sub: 'jane.tech', exp: pastExp() });
    localStorage.setItem('access_token', expiredToken);

    // hasToken() re-checks expiry live, independent of restoreSession() timing
    expect(service.hasToken()).toBeFalse();
  });

  it('treats a token with a future exp claim as authenticated', () => {
    const validToken = makeJwt({ sub: 'jane.tech', exp: futureExp() });
    localStorage.setItem('access_token', validToken);

    expect(service.hasToken()).toBeTrue();
  });

  it('refreshToken() short-circuits with no HTTP call when no refresh token is stored', () => {
    let caught: unknown;
    service.refreshToken().subscribe({ error: (err) => (caught = err) });

    httpMock.expectNone(apiEndpoint('/auth/refresh'));
    expect(caught).toBeTruthy();
  });

  it('logout() clears the local session even when the backend call fails', () => {
    const token = makeJwt({ sub: 'jane.tech', exp: futureExp() });
    localStorage.setItem('access_token', token);
    localStorage.setItem('refresh_token', 'refresh-abc');
    service.updateCurrentUser({ id: '1', username: 'jane.tech', email: 'jane@sentinel.io', roles: [] });

    service.logout().subscribe({ error: () => {} });

    const req = httpMock.expectOne(apiEndpoint('/auth/logout'));
    req.flush('boom', { status: 500, statusText: 'Server Error' });

    expect(service.getAccessToken()).toBeNull();
    expect(service.getCurrentUser()).toBeNull();
    expect(service.isAuthenticated()).toBeFalse();
  });

  it('updateCurrentUser() preserves existing roles when the incoming user has none', () => {
    service.updateCurrentUser({
      id: '1',
      username: 'jane.tech',
      email: 'jane@sentinel.io',
      roles: [{ id: 'TECHNICIAN', name: 'TECHNICIAN' }],
    });

    service.updateCurrentUser({
      id: '1',
      username: 'jane.tech',
      email: 'jane@sentinel.io',
      displayName: 'Jane (updated)',
      roles: [],
    });

    const current = service.getCurrentUser();
    expect(current?.displayName).toBe('Jane (updated)');
    expect(current?.roles.map((r) => r.name)).toEqual(['TECHNICIAN']);
  });

  it('updateCurrentUser(null) clears the session', () => {
    service.updateCurrentUser({ id: '1', username: 'jane.tech', email: 'jane@sentinel.io', roles: [] });
    service.updateCurrentUser(null);

    expect(service.getCurrentUser()).toBeNull();
  });
});

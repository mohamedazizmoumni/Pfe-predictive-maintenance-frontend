import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { User, Role } from '../models/sentinel.models';
import { apiEndpoint } from '../http/api-base';
import { normalizeRoleName } from '../utils/role.utils';

export interface UsersResponse {
  content: User[];
  totalElements: number;
  totalPages: number;
  currentPage: number;
}

export interface CreateUserPayload {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  department?: string;
  phoneNumber?: string;
  roleName?: string;
  roles?: string[];
}

export interface UpdateUserPayload {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  department?: string;
  phoneNumber?: string;
  status?: string;
  roles?: string[];
}

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private usersSubject = new BehaviorSubject<User[]>([]);
  private rolesSubject = new BehaviorSubject<Role[]>([]);
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  private errorSubject = new BehaviorSubject<string | null>(null);

  users$ = this.usersSubject.asObservable();
  roles$ = this.rolesSubject.asObservable();
  isLoading$ = this.isLoadingSubject.asObservable();
  error$ = this.errorSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Load all users
   */
  loadUsers(page: number = 0, size: number = 10): void {
    this.isLoadingSubject.next(true);
    this.errorSubject.next(null);

    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    this.http
      .get<User[] | UsersResponse>(apiEndpoint('/v1/users'), { params })
      .pipe(
        tap((response) => {
          const users = this.extractUsers(response).map((user) => this.mapUser(user));
          this.usersSubject.next(users);
          this.isLoadingSubject.next(false);
        }),
        catchError((error) => {
          const errorMessage = error.error?.error || error.error?.message || 'Failed to load users';
          this.errorSubject.next(errorMessage);
          this.isLoadingSubject.next(false);
          return of(null);
        })
      )
      .subscribe();
  }

  /**
   * Get a specific user
   */
  getUser(userId: string | number): Observable<User> {
    return this.http
      .get<User>(apiEndpoint(`/v1/users/${userId}`))
      .pipe(
        tap((user) => {
          const mapped = this.mapUser(user);
          const users = this.usersSubject.value;
          const existing = users.findIndex((u) => String(u.id) === String(mapped.id));
          if (existing >= 0) {
            const updated = [...users];
            updated[existing] = mapped;
            this.usersSubject.next(updated);
          }
        }),
        catchError((error) => {
          const errorMessage = error.error?.error || error.error?.message || 'Failed to load user';
          this.errorSubject.next(errorMessage);
          throw error;
        })
      );
  }

  /**
   * Create a new user
   */
  createUser(userData: CreateUserPayload): Observable<User> {
    this.isLoadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http
      .post<User>(apiEndpoint('/v1/users'), userData)
      .pipe(
        tap((user) => {
          const mappedUser = this.mapUser(user);
          const users = this.usersSubject.value;
          this.usersSubject.next([...users, mappedUser]);
          this.isLoadingSubject.next(false);
        }),
        catchError((error) => {
          const errorMessage = error.error?.error || error.error?.message || 'Failed to create user';
          this.errorSubject.next(errorMessage);
          this.isLoadingSubject.next(false);
          throw error;
        })
      );
  }

  /**
   * Update a user
   */
  updateUser(userId: string | number, updates: UpdateUserPayload): Observable<User> {
    this.isLoadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http
      .put<User>(apiEndpoint(`/v1/users/${userId}`), updates)
      .pipe(
        tap((user) => {
          const mappedUser = this.mapUser(user);
          const users = this.usersSubject.value.map((u) =>
            String(u.id) === String(userId) ? mappedUser : u
          );
          this.usersSubject.next(users);
          this.isLoadingSubject.next(false);
        }),
        catchError((error) => {
          const errorMessage = error.error?.error || error.error?.message || 'Failed to update user';
          this.errorSubject.next(errorMessage);
          this.isLoadingSubject.next(false);
          throw error;
        })
      );
  }

  /**
   * Delete a user
   */
  deleteUser(userId: string | number): Observable<void> {
    this.isLoadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http
      .delete<void>(apiEndpoint(`/v1/users/${userId}`))
      .pipe(
        tap(() => {
          const users = this.usersSubject.value.filter((u) => String(u.id) !== String(userId));
          this.usersSubject.next(users);
          this.isLoadingSubject.next(false);
        }),
        catchError((error) => {
          const errorMessage = error.error?.error || error.error?.message || 'Failed to delete user';
          this.errorSubject.next(errorMessage);
          this.isLoadingSubject.next(false);
          throw error;
        })
      );
  }

  /**
   * Load all available roles
   */
  loadRoles(): void {
    this.isLoadingSubject.next(true);
    this.errorSubject.next(null);

    this.http
      .get<Role[]>(apiEndpoint('/v1/roles'))
      .pipe(
        tap((roles) => {
          const mappedRoles = (roles || []).map((role) => this.mapRole(role));
          this.rolesSubject.next(mappedRoles);
          this.isLoadingSubject.next(false);
        }),
        catchError((error) => {
          const errorMessage = error.error?.error || error.error?.message || 'Failed to load roles';
          this.errorSubject.next(errorMessage);
          this.isLoadingSubject.next(false);
          return of(null);
        })
      )
      .subscribe();
  }

  /**
   * Assign a role to a user
   */
  assignRole(userId: string, roleId: string): Observable<User> {
    return this.http
      .post<User>(apiEndpoint(`/v1/users/${userId}/roles`), { roleId })
      .pipe(
        tap((user) => {
          const users = this.usersSubject.value.map((u) =>
            u.id === userId ? user : u
          );
          this.usersSubject.next(users);
        }),
        catchError((error) => {
          const errorMessage = error.error?.error || error.error?.message || 'Failed to assign role';
          this.errorSubject.next(errorMessage);
          throw error;
        })
      );
  }

  private extractUsers(response: User[] | UsersResponse): User[] {
    if (Array.isArray(response)) {
      return response;
    }
    return response?.content || [];
  }

  private mapUser(user: User): User {
    return {
      ...user,
      roles: Array.isArray(user.roles)
        ? user.roles.map((role: any) => this.mapRole(role))
        : [],
    };
  }

  private mapRole(role: any): Role {
    if (typeof role === 'string') {
      const normalizedName = normalizeRoleName(role);
      return {
        id: normalizedName || role,
        name: normalizedName || role,
      } as Role;
    }

    const normalizedName = normalizeRoleName(role?.name || role?.id || '');

    return {
      id: role?.id ?? normalizedName,
      name: normalizedName || role?.name || role?.id || 'UNKNOWN_ROLE',
      description: role?.description,
    } as Role;
  }
}

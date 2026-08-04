import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import type * as XLSXType from 'xlsx';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { CreateUserPayload, UpdateUserPayload, UserService } from '../../core/services/user.service';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { User, Role } from '../../core/models/sentinel.models';
import { normalizeRoleName, rolesCollectionHasAny } from '../../core/utils/role.utils';
let XLSX: typeof XLSXType;

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.scss']
})
export class UserManagementComponent implements OnInit {
  users: User[] = [];
  filteredUsers: User[] = [];
  roles: Role[] = [];
  isLoading = false;
  error: string | null = null;
  importSummary: string | null = null;
  importHasErrors = false;
  isImporting = false;
  showCreateForm = false;
  selectedUser: User | null = null;
  // Edit form only — reveals a password field so an admin can reset
  // another user's password. There is no self-service reset flow.
  resettingPassword = false;
  formModel: CreateUserPayload = {
    username: '',
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    department: '',
    phoneNumber: '',
    roleName: '',
  };

  // Table UX state
  searchTerm = '';
  filterStatus: 'all' | 'ACTIVE' | 'INACTIVE' = 'all';
  filterRole: 'all' | string = 'all';

  sortField: 'username' | 'email' | 'department' | 'status' | 'lastLoginDate' = 'username';
  sortDirection: 'asc' | 'desc' = 'asc';

  // Client-side pagination over loaded users
  page = 0;
  size = 10;

  get pageStartIndex(): number {
    if (!this.filteredUsers.length) {
      return 0;
    }
    return this.page * this.size + 1;
  }

  get pageEndIndex(): number {
    if (!this.filteredUsers.length) {
      return 0;
    }
    const end = (this.page + 1) * this.size;
    return end > this.filteredUsers.length ? this.filteredUsers.length : end;
  }

  // Simple statistics
  totalUsers = 0;
  activeUsers = 0;
  inactiveUsers = 0;
  inventoryFacingUsers = 0; // users whose primary role relates to inventory/operations
  inventoryFacingUsersStaleLogin = 0; // inventory-related users without recent login

  blockingUserId: string | null = null;
  resettingFaceUserId: string | null = null;

  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
    private readonly confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    this.loadUsers();
    this.loadRoles();
  }

  /** Managers get a narrower view of this page: only TECHNICIAN accounts,
   *  never other managers/admins/stock managers. Admins/super-admins keep
   *  the full, unrestricted screen. */
  get isTechnicianScoped(): boolean {
    const roles = this.authService.getCurrentUser()?.roles;
    const isAdminLike = rolesCollectionHasAny(roles, ['SUPER_ADMIN', 'ADMIN']);
    const isManager = rolesCollectionHasAny(roles, ['MANAGER']);
    return isManager && !isAdminLike;
  }

  get availableRoleOptions(): Role[] {
    if (!this.isTechnicianScoped) {
      return this.roles;
    }
    return this.roles.filter((role) => normalizeRoleName(role.name) === 'TECHNICIAN');
  }

  get scopedUsers(): User[] {
    if (!this.isTechnicianScoped) {
      return this.users;
    }
    return this.users.filter((user) =>
      (user.roles || []).some((role) => normalizeRoleName(role.name) === 'TECHNICIAN')
    );
  }

  loadUsers(): void {
    this.isLoading = true;
    this.error = null;

    this.userService.loadUsers(0, 200);

    this.userService.users$.subscribe({
      next: (users) => {
        this.users = users || [];
        this.computeStats();
        this.applyFiltersAndSort();
        this.isLoading = false;
      },
      error: () => {
        this.error = 'Failed to load users';
        this.isLoading = false;
      }
    });
  }

  loadRoles(): void {
    this.userService.loadRoles();
    this.userService.roles$.subscribe({
      next: (roles) => {
        this.roles = roles;
      },
    });
  }

  getUserRoles(user: User): string {
    if (!user.roles || user.roles.length === 0) {
      return '';
    }
    return user.roles.map((role) => role.name).join(', ');
  }

  getRoleChipClass(roleName: string): string {
    const normalized = normalizeRoleName(roleName);
    return normalized ? `role-chip--${normalized.toLowerCase().replace(/_/g, '-')}` : 'role-chip--default';
  }

  getAvatarClass(user: User): string {
    const primary = user.roles && user.roles.length ? user.roles[0].name : '';
    return this.getRoleChipClass(primary).replace('role-chip--', 'avatar--');
  }

  getInitials(user: User): string {
    const first = (user.firstName || user.username || '?').charAt(0);
    const last = (user.lastName || '').charAt(0);
    return `${first}${last}`.toUpperCase();
  }

  getLastLoginLabel(user: User): string {
    if (!user.lastLoginDate) {
      return 'Never';
    }

    const lastLogin = new Date(user.lastLoginDate);
    const diffMs = Date.now() - lastLogin.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hr${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return lastLogin.toLocaleDateString();
  }

  // ===== Block / unblock =====

  canBlockUsers(): boolean {
    // Matches the backend's @PreAuthorize on PUT /v1/users/{id} status changes.
    return rolesCollectionHasAny(
      this.authService.getCurrentUser()?.roles,
      ['SUPER_ADMIN', 'ADMIN']
    );
  }

  isUserLocked(user: User): boolean {
    return !!user.locked || user.status === 'LOCKED';
  }

  isBlockingUser(user: User): boolean {
    return this.blockingUserId === String(user.id);
  }

  async toggleBlockUser(user: User): Promise<void> {
    if (!this.canBlockUsers() || this.blockingUserId) {
      return;
    }

    const locked = this.isUserLocked(user);
    const action = locked ? 'unblock' : 'block';
    const nextStatus = locked ? 'ACTIVE' : 'LOCKED';

    const confirmed = locked
      ? await this.confirmDialog.confirm({ title: 'Unblock user', message: `Unblock ${user.username}? They will regain access immediately.`, confirmLabel: 'Unblock' })
      : await this.confirmDialog.confirmDanger('Block user', `Block ${user.username}? They will be signed out and unable to log in.`, 'Block');
    if (!confirmed) {
      return;
    }

    this.blockingUserId = String(user.id);
    this.error = null;

    this.userService.updateUser(user.username, { status: nextStatus }).subscribe({
      next: () => {
        this.blockingUserId = null;
        this.userService.loadUsers(0, 200);
      },
      error: (err) => {
        this.blockingUserId = null;
        this.error = err?.error?.message ?? err?.error?.error ?? `Failed to ${action} user`;
      },
    });
  }

  // ===== Face enrollment reset =====

  canResetFaceEnrollment(): boolean {
    // Matches the backend's @PreAuthorize on DELETE /v1/users/{id}/face-enrollment.
    return rolesCollectionHasAny(
      this.authService.getCurrentUser()?.roles,
      ['SUPER_ADMIN', 'ADMIN']
    );
  }

  isResettingFace(user: User): boolean {
    return this.resettingFaceUserId === String(user.id);
  }

  async resetFaceEnrollment(user: User): Promise<void> {
    if (!this.canResetFaceEnrollment() || this.resettingFaceUserId) {
      return;
    }
    const confirmed = await this.confirmDialog.confirmDanger(
      'Reset face enrollment',
      `Reset face enrollment for ${user.username}? They will need to capture a new face before they can use face login again.`,
      'Reset'
    );
    if (!confirmed) {
      return;
    }

    this.resettingFaceUserId = String(user.id);
    this.error = null;

    this.userService.resetFaceEnrollment(user.id).subscribe({
      next: () => {
        this.resettingFaceUserId = null;
        this.userService.loadUsers(0, 200);
      },
      error: (err) => {
        this.resettingFaceUserId = null;
        this.error = err?.error?.error ?? err?.error?.message ?? 'Failed to reset face enrollment';
      },
    });
  }

  // ===== Filters & sorting =====

  onSearchChange(): void {
    this.page = 0;
    this.applyFiltersAndSort();
  }

  onFilterChange(): void {
    this.page = 0;
    this.applyFiltersAndSort();
  }

  onSort(field: typeof this.sortField): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }
    this.applyFiltersAndSort();
  }

  isSorted(field: typeof this.sortField, direction: 'asc' | 'desc'): boolean {
    return this.sortField === field && this.sortDirection === direction;
  }

  nextPage(): void {
    const total = this.filteredUsers.length;
    if ((this.page + 1) * this.size >= total) {
      return;
    }
    this.page++;
  }

  prevPage(): void {
    if (this.page === 0) {
      return;
    }
    this.page--;
  }

  get pagedUsers(): User[] {
    const start = this.page * this.size;
    const end = start + this.size;
    return this.filteredUsers.slice(start, end);
  }

  private applyFiltersAndSort(): void {
    const term = this.searchTerm.trim().toLowerCase();

    let result = this.scopedUsers.filter((user) => {
      const matchesSearch = term
        ? [
            user.username,
            user.email,
            user.firstName,
            user.lastName,
            user.department,
            this.getUserRoles(user)
          ]
            .filter(Boolean)
            .some((value) => (value as string).toLowerCase().includes(term))
        : true;

      const status = user.status || 'ACTIVE';
      const matchesStatus = this.filterStatus === 'all' ? true : status === this.filterStatus;

      const primaryRole = user.roles && user.roles.length ? user.roles[0].name : '';
      const matchesRole = this.filterRole === 'all' ? true : primaryRole === this.filterRole;

      return matchesSearch && matchesStatus && matchesRole;
    });

    result = result.sort((a, b) => {
      const direction = this.sortDirection === 'asc' ? 1 : -1;

      const getValue = (user: User): string | number => {
        switch (this.sortField) {
          case 'email':
            return user.email || '';
          case 'department':
            return user.department || '';
          case 'status':
            return user.status || '';
          case 'lastLoginDate':
            return user.lastLoginDate ? new Date(user.lastLoginDate).getTime() : 0;
          default:
            return user.username || '';
        }
      };

      const va = getValue(a);
      const vb = getValue(b);

      if (typeof va === 'number' && typeof vb === 'number') {
        return (va - vb) * direction;
      }
      return String(va).localeCompare(String(vb)) * direction;
    });

    this.filteredUsers = result;
  }

  onCreateUser(): void {
    this.selectedUser = null;
    this.formModel = {
      username: '',
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      department: '',
      phoneNumber: '',
      roleName: this.isTechnicianScoped ? 'TECHNICIAN' : '',
    };
    this.showCreateForm = true;
  }

  onEditUser(user: User): void {
    this.selectedUser = user;
    this.resettingPassword = false;
    this.formModel = {
      username: user.username,
      email: user.email,
      password: '',
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      department: user.department || '',
      phoneNumber: user.phoneNumber || '',
      roleName: user.roles && user.roles.length ? user.roles[0].name : '',
    };
    this.showCreateForm = true;
  }

  toggleResetPassword(): void {
    this.resettingPassword = !this.resettingPassword;
    this.formModel.password = '';
  }

   onCancelForm(): void {
    this.showCreateForm = false;
    this.selectedUser = null;
    this.resettingPassword = false;
  }

  onSubmitForm(): void {
    if (this.selectedUser) {
      // For updates, backend expects UpdateUserRequest: firstName, lastName, email,
      // plus optional department, phoneNumber, status, roles.
      if (!this.formModel.firstName || !this.formModel.lastName || !this.formModel.email) {
        this.error = 'First name, last name and email are required.';
        return;
      }

      if (this.resettingPassword && (!this.formModel.password || this.formModel.password.length < 8)) {
        this.error = 'New password must be at least 8 characters.';
        return;
      }

      const updatePayload: UpdateUserPayload = {
        username: this.formModel.username,
        firstName: this.formModel.firstName,
        lastName: this.formModel.lastName,
        email: this.formModel.email,
        password: this.resettingPassword ? this.formModel.password : undefined,
        department: this.formModel.department || undefined,
        phoneNumber: this.formModel.phoneNumber || undefined,
        status: this.selectedUser?.status,
        roles: this.formModel.roleName ? [this.formModel.roleName] : undefined,
      };

      this.isLoading = true;
      this.error = null;

      this.userService.updateUser(String(this.selectedUser.id), updatePayload).subscribe({
        next: () => {
          this.isLoading = false;
          this.showCreateForm = false;
          this.selectedUser = null;
          this.resettingPassword = false;
          this.userService.loadUsers(0, 200);
        },
        error: () => {
          this.error = 'Failed to update user';
          this.isLoading = false;
        },
      });
    } else {
      // For creation, ensure mandatory fields are present.
      if (!this.formModel.username || !this.formModel.email || !this.formModel.password || !this.formModel.firstName || !this.formModel.lastName) {
        this.error = 'Please fill in all required fields.';
        return;
      }

      this.isLoading = true;
      this.error = null;

      const createPayload: CreateUserPayload = {
        username: this.formModel.username,
        email: this.formModel.email,
        password: this.formModel.password,
        firstName: this.formModel.firstName,
        lastName: this.formModel.lastName,
        department: this.formModel.department || undefined,
        phoneNumber: this.formModel.phoneNumber || undefined,
        roles: this.formModel.roleName ? [this.formModel.roleName] : undefined,
      };

      this.userService.createUser(createPayload).subscribe({
        next: () => {
          this.isLoading = false;
          this.showCreateForm = false;
          this.userService.loadUsers(0, 200);
        },
        error: () => {
          this.error = 'Failed to create user';
          this.isLoading = false;
        },
      });
    }
  }

  async onDeleteUser(user: User): Promise<void> {
    const confirmed = await this.confirmDialog.confirmDanger(
      'Delete user',
      `Delete ${user.username}? This permanently removes their account and cannot be undone.`
    );
    if (!confirmed) {
      return;
    }
    this.isLoading = true;
    this.userService.deleteUser(String(user.id)).subscribe({
      next: () => {
        this.isLoading = false;
        this.userService.loadUsers(0, 200);
      },
      error: () => {
        this.error = 'Failed to delete user';
        this.isLoading = false;
      }
    });
  }

  async onExportExcel(): Promise<void> {
    const source = this.filteredUsers.length ? this.filteredUsers : this.users;
    if (!source.length) {
      return;
    }
    if (!XLSX) {
      XLSX = await import('xlsx');
    }
    const data = source.map((u) => ({
      ID: u.id,
      Username: u.username,
      Email: u.email,
      Roles: this.getUserRoles(u),
      Status: u.status ?? '',
      Department: u.department ?? '',
      'Last Login': u.lastLoginDate ?? ''
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Users');
    XLSX.writeFile(workbook, 'users.xlsx');
  }

  async onExcelImport(event: Event): Promise<void> {
    if (!XLSX) {
      XLSX = await import('xlsx');
    }
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = (e: any) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);
      this.importUsers(rows);
      // Reset so re-selecting the same file fires another change event.
      input.value = '';
    };
    reader.readAsArrayBuffer(file);
  }

  /**
   * Creates one user per row via the same admin-only POST /users endpoint
   * the "New User" form uses (createUser is an upsert keyed on
   * username/email, and auto-generates a password when one isn't sent —
   * matching what the Export XLSX button produces, since exported rows
   * never include a password column).
   */
  private importUsers(rows: Record<string, unknown>[]): void {
    this.importSummary = null;
    this.importHasErrors = false;

    const validRows: { payload: CreateUserPayload; rowLabel: string }[] = [];
    let skipped = 0;

    for (const row of rows) {
      const username = this.readCell(row, ['Username', 'username']);
      const email = this.readCell(row, ['Email', 'email']);
      if (!username || !email) {
        skipped++;
        continue;
      }

      const rolesCell = this.readCell(row, ['Roles', 'roles']);
      const roles = rolesCell
        ? rolesCell.split(',').map((r) => r.trim()).filter(Boolean)
        : undefined;

      validRows.push({
        payload: {
          username,
          email,
          password: '',
          firstName: this.readCell(row, ['First Name', 'firstName']) || '',
          lastName: this.readCell(row, ['Last Name', 'lastName']) || '',
          department: this.readCell(row, ['Department', 'department']) || undefined,
          roles,
        },
        rowLabel: username,
      });
    }

    if (validRows.length === 0) {
      this.importHasErrors = true;
      this.importSummary = skipped > 0
        ? `No rows imported — ${skipped} row(s) were missing a Username or Email column.`
        : 'The selected file had no rows to import.';
      return;
    }

    this.isImporting = true;
    forkJoin(
      validRows.map(({ payload, rowLabel }) =>
        this.userService.createUser(payload).pipe(
          map(() => ({ rowLabel, ok: true as const })),
          catchError(() => of({ rowLabel, ok: false as const }))
        )
      )
    ).subscribe((results) => {
      this.isImporting = false;
      const succeeded = results.filter((r) => r.ok).length;
      const failed = results.filter((r) => !r.ok);

      this.importHasErrors = failed.length > 0 || skipped > 0;
      const parts = [`Imported ${succeeded} of ${validRows.length} user(s).`];
      if (failed.length > 0) {
        parts.push(`Failed: ${failed.map((f) => f.rowLabel).join(', ')}.`);
      }
      if (skipped > 0) {
        parts.push(`Skipped ${skipped} row(s) missing Username/Email.`);
      }
      this.importSummary = parts.join(' ');

      if (succeeded > 0) {
        this.userService.loadUsers(0, 200);
      }
    });
  }

  private readCell(row: Record<string, unknown>, keys: string[]): string {
    for (const key of keys) {
      const value = row[key];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return String(value).trim();
      }
    }
    return '';
  }

   // ===== Simple aggregate statistics =====

  private computeStats(): void {
    this.totalUsers = this.scopedUsers.length;
    this.activeUsers = this.scopedUsers.filter((u) => (u.status || 'ACTIVE') === 'ACTIVE').length;
    this.inactiveUsers = this.totalUsers - this.activeUsers;

    // Users whose first role suggests a link to inventory/operations
    const inventoryKeywords = ['INVENTORY', 'STOCK', 'SUPPLY', 'WAREHOUSE', 'OPERATIONS'];
    const now = new Date();
    const daysThreshold = 30;

    this.inventoryFacingUsers = this.users.filter((u) => {
      if (!u.roles || !u.roles.length) {
        return false;
      }
      const name = (u.roles[0].name || '').toUpperCase();
      return inventoryKeywords.some((k) => name.includes(k));
    }).length;

    this.inventoryFacingUsersStaleLogin = this.users.filter((u) => {
      if (!u.roles || !u.roles.length) {
        return false;
      }
      const name = (u.roles[0].name || '').toUpperCase();
      const isInventory = inventoryKeywords.some((k) => name.includes(k));
      if (!isInventory) {
        return false;
      }
      if (!u.lastLoginDate) {
        return true;
      }
      const lastLogin = new Date(u.lastLoginDate);
      const diffDays = (now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays >= daysThreshold;
    }).length;
  }
}

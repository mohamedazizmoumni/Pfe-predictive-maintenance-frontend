import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type * as XLSXType from 'xlsx';
import { CreateUserPayload, UpdateUserPayload, UserService } from '../../core/services/user.service';
import { User, Role } from '../../core/models/sentinel.models';
let XLSX: typeof XLSXType;

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.scss']
})
export class UserManagementComponent implements OnInit {
  users: User[] = [];
  filteredUsers: User[] = [];
  roles: Role[] = [];
  isLoading = false;
  error: string | null = null;
  showCreateForm = false;
  selectedUser: User | null = null;
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

  constructor(private readonly userService: UserService) {}

  ngOnInit(): void {
    this.loadUsers();
    this.loadRoles();
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

    let result = this.users.filter((user) => {
      const matchesSearch = !term
        ? true
        : [
            user.username,
            user.email,
            user.firstName,
            user.lastName,
            user.department,
            this.getUserRoles(user)
          ]
            .filter(Boolean)
            .some((value) => (value as string).toLowerCase().includes(term));

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
      roleName: '',
    };
    this.showCreateForm = true;
  }

  onEditUser(user: User): void {
    this.selectedUser = user;
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

   onCancelForm(): void {
    this.showCreateForm = false;
    this.selectedUser = null;
  }

  onSubmitForm(): void {
    if (this.selectedUser) {
      // For updates, backend expects UpdateUserRequest: firstName, lastName, email,
      // plus optional department, phoneNumber, status, roles.
      if (!this.formModel.firstName || !this.formModel.lastName || !this.formModel.email) {
        this.error = 'First name, last name and email are required.';
        return;
      }

      const updatePayload: UpdateUserPayload = {
        username: this.formModel.username,
        firstName: this.formModel.firstName,
        lastName: this.formModel.lastName,
        email: this.formModel.email,
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
      this.userService.createUser(this.formModel).subscribe({
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

  onDeleteUser(user: User): void {
    if (!confirm(`Delete user ${user.username}?`)) {
      return;
    }
    this.isLoading = true;
    this.userService.deleteUser(user.id).subscribe({
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
      const users = XLSX.utils.sheet_to_json(worksheet);
      // TODO: Process imported users (send to backend or update UI)
      console.log('Imported users:', users);
    };
    reader.readAsArrayBuffer(file);
  }

   // ===== Simple aggregate statistics =====

  private computeStats(): void {
    this.totalUsers = this.users.length;
    this.activeUsers = this.users.filter((u) => (u.status || 'ACTIVE') === 'ACTIVE').length;
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

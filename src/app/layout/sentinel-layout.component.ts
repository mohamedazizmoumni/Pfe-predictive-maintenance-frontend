import {
  Component,
  Inject,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
  HostListener
} from '@angular/core';

import { CommonModule, DOCUMENT } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';

import {
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
  Router,
  NavigationEnd
} from '@angular/router';

import { AuthService } from '../core/services/auth.service';
import { NotificationsRestService } from '../core/services/notifications-rest.service';
import { FinanceService } from '../core/services/finance.service';
import { RapportService } from '../core/services/rapport.service';
import { apiEndpoint } from '../core/http/api-base';
import { DashboardRoutingService } from '../pages/dashboards/dashboard-routing.service';
import { ThemeService } from '../core/services';

import { User } from '../core/models/sentinel.models';

import {
  normalizeRoleName,
  userHasRequiredRole,
  getPrimaryRole,
  rolesCollectionHasAny
} from '../core/utils/role.utils';

import { ChatbotComponent } from '../pages/chatbot/chatbot.component';
import { NotificationBellComponent } from '../shared/notification-bell/notification-bell.component';

interface MenuItem {
  label: string;
  path: string;
  icon: string;
  caption?: string;
  requiredRoles?: string[];
  pending?: number;
}

type SidebarRoleKey =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'FINANCE_MANAGER'
  | 'MANAGER'
  | 'TECHNICIAN'
  | 'STOCK_MANAGER'
  | 'DATA_SCIENTIST'
  | 'VIEWER'
  | 'CUSTOMER'
  | 'GUEST';

@Component({
  selector: 'app-sentinel-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    LucideAngularModule,
    ChatbotComponent,
    NotificationBellComponent
  ],
  templateUrl: './sentinel-layout.component.html',
  styleUrl: './sentinel-layout.component.scss',
})
export class SentinelLayoutComponent implements OnInit, OnDestroy {

  currentUser: User | null = null;
  private sidebarUser: User | null = null;

  sidebarOpen = true;
  private userExplicitlyClosed = false;
  profileMenuOpen = false;

  get theme(): 'light' | 'dark' {
    return this.themeService.theme();
  }

  chatOpen = false;

  chatLeft = 0;
  chatTop = 0;
  chatWidth = 440;
  chatHeight = 560;

  chatMaximized = false;

  private isDraggingChat = false;
  private isResizingChat = false;

  private dragOffsetX = 0;
  private dragOffsetY = 0;

  private resizeStartX = 0;
  private resizeStartY = 0;

  private resizeStartWidth = 0;
  private resizeStartHeight = 0;

  canCreateTasks = false;

  private cachedRoles: any[] = [];

  private avatarUrlCache: string | null = null;
  private lastAvatarUsername: string | null = null;

  get pendingExpenseCount$() {
    return this.financeService.pendingCount$;
  }

  get pendingRapportCount$() {
    return this.rapportService.pendingCount$;
  }

  readonly menuItems: MenuItem[] = [
    {
      label: 'Dashboard',
      path: '/dashboards/admin',
      icon: 'LayoutDashboard',
      caption: 'Overview & KPIs',
      requiredRoles: []
    },
    {
      label: 'Profile',
      path: '/profile',
      icon: 'UserCircle',
      caption: 'My profile & settings',
      requiredRoles: []
    },
    {
      label: 'Equipment',
      path: '/equipment',
      icon: 'Cog',
      caption: 'Machines & assets',
      requiredRoles: ['SUPER_ADMIN','ADMIN','MANAGER','TECHNICIAN','VIEWER']
    },
    {
      label: 'Maintenance',
      path: '/maintenance',
      icon: 'Wrench',
      caption: 'Maintenance tasks',
      requiredRoles: ['SUPER_ADMIN','ADMIN','MANAGER','TECHNICIAN']
    },
    {
      label: 'Technician Calendar',
      path: '/technician-calendar',
      icon: 'CalendarClock',
      caption: 'Schedule & events',
      requiredRoles: ['TECHNICIAN']
    },
    {
      label: 'Alerts',
      path: '/alerts',
      icon: 'TriangleAlert',
      caption: 'Active alerts',
      requiredRoles: ['SUPER_ADMIN','ADMIN','MANAGER','TECHNICIAN','DATA_SCIENTIST']
    },
    {
      label: 'Predictive Dashboard',
      path: '/predictive-dashboard',
      icon: 'Radar',
      caption: 'Live readings, sensor data & failure reports',
      requiredRoles: ['SUPER_ADMIN','ADMIN','MANAGER','TECHNICIAN','DATA_SCIENTIST']
    },
    {
      label: 'Inventory',
      path: '/inventory',
      icon: 'Package',
      caption: 'Parts & stock',
      requiredRoles: ['SUPER_ADMIN','ADMIN','STOCK_MANAGER','MANAGER']
    },
    {
      label: 'Parts',
      path: '/inventory/parts',
      icon: 'PackageSearch',
      caption: 'Browse and manage parts',
      requiredRoles: ['SUPER_ADMIN','ADMIN','STOCK_MANAGER','MANAGER']
    },
    {
      label: 'Reorder Requests',
      path: '/inventory/reorders',
      icon: 'Inbox',
      caption: 'Approve replenishment requests',
      requiredRoles: ['SUPER_ADMIN','ADMIN','STOCK_MANAGER','MANAGER']
    },
    {
      label: 'Stock Orders',
      path: '/inventory/stock-orders',
      icon: 'Truck',
      caption: 'Track purchase orders',
      requiredRoles: ['SUPER_ADMIN','ADMIN','STOCK_MANAGER','MANAGER']
    },
    {
      label: 'Analytics',
      path: '/inventory/analytics',
      icon: 'BarChart3',
      caption: 'Inventory KPIs and stock health',
      requiredRoles: ['SUPER_ADMIN','ADMIN','STOCK_MANAGER','MANAGER']
    },
    {
      label: 'Suppliers',
      path: '/inventory/suppliers',
      icon: 'Building2',
      caption: 'Supplier directory & delivery scorecards',
      requiredRoles: ['SUPER_ADMIN','ADMIN','STOCK_MANAGER','MANAGER']
    },
    {
      label: 'Demand Forecast',
      path: '/inventory/demand-forecast',
      icon: 'TrendingDown',
      caption: 'Projected stockouts from real consumption',
      requiredRoles: ['SUPER_ADMIN','ADMIN','STOCK_MANAGER','MANAGER']
    },
    {
      label: 'Stock Notifications',
      path: '/stock-notifications',
      icon: 'Bell',
      caption: 'Stock alerts & updates',
      requiredRoles: ['SUPER_ADMIN','ADMIN','STOCK_MANAGER']
    },
    {
      label: 'User Management',
      path: '/user-management',
      icon: 'Users',
      caption: 'Users & roles',
      requiredRoles: ['SUPER_ADMIN','ADMIN','MANAGER']
    },
    {
      label: 'Inquiries',
      path: '/inquiries',
      icon: 'Inbox',
      caption: 'Contact & demo requests',
      requiredRoles: ['SUPER_ADMIN','ADMIN']
    },
    {
      label: 'AI Intelligence',
      path: '/ai-assistant',
      icon: 'Brain',
      caption: 'Assistant diagnosis and risk overview',
      requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TECHNICIAN', 'DATA_SCIENTIST']
    },
    {
      label: 'Expenses',
      path: '/finance/expenses',
      icon: 'Wallet',
      caption: 'Submit & track expenses',
      requiredRoles: []
    },
    {
      label: 'Finance Dashboard',
      path: '/finance/dashboard',
      icon: 'LineChart',
      caption: 'Budget & spending overview',
      requiredRoles: ['FINANCE_MANAGER', 'ADMIN', 'SUPER_ADMIN']
    },
    {
      label: 'Budget Management',
      path: '/finance/budget',
      icon: 'Landmark',
      caption: 'Annual budget control',
      requiredRoles: ['FINANCE_MANAGER', 'ADMIN', 'SUPER_ADMIN']
    },
    {
      label: 'Rapport Approvals',
      path: '/finance/rapports',
      icon: 'ClipboardCheck',
      caption: 'Approve technician job rapports',
      requiredRoles: ['FINANCE_MANAGER', 'MANAGER', 'ADMIN', 'SUPER_ADMIN']
    },
    {
      label: 'Maintenance Cost Analytics',
      path: '/finance/maintenance-costs',
      icon: 'PieChart',
      caption: 'Cost breakdown, failures & recommendations',
      requiredRoles: ['FINANCE_MANAGER', 'MANAGER', 'ADMIN', 'SUPER_ADMIN']
    },
    {
      label: 'Team Capacity',
      path: '/team-capacity',
      icon: 'CalendarDays',
      caption: 'Technician workload & upcoming schedule',
      requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER']
    },
    {
      label: 'Reliability',
      path: '/reliability',
      icon: 'Activity',
      caption: 'MTBF/MTTR and root-cause tracking',
      requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER']
    },
    {
      label: 'Work Order Templates',
      path: '/work-order-templates',
      icon: 'ClipboardList',
      caption: 'Reusable work order defaults and recurring maintenance rules',
      requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER']
    },
    {
      label: 'Part Reservations',
      path: '/inventory/reservations',
      icon: 'Lock',
      caption: 'Hold stock against a job before it is consumed',
      requiredRoles: ['TECHNICIAN', 'MANAGER', 'STOCK_MANAGER', 'ADMIN', 'SUPER_ADMIN']
    },
    {
      label: 'Export Center',
      path: '/export-center',
      icon: 'Download',
      caption: 'Download CSV snapshots of your data',
      requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TECHNICIAN', 'STOCK_MANAGER', 'FINANCE_MANAGER']
    },
    {
      label: 'Audit Console',
      path: '/audit-console',
      icon: 'History',
      caption: 'Governance log — role changes, approvals, automation',
      requiredRoles: ['SUPER_ADMIN', 'ADMIN']
    },
    {
      label: 'My Machines',
      path: '/portal',
      icon: 'Factory',
      caption: 'Your equipment, health & maintenance history',
      requiredRoles: ['CUSTOMER']
    },
    {
      label: 'Support Tickets',
      path: '/portal/tickets',
      icon: 'Ticket',
      caption: 'Get help with your equipment',
      requiredRoles: ['CUSTOMER']
    },
    {
      label: 'Billing',
      path: '/portal/billing',
      icon: 'Receipt',
      caption: 'Invoices for servicing and parts',
      requiredRoles: ['CUSTOMER']
    },
  ];

  private readonly sidebarMenuByRole: Record<SidebarRoleKey, string[]> = {
    SUPER_ADMIN: ['Dashboard', 'Profile', 'Equipment', 'Maintenance', 'Technician Calendar', 'Alerts', 'Inventory', 'Parts', 'Reorder Requests', 'Stock Orders', 'Analytics', 'Suppliers', 'Demand Forecast', 'Stock Notifications', 'User Management', 'Inquiries', 'Expenses', 'Finance Dashboard', 'Budget Management', 'Rapport Approvals', 'Maintenance Cost Analytics', 'Team Capacity', 'Reliability', 'Work Order Templates', 'Audit Console', 'Part Reservations', 'Export Center'],
    ADMIN: ['Dashboard', 'Profile', 'Equipment', 'Maintenance', 'Technician Calendar', 'Alerts', 'Inventory', 'Parts', 'Reorder Requests', 'Stock Orders', 'Analytics', 'Suppliers', 'Demand Forecast', 'Stock Notifications', 'User Management', 'Inquiries', 'Expenses', 'Finance Dashboard', 'Budget Management', 'Rapport Approvals', 'Maintenance Cost Analytics', 'Team Capacity', 'Reliability', 'Work Order Templates', 'Audit Console', 'Part Reservations', 'Export Center'],
    FINANCE_MANAGER: ['Dashboard', 'Profile', 'Expenses', 'Finance Dashboard', 'Budget Management', 'Reorder Requests', 'Rapport Approvals', 'Maintenance Cost Analytics', 'Export Center'],
    MANAGER: ['Dashboard', 'Profile', 'Equipment', 'Maintenance', 'Alerts', 'Analytics', 'User Management', 'Rapport Approvals', 'Team Capacity', 'Reliability', 'Work Order Templates', 'Suppliers', 'Demand Forecast', 'Part Reservations', 'Export Center'],
    TECHNICIAN: ['Dashboard', 'Profile', 'Equipment', 'Maintenance', 'Technician Calendar', 'Alerts', 'AI Intelligence', 'Part Reservations', 'Export Center'],
    STOCK_MANAGER: ['Dashboard', 'Profile', 'Inventory', 'Parts', 'Reorder Requests', 'Stock Orders', 'Analytics', 'Suppliers', 'Demand Forecast', 'Stock Notifications', 'Expenses', 'Part Reservations', 'Export Center'],
    DATA_SCIENTIST: ['Dashboard', 'Profile', 'Alerts', 'AI Intelligence', 'Expenses'],
    VIEWER: ['Dashboard', 'Profile', 'Equipment', 'Alerts', 'Expenses'],
    CUSTOMER: ['My Machines', 'Support Tickets', 'Billing', 'Profile'],
    GUEST: ['Dashboard', 'Profile'],
  };

  constructor(
    private authService: AuthService,
    private router: Router,
    private notificationsService: NotificationsRestService,
    private financeService: FinanceService,
    private rapportService: RapportService,
    private dashboardRoutingService: DashboardRoutingService,
    private themeService: ThemeService,
    private cdr: ChangeDetectorRef,
    @Inject(DOCUMENT) private document: Document
  ) {}

  ngOnInit(): void {

    const storedSidebar = (typeof window !== 'undefined' && window.localStorage)
      ? window.localStorage.getItem('sentinel-sidebar')
      : null;

    const isDesktop = typeof window !== 'undefined' ? window.innerWidth > 960 : true;

    if (isDesktop) {
      this.sidebarOpen = storedSidebar !== 'closed';
      this.userExplicitlyClosed = false;
    } else {
      this.sidebarOpen = storedSidebar !== 'closed';
      this.userExplicitlyClosed = storedSidebar === 'closed';
    }

    if (!this.sidebarOpen) {
      this.sidebarOpen = true;
      this.userExplicitlyClosed = false;
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem('sentinel-sidebar');
      }
    }

    this.router.events.subscribe((ev) => {
      if (ev instanceof NavigationEnd) {
        try {
          if (!this.userExplicitlyClosed && window.innerWidth > 960 && !this.sidebarOpen) {
            this.sidebarOpen = true;
            this.cdr.detectChanges();
          }
        } catch (e) {}
      }
    });

    this.authService.currentUser$.subscribe((user: User | null) => {

      if (!user) {
        if (this.authService.hasToken()) {
          return;
        }
        this.currentUser = null;
        this.sidebarUser = null;
        this.canCreateTasks = false;
        this.cachedRoles = [];
        this.avatarUrlCache = null;
        this.lastAvatarUsername = null;
        this.notificationsService.stopPolling();
        return;
      }

      const incomingRoles = Array.isArray(user.roles) ? user.roles : [];
      const isSameUser = this.currentUser?.username === user.username;

      if (incomingRoles.length > 0) {
        this.cachedRoles = incomingRoles;
      }

      const preservedRoles = incomingRoles.length > 0
        ? incomingRoles
        : isSameUser
          ? (this.currentUser?.roles ?? this.cachedRoles)
          : [];

      const preservedAvatarUrl = user.profilePictureUrl
        ?? (isSameUser ? this.currentUser?.profilePictureUrl : null)
        ?? null;

      this.sidebarUser = {
        ...this.currentUser,
        ...user,
        roles: preservedRoles,
        profilePictureUrl: preservedAvatarUrl ?? undefined,
      };

      this.currentUser = this.sidebarUser;

      if (this.sidebarUser?.username) {
        this.lastAvatarUsername = this.sidebarUser.username;
        this.avatarUrlCache = this.sidebarUser.profilePictureUrl
          ?? apiEndpoint(`/v1/users/${this.sidebarUser.username}/profile-picture`);
      }

      this.canCreateTasks = userHasRequiredRole(
        this.currentUser,
        ['SUPER_ADMIN', 'ADMIN', 'MANAGER']
      );

      this.setupNotifications(this.currentUser);

      if (this.isFinanceRole) {
        this.financeService.refreshPendingCount();
      }

      if (this.canReviewRapports) {
        this.rapportService.refreshPendingCount(this.canReviewManagerRapports, this.canReviewFinanceRapports);
      }

      this.cdr.detectChanges();
    });

    this.themeService.initializeTheme();
  }

  private setupNotifications(user: User | null): void {
    const normalizedRoles =
      (user?.roles ?? []).map((role) => normalizeRoleName(role.name));

    const preferredRole =
      normalizedRoles.includes('SUPER_ADMIN')
        ? 'SUPER_ADMIN'
        : normalizedRoles[0] ?? null;

    this.notificationsService.setRole(preferredRole);
    this.notificationsService.loadNotifications(preferredRole ?? undefined).subscribe();
    this.notificationsService.loadUnreadCount().subscribe();
    this.notificationsService.startPolling(30000);
  }

  ngOnDestroy(): void {
    this.notificationsService.stopPolling();
  }

  getPrimaryRoleLabel(): string {
    return getPrimaryRole(this.sidebarUser ?? this.currentUser);
  }

  get isFinanceRole(): boolean {
    const roles = this.getNormalizedRoles(this.sidebarUser ?? this.currentUser);
    return roles.includes('FINANCE_MANAGER') || roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');
  }

  get canReviewManagerRapports(): boolean {
    const roles = this.getNormalizedRoles(this.sidebarUser ?? this.currentUser);
    return roles.includes('MANAGER') || roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');
  }

  get canReviewFinanceRapports(): boolean {
    const roles = this.getNormalizedRoles(this.sidebarUser ?? this.currentUser);
    return roles.includes('FINANCE_MANAGER') || roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');
  }

  get canReviewRapports(): boolean {
    return this.canReviewManagerRapports || this.canReviewFinanceRapports;
  }

  getDashboardPath(): string {
    return this.dashboardRoutingService.getDashboardRouteForCurrentUser(this.currentUser);
  }

  getDashboardCaption(): string {
    return `${this.dashboardRoutingService.getDashboardRoleLabel(this.currentUser)} dashboard`;
  }

  getHeaderDateLabel(): string {
    return new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  getHeaderTimeLabel(): string {
    return new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  get visibleMenuItems(): MenuItem[] {
    const roleKey = this.getSidebarRoleKey();
    const allowedLabels = this.sidebarMenuByRole[roleKey] ?? this.sidebarMenuByRole.GUEST;
    return this.menuItems.filter((item) => allowedLabels.includes(item.label));
  }

  private getSidebarRoleKey(): SidebarRoleKey {
    const normalizedRoles = this.getNormalizedRoles(this.sidebarUser ?? this.currentUser);

    if (normalizedRoles.includes('SUPER_ADMIN')) {
      return 'SUPER_ADMIN';
    }
    if (normalizedRoles.includes('ADMIN')) {
      return 'ADMIN';
    }
    if (normalizedRoles.includes('FINANCE_MANAGER')) {
      return 'FINANCE_MANAGER';
    }
    if (normalizedRoles.includes('MANAGER')) {
      return 'MANAGER';
    }
    if (normalizedRoles.includes('TECHNICIAN')) {
      return 'TECHNICIAN';
    }
    if (normalizedRoles.includes('STOCK_MANAGER')) {
      return 'STOCK_MANAGER';
    }
    if (normalizedRoles.includes('DATA_SCIENTIST')) {
      return 'DATA_SCIENTIST';
    }
    if (normalizedRoles.includes('VIEWER')) {
      return 'VIEWER';
    }
    if (normalizedRoles.includes('CUSTOMER')) {
      return 'CUSTOMER';
    }

    return 'GUEST';
  }

  private getNormalizedRoles(user: User | null): string[] {
    const roles = user?.roles ?? this.cachedRoles ?? [];

    return roles
      .map((role: any) => {
        if (typeof role === 'string') {
          return normalizeRoleName(role);
        }

        return normalizeRoleName(role?.name);
      })
      .filter((role) => !!role);
  }

  isMenuItemVisible(item: MenuItem): boolean {
    return this.visibleMenuItems.some((visibleItem) => visibleItem.label === item.label);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.profileMenuOpen = false;
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.profileMenuOpen = false;
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
    this.userExplicitlyClosed = !this.sidebarOpen;
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('sentinel-sidebar', this.sidebarOpen ? 'open' : 'closed');
    }
    this.profileMenuOpen = false;
  }

  toggleProfileMenu(event?: MouseEvent): void {
    event?.stopPropagation();

    if (!this.currentUser) {
      this.router.navigate(['/auth/login']);
      return;
    }

    this.profileMenuOpen = !this.profileMenuOpen;
  }

  goToProfile(event?: MouseEvent): void {
    event?.stopPropagation();
    this.profileMenuOpen = false;
    this.router.navigate(['/profile']);
  }

  goToDashboard(event?: MouseEvent): void {
    event?.stopPropagation();
    this.profileMenuOpen = false;
    this.router.navigate([this.getDashboardPath()]);
  }

  goToSettings(event?: MouseEvent): void {
    event?.stopPropagation();
    this.profileMenuOpen = false;
    this.router.navigate(['/profile']);
  }

  openSupport(event?: MouseEvent): void {
    event?.stopPropagation();
    this.profileMenuOpen = false;
    this.router.navigate(['/profile']);
  }

  openDocumentation(event?: MouseEvent): void {
    event?.stopPropagation();
    this.profileMenuOpen = false;
    this.router.navigate(['/profile']);
  }

  openCommunity(event?: MouseEvent): void {
    event?.stopPropagation();
    this.profileMenuOpen = false;
    this.router.navigate(['/profile']);
  }

  toggleAppearance(event?: MouseEvent): void {
    event?.stopPropagation();
    this.toggleTheme();
    this.profileMenuOpen = false;
  }

  toggleChat(): void {
    this.chatOpen = !this.chatOpen;

    if (this.chatOpen) {
      this.chatMaximized = false;

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      this.chatWidth = 440;
      this.chatHeight = Math.min(600, viewportHeight * 0.9);
      this.chatLeft = viewportWidth - this.chatWidth - 32;
      this.chatTop = viewportHeight - this.chatHeight - 32;
    }
  }

  toggleChatMaximize(): void {
    if (!this.chatOpen) {
      this.toggleChat();
      return;
    }

    this.chatMaximized = !this.chatMaximized;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (this.chatMaximized) {
      this.chatLeft = 16;
      this.chatTop = 16;
      this.chatWidth = viewportWidth - 32;
      this.chatHeight = viewportHeight - 32;
    } else {
      this.chatWidth = 440;
      this.chatHeight = Math.min(600, viewportHeight * 0.9);
      this.chatLeft = viewportWidth - this.chatWidth - 32;
      this.chatTop = viewportHeight - this.chatHeight - 32;
    }
  }

  onChatDragStart(event: MouseEvent): void {
    event.preventDefault();
    this.isDraggingChat = true;
    this.dragOffsetX = event.clientX - this.chatLeft;
    this.dragOffsetY = event.clientY - this.chatTop;
    window.addEventListener('mousemove', this.handleChatMouseMove);
    window.addEventListener('mouseup', this.handleChatMouseUp);
  }

  onChatResizeStart(event: MouseEvent): void {
    event.preventDefault();
    this.isResizingChat = true;
    this.resizeStartX = event.clientX;
    this.resizeStartY = event.clientY;
    this.resizeStartWidth = this.chatWidth;
    this.resizeStartHeight = this.chatHeight;
    window.addEventListener('mousemove', this.handleChatMouseMove);
    window.addEventListener('mouseup', this.handleChatMouseUp);
  }

  private handleChatMouseMove = (event: MouseEvent): void => {
    if (this.isDraggingChat) {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const nextLeft = event.clientX - this.dragOffsetX;
      const nextTop = event.clientY - this.dragOffsetY;
      const maxLeft = viewportWidth - this.chatWidth - 8;
      const maxTop = viewportHeight - 48;
      this.chatLeft = Math.min(Math.max(8, nextLeft), maxLeft);
      this.chatTop = Math.min(Math.max(8, nextTop), maxTop);
    } else if (this.isResizingChat) {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const deltaX = event.clientX - this.resizeStartX;
      const deltaY = event.clientY - this.resizeStartY;
      const minWidth = 320;
      const minHeight = 320;
      this.chatWidth = Math.min(
        Math.max(minWidth, this.resizeStartWidth + deltaX),
        viewportWidth - this.chatLeft - 8
      );
      this.chatHeight = Math.min(
        Math.max(minHeight, this.resizeStartHeight + deltaY),
        viewportHeight - this.chatTop - 8
      );
    }
  };

  private handleChatMouseUp = (): void => {
    this.isDraggingChat = false;
    this.isResizingChat = false;
    window.removeEventListener('mousemove', this.handleChatMouseMove);
    window.removeEventListener('mouseup', this.handleChatMouseUp);
  };

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  logout(): void {
    this.profileMenuOpen = false;

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem('sentinel-sidebar');
    }

    this.authService.logout().subscribe(() => {
      this.router.navigate(['/auth/login']);
    });
  }

  getUserDisplayName(): string {
    const user = this.sidebarUser ?? this.currentUser;
    if (!user) return '';
    return user.displayName || user.username;
  }

  getUserRoles(): string {
    const user = this.sidebarUser ?? this.currentUser;
    if (!user?.roles) return '';
    return this.getNormalizedRoles(user).join(', ');
  }

  getUserInitial(): string {
    const display = this.getUserDisplayName();
    return display ? display.charAt(0).toUpperCase() : '?';
  }

  getUserAvatarUrl(): string | null {
    const user = this.sidebarUser ?? this.currentUser;

    if (!user?.username) {
      return user?.profilePictureUrl ?? null;
    }

    if (this.lastAvatarUsername === user.username) {
      return this.avatarUrlCache;
    }

    this.lastAvatarUsername = user.username;
    this.avatarUrlCache = user.profilePictureUrl
      ?? this.avatarUrlCache
      ?? null;

    if (!this.avatarUrlCache) {
      this.avatarUrlCache = apiEndpoint(`/v1/users/${user.username}/profile-picture`);
    }

    return this.avatarUrlCache;
  }
}
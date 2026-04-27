import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet, Router } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { User } from '../core/models/sentinel.models';
import { userHasRequiredRole } from '../core/utils/role.utils';
import { ChatbotComponent } from '../pages/chatbot/chatbot.component';

interface MenuItem {
  label: string;
  path: string;
  icon: string;
  caption?: string;
  requiredRoles?: string[];
}

@Component({
  selector: 'app-sentinel-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet, ChatbotComponent],
  templateUrl: './sentinel-layout.component.html',
  styleUrl: './sentinel-layout.component.scss',
})
export class SentinelLayoutComponent implements OnInit {
  currentUser: User | null = null;
  sidebarOpen = true;
  theme: 'light' | 'dark' = 'light';
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
  menuItems: MenuItem[] = [
    {
      label: 'Dashboard',
      path: '/',
      icon: '📊',
      caption: 'Maintenance KPIs',
      requiredRoles: [], // All authenticated users
    },
    {
      label: 'Recommendations',
      path: '/recommendations',
      icon: '🧭',
      caption: 'Action planning by urgency',
      requiredRoles: [],
    },
    {
      label: 'Budget',
      path: '/budgets',
      icon: '💰',
      caption: 'Spend tracking and alerts',
      requiredRoles: [],
    },
    {
      label: 'Equipment',
      path: '/equipment',
      icon: '⚙️',
      caption: 'Asset registry',
      requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TECHNICIAN', 'VIEWER'],
    },
    {
      label: 'Maintenance',
      path: '/maintenance',
      icon: '🔧',
      caption: 'Tickets & workflows',
      requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TECHNICIAN'],
    },
    {
      label: 'Predictive Dashboard',
      path: '/predictive-dashboard',
      icon: '🔮',
      caption: 'Risk & failure intelligence',
      requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TECHNICIAN', 'VIEWER', 'DATA_SCIENTIST'],
    },
    {
      label: 'Alerts',
      path: '/alerts',
      icon: '🚨',
      caption: 'Incident queue',
      requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'DATA_SCIENTIST'],
    },
    {
      label: 'Inventory',
      path: '/inventory',
      icon: '📦',
      caption: 'Spare parts & reorders',
      requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'STOCK_MANAGER', 'MANAGER'],
    },
    {
      label: 'User Management',
      path: '/user-management',
      icon: '👤',
      caption: 'Manage users',
      requiredRoles: ['SUPER_ADMIN'],
    },
    {
      label: 'Users',
      path: '/users',
      icon: '👥',
      caption: 'Access control',
      requiredRoles: ['SUPER_ADMIN', 'ADMIN'],
    },
    {
      label: 'Settings',
      path: '/settings',
      icon: '⚙️',
      caption: 'Platform config',
      requiredRoles: ['SUPER_ADMIN', 'ADMIN'],
    },
  ];

  constructor(
    private authService: AuthService,
    private router: Router,
    @Inject(DOCUMENT) private document: Document
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe((user: User | null) => {
      this.currentUser = user;
    });

		this.initializeTheme();
  }

  /**
   * Check if menu item should be visible based on user roles
   * If requiredRoles is empty, show to all authenticated users
   * If requiredRoles has values, check if user has any of those roles
   */
  isMenuItemVisible(item: MenuItem): boolean {
    // If no required roles specified, show to all authenticated users
    if (!item.requiredRoles || item.requiredRoles.length === 0) {
      return true;
    }

    // Check if user has any of the required roles
    return userHasRequiredRole(this.currentUser, item.requiredRoles);
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  toggleChat(): void {
    this.chatOpen = !this.chatOpen;
    if (this.chatOpen) {
      this.chatMaximized = false;
      // default bottom-right placement
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
      this.chatWidth = Math.min(Math.max(minWidth, this.resizeStartWidth + deltaX), viewportWidth - this.chatLeft - 8);
      this.chatHeight = Math.min(Math.max(minHeight, this.resizeStartHeight + deltaY), viewportHeight - this.chatTop - 8);
    }
  };

  private handleChatMouseUp = (): void => {
    this.isDraggingChat = false;
    this.isResizingChat = false;
    window.removeEventListener('mousemove', this.handleChatMouseMove);
    window.removeEventListener('mouseup', this.handleChatMouseUp);
  };

  toggleTheme(): void {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
    this.applyTheme(this.theme);
  }

  private initializeTheme(): void {
    const stored = (typeof window !== 'undefined' && window.localStorage)
      ? window.localStorage.getItem('sentinel-theme')
      : null;

    if (stored === 'light' || stored === 'dark') {
      this.theme = stored;
    } else if (typeof window !== 'undefined' && window.matchMedia) {
      this.theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    this.applyTheme(this.theme);
  }

  private applyTheme(theme: 'light' | 'dark'): void {
    this.document.documentElement.setAttribute('data-theme', theme);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('sentinel-theme', theme);
    }
  }

  logout(): void {
    this.authService.logout().subscribe(() => {
      this.router.navigate(['/auth/login']);
    });
  }

  getUserDisplayName(): string {
    if (!this.currentUser) {
      return '';
    }
    return this.currentUser.displayName || this.currentUser.username;
  }

  getUserRoles(): string {
    if (!this.currentUser || !this.currentUser.roles) {
      return '';
    }
    return this.currentUser.roles.map((r: any) => r.name).join(', ');
  }

  getUserInitial(): string {
    const display = this.getUserDisplayName();
    return display ? display.charAt(0).toUpperCase() : '?';
  }
}
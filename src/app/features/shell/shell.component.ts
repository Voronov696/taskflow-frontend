import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../core/auth/auth.service';
import { User } from '../../domain/models/user.model';
import { filter } from 'rxjs';
import { NotificationBellComponent } from './notification-bell/notification-bell.component';
import { NotificationService } from '../../core/notification/notification.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslatePipe, NotificationBellComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss'
})
export class ShellComponent implements OnInit {
  currentUser: User | null = null;
  activeRoute = '';
  showUserMenu = false;

  navItems = [
    { labelKey: 'nav.dashboard', icon: 'ti-dashboard', route: 'dashboard' },
    { labelKey: 'nav.projects',  icon: 'ti-folder',    route: 'projects'  },
    { labelKey: 'nav.myTasks',   icon: 'ti-checklist', route: 'my-tasks'  },
    { labelKey: 'nav.team',      icon: 'ti-users',      route: 'team'      },
  ];

  constructor(
    private authService: AuthService,
    private router: Router,
    private notificationService: NotificationService,
  ) {}

  ngOnInit() {
  const accent = localStorage.getItem('accent');
  if (accent) document.documentElement.style.setProperty('--accent', accent);
    this.currentUser = this.authService.getCurrentUser();
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: any) => {
        const segments = e.urlAfterRedirects.split('/');
        this.activeRoute = segments[segments.length - 1] ?? '';
      });
    const segments = this.router.url.split('/');
    this.activeRoute = segments[segments.length - 1] ?? '';
  }

  navigateTo(route: string) {
    this.router.navigate(['/app', route]);
  }
  
  isActive(route: string): boolean {
    return this.activeRoute === route ||
      (route === 'projects' && this.router.url.startsWith('/app/projects/'));
  }

  get initials(): string {
    if (!this.currentUser?.name) return '?';
    return this.currentUser.name
      .split(' ')
      .map(w => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  logout() {
    this.notificationService.reset();
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  toggleUserMenu() {
    this.showUserMenu = !this.showUserMenu;
  }

  isSidebarOpen = false;

toggleSidebar() {
  this.isSidebarOpen = !this.isSidebarOpen;
}
}

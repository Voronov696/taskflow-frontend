import { Component, ElementRef, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { NotificationService, NotificationItem, DeadlineItem } from '../../../core/notification/notification.service';
import { NotificationType } from '../../../domain/models/notification.model';

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './notification-bell.component.html',
  styleUrl: './notification-bell.component.scss',
})
export class NotificationBellComponent implements OnInit, OnDestroy {
  isOpen = false;
  notifications: NotificationItem[] = [];
  deadlineItems: DeadlineItem[] = [];
  unreadCount = 0;
  deadlinesEnabled = true;

  constructor(
    private notificationService: NotificationService,
    private router: Router,
    private translate: TranslateService,
    private elementRef: ElementRef,
  ) {}

  ngOnInit() {
    this.notificationService.notifications$.subscribe(items => (this.notifications = items.slice(0, 10)));
    this.notificationService.deadlineItems$.subscribe(items => (this.deadlineItems = items.slice(0, 5)));
    this.notificationService.unreadCount$.subscribe(count => (this.unreadCount = count));
    this.notificationService.deadlinesEnabled$.subscribe(enabled => (this.deadlinesEnabled = enabled));
    this.notificationService.startPolling();
  }

  ngOnDestroy() {
    this.notificationService.stopPolling();
  }

  // Клик вне колокольчика/выпадающего списка закрывает его — тот же подход,
  // что и у любого другого дропдауна за пределами приложения (в shell'е
  // user-menu, наоборот, закрывается только повторным кликом по себе,
  // но там нет содержимого, требующего клика "мимо").
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (this.isOpen && !this.elementRef.nativeElement.contains(event.target)) {
      this.isOpen = false;
    }
  }

  toggle() {
    this.isOpen = !this.isOpen;
    // Открыли дропдаун — сразу гасим бейдж и подсветку "новое" у всего,
    // что сейчас показано. Уведомления никуда не пропадают из списка,
    // просто перестают считаться непрочитанными (см. markAllRead в сервисе:
    // он не удаляет записи, только выставляет isRead = true).
    if (this.isOpen) {
      this.notificationService.markAllRead();
    }
  }

  markAllRead() {
    this.notificationService.markAllRead();
  }

  onNotificationClick(item: NotificationItem) {
    this.notificationService.markRead(item.id);
    this.isOpen = false;

    switch (item.type) {
      case 'friend_request':
        this.router.navigate(['/app/team']);
        break;
      case 'task_assigned':
      case 'task_completed':
        if (item.projectId) {
          this.router.navigate(['/app/projects', item.projectId]);
        } else {
          this.router.navigate(['/app/my-tasks']);
        }
        break;
    }
  }

  onDeadlineClick(item: DeadlineItem) {
    this.isOpen = false;
    if (item.task.projectId) {
      this.router.navigate(['/app/projects', item.task.projectId]);
    } else {
      this.router.navigate(['/app/my-tasks']);
    }
  }

  typeIcon(type: NotificationType): string {
    switch (type) {
      case 'friend_request': return 'ti-user-plus';
      case 'task_assigned':  return 'ti-clipboard-check';
      case 'task_completed': return 'ti-circle-check';
    }
  }

  typeTextKey(type: NotificationType): string {
    switch (type) {
      case 'friend_request': return 'notificationsBell.types.friendRequest';
      case 'task_assigned':  return 'notificationsBell.types.taskAssigned';
      case 'task_completed': return 'notificationsBell.types.taskCompleted';
    }
  }

  actorName(item: NotificationItem): string {
    return item.actorName || this.translate.instant('notificationsBell.types.unknownActor');
  }

  deadlineTextKey(urgency: DeadlineItem['urgency']): string {
    switch (urgency) {
      case 'overdue': return 'notificationsBell.deadline.overdue';
      case 'today':   return 'notificationsBell.deadline.dueToday';
      case 'soon':    return 'notificationsBell.deadline.dueSoon';
    }
  }

  /** Coarse "Xm/Xh/Xd ago" label — no need for anything more precise in a dropdown. */
  relativeTime(createdAt: string): string {
    const diffMs = Date.now() - new Date(createdAt).getTime();
    const minutes = Math.floor(diffMs / 60_000);
    if (minutes < 1) return this.translate.instant('notificationsBell.time.now');
    if (minutes < 60) return this.translate.instant('notificationsBell.time.minutesAgo', { count: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return this.translate.instant('notificationsBell.time.hoursAgo', { count: hours });
    const days = Math.floor(hours / 24);
    return this.translate.instant('notificationsBell.time.daysAgo', { count: days });
  }
}

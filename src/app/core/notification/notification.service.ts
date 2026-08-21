import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject, forkJoin, of, timer } from 'rxjs';
import { catchError, map, switchMap, takeUntil, tap } from 'rxjs/operators';
import { NotificationRepository } from '../../domain/repositories/notification.repository';
import { FriendshipRepository } from '../../domain/repositories/friendship.repository';
import { TaskRepository } from '../../domain/repositories/task.repository';
import { AuthService } from '../auth/auth.service';
import { UrgencyService } from '../urgency/urgency.service';
import { Notification } from '../../domain/models/notification.model';
import { Task } from '../../domain/models/task.model';
import { getNotificationPreferences } from './notification-preferences';

/** A DB-backed notification, enriched with the actor's display name for rendering. */
export interface NotificationItem extends Notification {
  actorName: string | null;
}

export type DeadlineUrgency = 'soon' | 'today' | 'overdue';

/**
 * A synthetic "deadline approaching" row, computed on the fly from the
 * user's tasks via UrgencyService — never persisted, never marked read
 * (see migrations/013_notifications.sql: this is deliberately NOT a
 * stored notification type).
 */
export interface DeadlineItem {
  task: Task;
  urgency: DeadlineUrgency;
  daysRemaining: number;
}

const POLL_INTERVAL_MS = 45_000;

@Injectable({ providedIn: 'root' })
export class NotificationService implements OnDestroy {
  private notificationsSubject = new BehaviorSubject<NotificationItem[]>([]);
  private deadlineItemsSubject = new BehaviorSubject<DeadlineItem[]>([]);
  private unreadCountSubject = new BehaviorSubject<number>(0);

  private deadlinesEnabledSubject = new BehaviorSubject<boolean>(true);

  notifications$ = this.notificationsSubject.asObservable();
  deadlineItems$ = this.deadlineItemsSubject.asObservable();
  /** Unread count for the bell badge — DB notifications only, deadlines are informative and don't count here. */
  unreadCount$ = this.unreadCountSubject.asObservable();
  /** Whether the "Deadline reminders" toggle in Settings is on — the bell hides the whole Deadlines section when it's off, not just its items. */
  deadlinesEnabled$ = this.deadlinesEnabledSubject.asObservable();

  private actorNameCache = new Map<string, string | null>();
  private stopPolling$ = new Subject<void>();
  private polling = false;

  constructor(
    private repo: NotificationRepository,
    private friendshipRepo: FriendshipRepository,
    private taskRepo: TaskRepository,
    private authService: AuthService,
    private urgencyService: UrgencyService,
  ) {}

  ngOnDestroy(): void {
    this.stopPolling();
  }

  /** Loads notifications + deadlines once immediately, then every ~45s until stopPolling(). Safe to call more than once. */
  startPolling(): void {
    if (this.polling) return;
    this.polling = true;
    timer(0, POLL_INTERVAL_MS)
      .pipe(
        switchMap(() => this.refresh()),
        takeUntil(this.stopPolling$),
      )
      .subscribe();
  }

  stopPolling(): void {
    this.polling = false;
    this.stopPolling$.next();
  }

  /** Clears cached state on logout — this service is a singleton, so a second account logging in in the same tab must not see the previous user's notifications for a frame. */
  reset(): void {
    this.stopPolling();
    this.actorNameCache.clear();
    this.notificationsSubject.next([]);
    this.deadlineItemsSubject.next([]);
    this.unreadCountSubject.next(0);
    this.deadlinesEnabledSubject.next(true);
  }

  /** One-shot reload of both the real notifications and the computed deadline rows. */
  refresh(): Observable<void> {
    return forkJoin({
      notifications: this.loadNotifications(),
      deadlines: this.loadDeadlineItems(),
    }).pipe(map(() => undefined));
  }

  markRead(id: string): void {
    const current = this.notificationsSubject.value;
    const target = current.find(n => n.id === id);
    if (!target || target.isRead) return;

    this.repo.markRead(id).subscribe({
      next: () => {
        const updated = this.notificationsSubject.value.map(n =>
          n.id === id ? { ...n, isRead: true } : n
        );
        this.notificationsSubject.next(updated);
        this.unreadCountSubject.next(updated.filter(n => !n.isRead).length);
      },
    });
  }

  markAllRead(): void {
    if (this.unreadCountSubject.value === 0) return;
    this.repo.markAllRead().subscribe({
      next: () => {
        const updated = this.notificationsSubject.value.map(n => ({ ...n, isRead: true }));
        this.notificationsSubject.next(updated);
        this.unreadCountSubject.next(0);
      },
    });
  }

  private loadNotifications(): Observable<NotificationItem[]> {
    return this.repo.getMine().pipe(
      catchError(() => of([] as Notification[])),
      // Типы, выключенные в Settings → Notifications, отфильтровываются
      // здесь же, до резолва имён — чтобы не тратить лишние getUserById
      // на уведомления, которые всё равно не покажем. Сервер по-прежнему
      // создаёт и хранит их все (Вариант A: фильтр только на фронте).
      map(notifications => {
        const prefs = getNotificationPreferences();
        return notifications.filter(n => prefs[n.type]);
      }),
      switchMap(notifications => this.withActorNames(notifications)),
      tap(items => {
        this.notificationsSubject.next(items);
        this.unreadCountSubject.next(items.filter(n => !n.isRead).length);
      }),
    );
  }

  private withActorNames(notifications: Notification[]): Observable<NotificationItem[]> {
    const unresolvedIds = [...new Set(
      notifications
        .map(n => n.actorId)
        .filter((id): id is string => !!id && !this.actorNameCache.has(id))
    )];

    if (unresolvedIds.length === 0) {
      return of(notifications.map(n => ({ ...n, actorName: n.actorId ? this.actorNameCache.get(n.actorId) ?? null : null })));
    }

    return forkJoin(
      unresolvedIds.map(id =>
        this.friendshipRepo.getUserById(id).pipe(catchError(() => of(null)))
      )
    ).pipe(
      map(users => {
        users.forEach((user, i) => this.actorNameCache.set(unresolvedIds[i], user?.name ?? null));
        return notifications.map(n => ({
          ...n,
          actorName: n.actorId ? this.actorNameCache.get(n.actorId) ?? null : null,
        }));
      })
    );
  }

  private loadDeadlineItems(): Observable<DeadlineItem[]> {
    const prefs = getNotificationPreferences();
    this.deadlinesEnabledSubject.next(prefs.deadline);
    if (!prefs.deadline) {
      this.deadlineItemsSubject.next([]);
      return of([]);
    }

    const user = this.authService.getCurrentUser();
    if (!user) {
      this.deadlineItemsSubject.next([]);
      return of([]);
    }

    return this.taskRepo.getByUser(user.id).pipe(
      catchError(() => of([] as Task[])),
      map(tasks => {
        const items = tasks
          .filter(t => t.status !== 'done')
          .map(t => this.toDeadlineItem(t))
          .filter((item): item is DeadlineItem => item !== null)
          .sort((a, b) => a.daysRemaining - b.daysRemaining);
        this.deadlineItemsSubject.next(items);
        return items;
      }),
    );
  }

  private toDeadlineItem(task: Task): DeadlineItem | null {
    const level = this.urgencyService.getLevel(task.dueDate);
    if (level !== 'soon' && level !== 'urgent' && level !== 'overdue') return null;

    const daysRemaining = this.urgencyService.getDaysRemaining(task.dueDate)!;
    const urgency: DeadlineUrgency = level === 'overdue' ? 'overdue' : daysRemaining === 0 ? 'today' : 'soon';
    return { task, urgency, daysRemaining };
  }
}

import { NotificationType } from '../../domain/models/notification.model';

/**
 * Per-type opt-out for the bell — one flag per real notification source,
 * plus 'deadline' for the frontend-only deadline rows (not a DB type,
 * see notification.service.ts). Client-only (localStorage): filtering
 * happens in NotificationService, the backend still creates every row
 * regardless of this setting — see the diagnostic discussion for why
 * (Variant A: simplest, no migration, matches how accent/language are
 * already stored in this app).
 */
export type NotificationPreferences = Record<NotificationType | 'deadline', boolean>;

const STORAGE_KEY = 'notifications';

const DEFAULT_PREFERENCES: NotificationPreferences = {
  friend_request: true,
  task_assigned: true,
  task_completed: true,
  deadline: true,
};

/** Reads preferences from localStorage, defaulting any missing/unknown key to enabled. */
export function getNotificationPreferences(): NotificationPreferences {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { ...DEFAULT_PREFERENCES };
  try {
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function saveNotificationPreferences(prefs: NotificationPreferences): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

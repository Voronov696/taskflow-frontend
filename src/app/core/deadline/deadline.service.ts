import { Injectable } from '@angular/core';

export type TaskDeadlineState = 'none' | 'normal' | 'warning' | 'expired';

@Injectable({ providedIn: 'root' })
export class DeadlineService {

  /** Parse an ISO date string (YYYY-MM-DD) as local midnight to avoid UTC offset issues. */
  private toLocalMidnight(dateStr: string): Date {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  private todayMidnight(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /**
   * Returns the deadline state for a task.
   * - 'none'    → no due date set (e.g. after project was unpaused)
   * - 'normal'  → more than 3 days until deadline
   * - 'warning' → 3 days or fewer remaining (inclusive of today)
   * - 'expired' → due date is in the past
   */
  getTaskState(dueDate: string | null): TaskDeadlineState {
    if (!dueDate) return 'none';

    const today = this.todayMidnight();
    const due   = this.toLocalMidnight(dueDate);

    if (due < today) return 'expired';

    const diffDays = (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 3 ? 'warning' : 'normal';
  }

  /**
   * Returns the number of days until the due date.
   * Negative values mean the deadline has passed.
   * Returns null when dueDate is null.
   */
  getDaysUntil(dueDate: string | null): number | null {
    if (!dueDate) return null;

    const today = this.todayMidnight();
    const due   = this.toLocalMidnight(dueDate);
    return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }
}

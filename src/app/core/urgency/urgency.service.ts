import { Injectable } from '@angular/core';

/**
 * Уровень визуальной срочности по дате окончания — общий для задач И
 * проектов (в отличие от core/deadline/DeadlineService, который считает
 * только 'expired' для БИЗНЕС-правил задач: блокировка завершения/удаления
 * при просрочке — этот сервис его не заменяет, а дополняет чисто визуально).
 *
 * null — даты нет вообще, никаких предупреждений быть не должно.
 */
export type UrgencyLevel = 'normal' | 'soon' | 'urgent' | 'overdue';

/** С этого числа дней до срока начинается мягкое жёлтое предупреждение. */
export const URGENCY_SOON_DAYS = 7;
/** С этого числа дней до срока начинается яркое оранжевое предупреждение. */
export const URGENCY_URGENT_DAYS = 3;

@Injectable({ providedIn: 'root' })
export class UrgencyService {

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

  /** Целых календарных дней до срока (локальная дата пользователя). Отрицательное — уже просрочено. */
  getDaysRemaining(dueDate: string | null | undefined): number | null {
    if (!dueDate) return null;
    const today = this.todayMidnight();
    const due = this.toLocalMidnight(dueDate);
    return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  getLevel(dueDate: string | null | undefined): UrgencyLevel | null {
    const days = this.getDaysRemaining(dueDate);
    if (days === null) return null;
    if (days < 0) return 'overdue';
    if (days <= URGENCY_URGENT_DAYS) return 'urgent';
    if (days <= URGENCY_SOON_DAYS) return 'soon';
    return 'normal';
  }

  /** Текст бейджа: '' для normal/без даты — там ничего подсвечивать не нужно. */
  getLabel(dueDate: string | null | undefined): string {
    const level = this.getLevel(dueDate);
    if (level === null || level === 'normal') return '';
    if (level === 'overdue') return 'Просрочено';

    const days = this.getDaysRemaining(dueDate)!;
    if (days === 0) return 'Сегодня';
    if (level === 'urgent') return `Осталось ${days} дн.`;
    return `Осталось ${days} ${this.daysWord(days)}`;
  }

  private daysWord(n: number): string {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 14) return 'дней';
    if (mod10 === 1) return 'день';
    if (mod10 >= 2 && mod10 <= 4) return 'дня';
    return 'дней';
  }
}

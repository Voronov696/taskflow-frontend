import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TaskRepository } from '../../domain/repositories/task.repository';
import { ProjectRepository } from '../../domain/repositories/project.repository';
import { AuthService } from '../../core/auth/auth.service';
import { LanguageService } from '../../core/i18n/language.service';
import { DeadlineService, TaskDeadlineState } from '../../core/deadline/deadline.service';
import { UrgencyService, UrgencyLevel } from '../../core/urgency/urgency.service';
import { Task } from '../../domain/models/task.model';
import { Project } from '../../domain/models/project.model';

@Component({
  selector: 'app-my-tasks',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './my-tasks.component.html',
  styleUrl: './my-tasks.component.scss',
})
export class MyTasksComponent implements OnInit {
  currentUser: any = null;
  myTasks: Task[] = [];
  projectsMap: Record<string, Project> = {};
  showCompleted = false;
  showExpired = false;
  activeFilter: 'all' | 'active' | 'warning' | 'expired' | 'completed' = 'all';

  constructor(
    private authService: AuthService,
    private taskRepo: TaskRepository,
    private projectRepo: ProjectRepository,
    private deadlineService: DeadlineService,
    private urgencyService: UrgencyService,
    private router: Router,
    private translate: TranslateService,
    private languageService: LanguageService,
  ) {}

  ngOnInit() {
    this.currentUser = this.authService.getCurrentUser();
    if (!this.currentUser) return;

    this.taskRepo.getByUser(this.currentUser.id).subscribe((tasks: Task[]) => {
      this.myTasks = tasks;
      const ids = [...new Set(tasks.map((t) => t.projectId).filter((id): id is string => !!id))];
      if (!ids.length) return;

      forkJoin(ids.map((id) => this.projectRepo.getById(id).pipe(catchError(() => of(null)))))
        .subscribe((projects) => {
          this.projectsMap = {};
          projects.forEach((p, i) => { if (p) this.projectsMap[ids[i]] = p as Project; });
        });
    });
  }

  // ── Groupings & filter ────────────────────────────────────────────────────

  get completedTasks(): Task[] { return this.myTasks.filter((t) => t.status === 'done'); }

  // Просроченные задачи уходят в сворачиваемый архив (Часть 3 ТЗ) — та же
  // логика, что в project-detail.component.ts, ради единообразия обеих
  // страниц со списками задач.
  //
  // Задачи проекта на паузе тоже уходят отсюда (см. isProjectPaused) — они
  // не удаляются и не пропадают из myTasks, просто не считаются активными,
  // пока проект приостановлен. Внутри самого проекта (project-detail) они
  // по-прежнему видны — там своя, независимая загрузка задач.
  private get sortedActiveTasks(): Task[] {
    const order: Record<TaskDeadlineState, number> = { warning: 0, normal: 1, none: 2, expired: 3 };
    return this.myTasks
      .filter((t) => t.status !== 'done' && this.getTaskState(t) !== 'expired' && !this.isProjectPaused(t.projectId))
      .sort((a, b) => order[this.getTaskState(a)] - order[this.getTaskState(b)]);
  }

  get filteredTasks(): Task[] {
    const sorted = this.sortedActiveTasks;
    switch (this.activeFilter) {
      case 'active':    return sorted.filter((t) => { const s = this.getTaskState(t); return s === 'normal' || s === 'none'; });
      case 'warning':   return sorted.filter((t) => this.getTaskState(t) === 'warning');
      case 'expired':   return [];
      case 'completed': return [];
      default:          return sorted;
    }
  }

  get expiredTasks(): Task[] {
    return this.myTasks.filter((t) => t.status !== 'done' && this.getTaskState(t) === 'expired' && !this.isProjectPaused(t.projectId));
  }

  get warningCount(): number {
    return this.myTasks.filter((t) => t.status !== 'done' && this.getTaskState(t) === 'warning' && !this.isProjectPaused(t.projectId)).length;
  }
  get expiredCount(): number {
    return this.expiredTasks.length;
  }

  get emptyFilterMessage(): string {
    switch (this.activeFilter) {
      case 'active':    return this.translate.instant('myTasks.emptyMessages.active');
      case 'warning':   return this.translate.instant('myTasks.emptyMessages.warning');
      case 'expired':   return this.translate.instant('myTasks.emptyMessages.expired');
      case 'completed': return this.translate.instant('myTasks.emptyMessages.completed');
      default:          return this.translate.instant('myTasks.emptyMessages.default');
    }
  }

  setFilter(f: typeof this.activeFilter) {
    this.activeFilter = f;
    if (f === 'completed') this.showCompleted = true;
    if (f === 'expired') this.showExpired = true;
  }

  toggleExpired() { this.showExpired = !this.showExpired; }

  // ── Срочность (Часть 2A ТЗ) ─────────────────────────────────────────────────

  getUrgency(task: Task): UrgencyLevel | null {
    return this.urgencyService.getLevel(task.dueDate);
  }

  getUrgencyLabel(task: Task): string {
    return this.urgencyService.getLabel(task.dueDate);
  }

  get productivity(): number {
    if (!this.myTasks.length) return 0;
    return Math.round((this.completedTasks.length / this.myTasks.length) * 100);
  }

  // ── Deadline helpers ──────────────────────────────────────────────────────

  getTaskState(task: Task): TaskDeadlineState {
    return this.deadlineService.getTaskState(task.dueDate);
  }

  getDeadlineLabel(task: Task): string {
    const state = this.getTaskState(task);
    if (state === 'none') return this.translate.instant('deadline.noDeadline');
    if (state === 'expired') return this.translate.instant('deadline.expired');
    const days = this.deadlineService.getDaysUntil(task.dueDate)!;
    if (state === 'warning') return days === 0 ? this.translate.instant('deadline.dueToday') : this.translate.instant('deadline.daysLeftShort', { count: days });
    return this.formatDueDate(task.dueDate);
  }

  formatDueDate(dueDate: string | null): string {
    if (!dueDate) return '';
    const [year, month, day] = dueDate.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString(this.languageService.getIntlLocale(), {
      day: 'numeric', month: 'short',
    });
  }

  // ── Permission checks ─────────────────────────────────────────────────────

  isProjectPaused(projectId: string | null): boolean {
    if (!projectId) return false;
    return this.projectsMap[projectId]?.status === 'paused';
  }

  /** Paused projects and expired tasks both block completion. */
  canCompleteTask(task: Task): boolean {
    if (this.isProjectPaused(task.projectId)) return false;
    return this.getTaskState(task) !== 'expired';
  }

  /** Paused projects block all deletes. Personal tasks (no project) can always be deleted; project tasks — only by the project owner. */
  canDeleteTask(task: Task): boolean {
    if (this.isProjectPaused(task.projectId)) return false;
    if (!task.projectId) return true;
    return this.projectsMap[task.projectId]?.ownerId === this.currentUser?.id;
  }

  /** Tooltip text for the completion checkbox. */
  getCheckboxTitle(task: Task): string {
    if (this.isProjectPaused(task.projectId)) return this.translate.instant('myTasks.checkboxTooltip.paused');
    if (this.getTaskState(task) === 'expired') return this.translate.instant('myTasks.checkboxTooltip.expired');
    return task.status === 'done' ? this.translate.instant('myTasks.checkboxTooltip.markTodo') : this.translate.instant('myTasks.checkboxTooltip.markDone');
  }

  // ── Task actions ──────────────────────────────────────────────────────────

  toggleTask(task: Task) {
    if (!this.canCompleteTask(task)) return;
    const next = task.status === 'done' ? 'todo' : 'done';
    this.taskRepo.updateStatus(task.id, next).subscribe(updated => {
      task.status = updated.status;
      task.completedAt = updated.completedAt;
    });
  }

  deleteTask(taskId: string) {
    const task = this.myTasks.find((t) => t.id === taskId);
    if (task && !this.canDeleteTask(task)) return;
    if (!confirm(this.translate.instant('myTasks.confirmDeleteTask'))) return;
    this.taskRepo.delete(taskId).subscribe(() => {
      this.myTasks = this.myTasks.filter((t) => t.id !== taskId);
    });
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  getProjectName(projectId: string | null): string {
    if (!projectId) return this.translate.instant('myTasks.personalProject');
    return this.projectsMap[projectId]?.name ?? this.translate.instant('myTasks.personalProject');
  }

  goToProject(projectId: string | null) {
    if (projectId) this.router.navigate(['/app/projects', projectId]);
  }

  toggleCompleted() { this.showCompleted = !this.showCompleted; }
}

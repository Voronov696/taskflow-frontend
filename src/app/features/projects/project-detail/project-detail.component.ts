import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ProjectRepository } from '../../../domain/repositories/project.repository';
import { TaskRepository } from '../../../domain/repositories/task.repository';
import { AuthService } from '../../../core/auth/auth.service';
import { FriendshipService } from '../../../core/friendship/friendship.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { DeadlineService, TaskDeadlineState } from '../../../core/deadline/deadline.service';
import { UrgencyService, UrgencyLevel } from '../../../core/urgency/urgency.service';
import { Project } from '../../../domain/models/project.model';
import { Task } from '../../../domain/models/task.model';
import { User } from '../../../domain/models/user.model';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './project-detail.component.html',
  styleUrl: './project-detail.component.scss',
})
export class ProjectDetailComponent implements OnInit {
  project: Project | null = null;
  tasks: Task[] = [];
  currentUser: User | null = null;
  friends: User[] = [];

  // Inline task creation (owner only)
  inlineTaskTitle = '';
  inlineTaskDueDate = '';
  inlineTaskAssigneeId = '';
  inlineError = '';

  // Inline task editing (owner only)
  editingTaskId: string | null = null;
  editDueDate = '';
  editAssigneeId = '';

  showCompleted = false;
  showExpired = false;
  activeFilter: 'all' | 'active' | 'warning' | 'expired' | 'completed' = 'all';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private projectRepo: ProjectRepository,
    private taskRepo: TaskRepository,
    private authService: AuthService,
    private friendshipService: FriendshipService,
    private deadlineService: DeadlineService,
    private urgencyService: UrgencyService,
    private translate: TranslateService,
    private languageService: LanguageService,
  ) {}

  ngOnInit() {
    this.currentUser = this.authService.getCurrentUser();
    const id = this.route.snapshot.paramMap.get('id')!;
    this.projectRepo.getById(id).subscribe((p: Project) => {
      this.project = p;
      this.friendshipService.getFriends(p.ownerId).subscribe((f) => (this.friends = f));
    });
    this.loadTasks(id);
  }

  loadTasks(projectId: string) {
    this.taskRepo.getByProject(projectId).subscribe((t: Task[]) => (this.tasks = t));
  }

  get isOwner(): boolean {
    return !!this.project && this.project.ownerId === this.currentUser?.id;
  }

  get isPaused(): boolean {
    return this.project?.status === 'paused';
  }

  // Просроченные задачи (dueDate в прошлом, status !== 'done') не мусорят в
  // основном списке — они уходят в сворачиваемую секцию "Просроченные" (см.
  // expiredTasks ниже, Часть 3 ТЗ). "Готово" в архив не уходит — задача
  // просто завершена штатно.
  private get sortedActiveTasks(): Task[] {
    const order: Record<TaskDeadlineState, number> = { warning: 0, normal: 1, none: 2, expired: 3 };
    return this.tasks
      .filter((t) => t.status !== 'done' && this.getTaskState(t) !== 'expired')
      .sort((a, b) => order[this.getTaskState(a)] - order[this.getTaskState(b)]);
  }

  get filteredActiveTasks(): Task[] {
    const sorted = this.sortedActiveTasks;
    switch (this.activeFilter) {
      case 'active':    return sorted.filter((t) => { const s = this.getTaskState(t); return s === 'normal' || s === 'none'; });
      case 'warning':   return sorted.filter((t) => this.getTaskState(t) === 'warning');
      case 'expired':   return []; // раскрывает секцию "Просроченные" ниже, как 'completed' — секцию "Завершённые"
      case 'completed': return [];
      default:          return sorted;
    }
  }

  get completedTasks(): Task[] {
    return this.tasks.filter((t) => t.status === 'done');
  }

  /** Архив — просроченные незавершённые задачи (Часть 3 ТЗ). */
  get expiredTasks(): Task[] {
    return this.tasks.filter((t) => t.status !== 'done' && this.getTaskState(t) === 'expired');
  }

  get warningCount(): number {
    return this.tasks.filter((t) => t.status !== 'done' && this.getTaskState(t) === 'warning').length;
  }
  get expiredCount(): number {
    return this.expiredTasks.length;
  }

  get emptyFilterMessage(): string {
    switch (this.activeFilter) {
      case 'active':    return this.translate.instant('projects.detail.emptyMessages.active');
      case 'warning':   return this.translate.instant('projects.detail.emptyMessages.warning');
      case 'expired':   return this.translate.instant('projects.detail.emptyMessages.expired');
      case 'completed': return this.translate.instant('projects.detail.emptyMessages.completed');
      default:          return this.translate.instant('projects.detail.emptyMessages.default');
    }
  }

  setFilter(f: typeof this.activeFilter) {
    this.activeFilter = f;
    if (f === 'completed') this.showCompleted = true;
    if (f === 'expired') this.showExpired = true;
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
      day: 'numeric',
      month: 'short',
    });
  }

  // ── Срочность (визуальные предупреждения, Часть 2A ТЗ) ─────────────────────

  getUrgency(task: Task): UrgencyLevel | null {
    return this.urgencyService.getLevel(task.dueDate);
  }

  getUrgencyLabel(task: Task): string {
    return this.urgencyService.getLabel(task.dueDate);
  }

  // ── Групповые проекты (Часть 2B ТЗ) ─────────────────────────────────────────

  /** Задача назначена не на меня — в проекте, где я не владелец, помечаем её пунктиром. */
  isOthersTask(task: Task): boolean {
    if (this.isOwner) return false;
    return !!task.assignedUserId && task.assignedUserId !== this.currentUser?.id;
  }

  // ── Permission checks ─────────────────────────────────────────────────────

  /** Nobody can complete a task when the project is paused or when the task is expired. */
  canComplete(task: Task): boolean {
    if (this.isPaused) return false;
    return this.getTaskState(task) !== 'expired';
  }

  /** Paused projects freeze all deletes. Otherwise only the project owner can delete — others cannot. */
  canDeleteTask(task: Task): boolean {
    if (this.isPaused) return false;
    return this.isOwner;
  }

  // ── Task actions ──────────────────────────────────────────────────────────

  toggleStatus(task: Task) {
    if (!this.canComplete(task)) return;
    const next = task.status === 'done' ? 'todo' : 'done';
    this.taskRepo.updateStatus(task.id, next).subscribe(updated => {
      task.status = updated.status;
      task.completedAt = updated.completedAt;
    });
  }

  deleteTask(taskId: string) {
    const task = this.tasks.find((t) => t.id === taskId);
    if (task && !this.canDeleteTask(task)) return;
    if (!confirm(this.translate.instant('projects.detail.confirmDeleteTask'))) return;
    this.taskRepo.delete(taskId).subscribe(() => {
      this.tasks = this.tasks.filter((t) => t.id !== taskId);
    });
  }

  // ── Inline creation ───────────────────────────────────────────────────────

  createInlineTask() {
    if (this.isPaused) return;
    const title = this.inlineTaskTitle.trim();
    if (!title) { this.inlineError = this.translate.instant('projects.detail.errors.nameRequired'); return; }
    if (!this.inlineTaskDueDate) { this.inlineError = this.translate.instant('projects.detail.errors.dueDateRequired'); return; }
    if (!this.project) return;

    this.inlineError = '';
    this.taskRepo
      .create({
        title,
        description: '',
        status: 'todo',
        projectId: this.project.id,
        assignedUserId: this.inlineTaskAssigneeId,
        dueDate: this.inlineTaskDueDate,
      })
      .subscribe({
        next: () => {
          this.inlineTaskTitle = '';
          this.inlineTaskDueDate = '';
          this.inlineTaskAssigneeId = '';
          this.loadTasks(this.project!.id);
        },
        error: () => alert(this.translate.instant('projects.detail.errors.createFailed')),
      });
  }

  onInlineKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') this.createInlineTask();
  }

  // ── Inline editing (owner only) ───────────────────────────────────────────

  startEdit(task: Task) {
    this.editingTaskId = task.id;
    this.editDueDate = task.dueDate ?? '';
    this.editAssigneeId = task.assignedUserId;
  }

  cancelEdit() {
    this.editingTaskId = null;
    this.editDueDate = '';
    this.editAssigneeId = '';
  }

  saveEdit(task: Task) {
    this.taskRepo
      .update(task.id, {
        dueDate: this.editDueDate || null,
        assignedUserId: this.editAssigneeId,
      })
      .subscribe((updated) => {
        // Берём значения из ответа сервера, а не из полей формы — раньше
        // тут писали то, что ввёл пользователь, не дожидаясь и не проверяя,
        // что реально сохранилось (due_date у задач тогда даже не было в
        // базе — см. миграцию 009). Теперь, когда due_date есть, доверяем
        // именно тому, что подтвердил сервер.
        task.dueDate = updated.dueDate;
        task.assignedUserId = updated.assignedUserId;
        this.cancelEdit();
      });
  }

  // ── Misc ──────────────────────────────────────────────────────────────────

  getMemberName(userId: string): string {
    if (!userId) return this.translate.instant('projects.detail.unassigned');
    if (userId === this.currentUser?.id) return this.currentUser.name;
    return this.friends.find((f) => f.id === userId)?.name ?? this.translate.instant('projects.detail.unknown');
  }

  unpauseFromDetail() {
    if (!this.project || !this.isOwner) return;
    this.projectRepo.updateStatus(this.project.id, 'active').subscribe(() => {
      this.project!.status = 'active';
    });
  }

  toggleCompleted() { this.showCompleted = !this.showCompleted; }
  toggleExpired() { this.showExpired = !this.showExpired; }
  goBack() { this.router.navigate(['/app/projects']); }
}

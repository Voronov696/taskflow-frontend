import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { TaskRepository } from '../../domain/repositories/task.repository';
import { ProjectRepository } from '../../domain/repositories/project.repository';
import { AuthService } from '../../core/auth/auth.service';
import { DeadlineService, TaskDeadlineState } from '../../core/deadline/deadline.service';
import { Task } from '../../domain/models/task.model';
import { Project } from '../../domain/models/project.model';

@Component({
  selector: 'app-my-tasks',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './my-tasks.component.html',
  styleUrl: './my-tasks.component.scss',
})
export class MyTasksComponent implements OnInit {
  currentUser: any = null;
  myTasks: Task[] = [];
  projectsMap: Record<string, Project> = {};
  showCompleted = false;
  activeFilter: 'all' | 'active' | 'warning' | 'expired' | 'completed' = 'all';

  constructor(
    private authService: AuthService,
    private taskRepo: TaskRepository,
    private projectRepo: ProjectRepository,
    private deadlineService: DeadlineService,
    private router: Router,
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

  private get sortedActiveTasks(): Task[] {
    const order: Record<TaskDeadlineState, number> = { warning: 0, normal: 1, none: 2, expired: 3 };
    return this.myTasks
      .filter((t) => t.status !== 'done')
      .sort((a, b) => order[this.getTaskState(a)] - order[this.getTaskState(b)]);
  }

  get filteredTasks(): Task[] {
    const sorted = this.sortedActiveTasks;
    switch (this.activeFilter) {
      case 'active':    return sorted.filter((t) => { const s = this.getTaskState(t); return s === 'normal' || s === 'none'; });
      case 'warning':   return sorted.filter((t) => this.getTaskState(t) === 'warning');
      case 'expired':   return sorted.filter((t) => this.getTaskState(t) === 'expired');
      case 'completed': return [];
      default:          return sorted;
    }
  }

  get warningCount(): number {
    return this.myTasks.filter((t) => t.status !== 'done' && this.getTaskState(t) === 'warning').length;
  }
  get expiredCount(): number {
    return this.myTasks.filter((t) => t.status !== 'done' && this.getTaskState(t) === 'expired').length;
  }

  get emptyFilterMessage(): string {
    switch (this.activeFilter) {
      case 'active':    return 'No active tasks with normal deadlines.';
      case 'warning':   return 'No tasks with upcoming deadlines.';
      case 'expired':   return 'No expired tasks.';
      case 'completed': return 'No completed tasks yet.';
      default:          return 'No tasks assigned to you yet.';
    }
  }

  setFilter(f: typeof this.activeFilter) {
    this.activeFilter = f;
    if (f === 'completed') this.showCompleted = true;
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
    if (state === 'none') return 'No deadline';
    if (state === 'expired') return 'Expired';
    const days = this.deadlineService.getDaysUntil(task.dueDate)!;
    if (state === 'warning') return days === 0 ? 'Due today' : `${days}d left`;
    return this.formatDueDate(task.dueDate);
  }

  formatDueDate(dueDate: string | null): string {
    if (!dueDate) return '';
    const [year, month, day] = dueDate.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
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

  /** Paused projects block all deletes. Expired tasks: only project owner can delete. */
  canDeleteTask(task: Task): boolean {
    if (this.isProjectPaused(task.projectId)) return false;
    if (this.getTaskState(task) !== 'expired') return true;
    if (!task.projectId) return true;
    return this.projectsMap[task.projectId]?.ownerId === this.currentUser?.id;
  }

  /** Tooltip text for the completion checkbox. */
  getCheckboxTitle(task: Task): string {
    if (this.isProjectPaused(task.projectId)) return 'Project is paused — actions frozen';
    if (this.getTaskState(task) === 'expired') return 'Deadline expired — cannot complete';
    return task.status === 'done' ? 'Mark as to-do' : 'Mark as done';
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
    if (!confirm('Delete this task?')) return;
    this.taskRepo.delete(taskId).subscribe(() => {
      this.myTasks = this.myTasks.filter((t) => t.id !== taskId);
    });
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  getProjectName(projectId: string | null): string {
    if (!projectId) return 'Personal';
    return this.projectsMap[projectId]?.name ?? 'Personal';
  }

  goToProject(projectId: string | null) {
    if (projectId) this.router.navigate(['/app/projects', projectId]);
  }

  toggleCompleted() { this.showCompleted = !this.showCompleted; }
}

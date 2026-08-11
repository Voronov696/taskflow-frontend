import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ProjectRepository } from '../../../domain/repositories/project.repository';
import { TaskRepository } from '../../../domain/repositories/task.repository';
import { AuthService } from '../../../core/auth/auth.service';
import { FriendshipService } from '../../../core/friendship/friendship.service';
import { DeadlineService, TaskDeadlineState } from '../../../core/deadline/deadline.service';
import { Project } from '../../../domain/models/project.model';
import { Task } from '../../../domain/models/task.model';
import { User } from '../../../domain/models/user.model';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
  activeFilter: 'all' | 'active' | 'warning' | 'expired' | 'completed' = 'all';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private projectRepo: ProjectRepository,
    private taskRepo: TaskRepository,
    private authService: AuthService,
    private friendshipService: FriendshipService,
    private deadlineService: DeadlineService,
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

  private get sortedActiveTasks(): Task[] {
    const order: Record<TaskDeadlineState, number> = { warning: 0, normal: 1, none: 2, expired: 3 };
    return this.tasks
      .filter((t) => t.status !== 'done')
      .sort((a, b) => order[this.getTaskState(a)] - order[this.getTaskState(b)]);
  }

  get filteredActiveTasks(): Task[] {
    const sorted = this.sortedActiveTasks;
    switch (this.activeFilter) {
      case 'active':    return sorted.filter((t) => { const s = this.getTaskState(t); return s === 'normal' || s === 'none'; });
      case 'warning':   return sorted.filter((t) => this.getTaskState(t) === 'warning');
      case 'expired':   return sorted.filter((t) => this.getTaskState(t) === 'expired');
      case 'completed': return [];
      default:          return sorted;
    }
  }

  get completedTasks(): Task[] {
    return this.tasks.filter((t) => t.status === 'done');
  }

  get warningCount(): number {
    return this.tasks.filter((t) => t.status !== 'done' && this.getTaskState(t) === 'warning').length;
  }
  get expiredCount(): number {
    return this.tasks.filter((t) => t.status !== 'done' && this.getTaskState(t) === 'expired').length;
  }

  get emptyFilterMessage(): string {
    switch (this.activeFilter) {
      case 'active':    return 'No active tasks with normal deadlines.';
      case 'warning':   return 'No tasks with upcoming deadlines.';
      case 'expired':   return 'No expired tasks.';
      case 'completed': return 'No completed tasks yet.';
      default:          return 'No tasks yet.';
    }
  }

  setFilter(f: typeof this.activeFilter) {
    this.activeFilter = f;
    if (f === 'completed') this.showCompleted = true;
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
      day: 'numeric',
      month: 'short',
    });
  }

  // ── Permission checks ─────────────────────────────────────────────────────

  /** Nobody can complete a task when the project is paused or when the task is expired. */
  canComplete(task: Task): boolean {
    if (this.isPaused) return false;
    return this.getTaskState(task) !== 'expired';
  }

  /** Paused projects freeze all deletes. Otherwise owner can delete expired; others cannot. */
  canDeleteTask(task: Task): boolean {
    if (this.isPaused) return false;
    if (this.getTaskState(task) !== 'expired') return true;
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
    if (!confirm('Delete this task?')) return;
    this.taskRepo.delete(taskId).subscribe(() => {
      this.tasks = this.tasks.filter((t) => t.id !== taskId);
    });
  }

  // ── Inline creation ───────────────────────────────────────────────────────

  createInlineTask() {
    if (this.isPaused) return;
    const title = this.inlineTaskTitle.trim();
    if (!title) { this.inlineError = 'Task name is required.'; return; }
    if (!this.inlineTaskDueDate) { this.inlineError = 'Due date is required.'; return; }
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
        error: () => alert('Failed to create task. Is JSON Server running?'),
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
      .subscribe(() => {
        task.dueDate = this.editDueDate || null;
        task.assignedUserId = this.editAssigneeId;
        this.cancelEdit();
      });
  }

  // ── Misc ──────────────────────────────────────────────────────────────────

  getMemberName(userId: string): string {
    if (!userId) return 'Unassigned';
    if (userId === this.currentUser?.id) return this.currentUser.name;
    return this.friends.find((f) => f.id === userId)?.name ?? 'Unknown';
  }

  unpauseFromDetail() {
    if (!this.project || !this.isOwner) return;
    this.projectRepo.updateStatus(this.project.id, 'active').subscribe(() => {
      this.project!.status = 'active';
    });
  }

  toggleCompleted() { this.showCompleted = !this.showCompleted; }
  goBack() { this.router.navigate(['/app/projects']); }
}

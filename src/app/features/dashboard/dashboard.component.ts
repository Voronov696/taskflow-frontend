import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TaskRepository } from '../../domain/repositories/task.repository';
import { ProjectRepository } from '../../domain/repositories/project.repository';
import { MemberRepository } from '../../domain/repositories/member.repository';
import { AuthService } from '../../core/auth/auth.service';
import { FriendshipService, FriendSearchResult } from '../../core/friendship/friendship.service';
import { Task } from '../../domain/models/task.model';
import { Project } from '../../domain/models/project.model';
import { User } from '../../domain/models/user.model';
import { environment } from '../../../environments/environment';
import { FormsModule } from '@angular/forms';

interface ProjectCard {
  project: Project;
  progress: number;
  taskCount: number;
  memberInitials: string[];
  status: string;
}

interface TrendDay {
  date: string;
  score: number | null;
  dayLabel: string;
  isToday: boolean;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  currentUser: any = null;
  myTasks: Task[] = [];
  myProjects: Project[] = [];
  allTasks: Task[] = [];
  allUsers: User[] = [];
  projectCards: ProjectCard[] = [];
  trendData: TrendDay[] = [];

  showNewProjectModal = false;
  newProjectName = '';
  newProjectDescription = '';

  showFriendModal = false;
  friendSearchQuery = '';
  friendSearchResults: FriendSearchResult[] = [];
  isFriendSearching = false;
  friendSearchDone = false;
  friendAddSuccess = false;
  friendAddedName = '';

  constructor(
    private authService: AuthService,
    private taskRepo: TaskRepository,
    private projectRepo: ProjectRepository,
    private memberRepo: MemberRepository,
    private friendshipService: FriendshipService,
    private router: Router,
    private http: HttpClient,
  ) {}

  ngOnInit() {
    this.currentUser = this.authService.getCurrentUser();
    if (!this.currentUser) return;

    this.http.get<User[]>(`${environment.apiUrl}/users`).subscribe((u: User[]) => {
      this.allUsers = u;
      this.buildCards();
    });

    this.http.get<Task[]>(`${environment.apiUrl}/tasks`).subscribe((t: Task[]) => {
      this.allTasks = t;
      this.buildCards();
    });

    this.projectRepo.getByOwner(this.currentUser.id).subscribe((p: Project[]) => {
      this.myProjects = p;
      this.buildCards();
    });

    this.taskRepo.getByUser(this.currentUser.id).subscribe((t: Task[]) => {
      this.myTasks = t;
      this.buildTrend();
    });
  }

  // ── Project cards ──────────────────────────────────────────────────────────

  buildCards() {
    if (!this.myProjects.length) return;
    this.projectCards = this.myProjects.slice(0, 3).map((project) => {
      const tasks = this.allTasks.filter((t) => t.projectId === project.id);
      const done = tasks.filter((t) => t.status === 'done').length;
      const progress = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;
      const memberIds = [...new Set(tasks.map((t) => t.assignedUserId).filter(Boolean))];
      const memberInitials = memberIds.slice(0, 3).map((id) => {
        const user = this.allUsers.find((u) => u.id === id);
        return user ? user.name.slice(0, 2).toUpperCase() : '??';
      });
      return { project, progress, taskCount: tasks.length, memberInitials, status: project.status };
    });
  }

  // ── Simple stats ───────────────────────────────────────────────────────────

  get activeProjectsCount(): number { return this.myProjects.length; }
  get pendingTasksCount(): number { return this.myTasks.filter((t) => t.status !== 'done').length; }
  get completedTasksCount(): number { return this.myTasks.filter((t) => t.status === 'done').length; }
  get pendingTasks(): Task[] { return this.myTasks.filter((t) => t.status === 'todo').slice(0, 4); }

  get todayDate(): string {
    const d = new Date();
    return `${d.toLocaleDateString('en-GB', { weekday: 'long' })}, ${d.getDate()} ${d.toLocaleDateString('en-GB', { month: 'long' })} ${d.getFullYear()}`;
  }

  get recentProjects(): Project[] { return this.myProjects.slice(0, 4); }

  getProjectProgress(projectId: string): number {
    const tasks = this.allTasks.filter((t) => t.projectId === projectId);
    if (tasks.length === 0) return 0;
    return Math.round((tasks.filter((t) => t.status === 'done').length / tasks.length) * 100);
  }

  getProjectNameById(projectId: string | null): string {
    if (!projectId) return 'Personal';
    return this.myProjects.find((p) => p.id === projectId)?.name ?? 'Unknown';
  }

  // ── Daily Focus Score ──────────────────────────────────────────────────────

  private get todayStr(): string {
    const d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  get tasksDueToday(): Task[] {
    const today = this.todayStr;
    return this.myTasks.filter(t => t.dueDate === today);
  }

  get completedDueToday(): Task[] {
    const today = this.todayStr;
    return this.myTasks.filter(t =>
      t.dueDate === today && t.status === 'done' && t.completedAt === today
    );
  }

  get extraCompletedToday(): Task[] {
    const today = this.todayStr;
    return this.myTasks.filter(t =>
      t.status === 'done' && t.completedAt === today && t.dueDate !== today
    );
  }

  get overdueActiveTasks(): Task[] {
    const today = this.todayStr;
    return this.myTasks.filter(t =>
      t.dueDate !== null && t.dueDate < today && t.status !== 'done'
    );
  }

  get dailyScore(): number {
    const totalDue = this.tasksDueToday.length;
    const completedDue = this.completedDueToday.length;
    const extra = this.extraCompletedToday.length;
    const penalty = this.overdueActiveTasks.length * 5;

    let score: number;
    if (totalDue === 0 && extra === 0) {
      // Rest day — start at 100, only overdue penalty applies
      score = 100 - penalty;
    } else if (totalDue === 0) {
      // Only bonus/backlog tasks done today
      score = Math.min(extra * 15, 100) - penalty;
    } else {
      const base = Math.round((completedDue / totalDue) * 100);
      const bonus = Math.min(extra * 10, 20);
      score = base + bonus - penalty;
    }
    return Math.max(0, Math.min(100, score));
  }

  /** CSS class name used to colour the ring arc, label and trend bars. */
  get scoreClass(): string {
    const s = this.dailyScore;
    if (s >= 80) return 'green';
    if (s >= 60) return 'accent';
    if (s >= 40) return 'warning';
    return 'danger';
  }

  get scoreLabel(): string {
    const totalDue = this.tasksDueToday.length;
    const extra = this.extraCompletedToday.length;
    const overdue = this.overdueActiveTasks.length;
    if (totalDue === 0 && extra === 0 && overdue === 0) return 'Well deserved rest!';
    if (totalDue === 0 && extra > 0) return 'Going above & beyond!';
    const s = this.dailyScore;
    if (s >= 100) return 'Perfect day!';
    if (s >= 80) return 'Great progress!';
    if (s >= 60) return 'Solid work!';
    if (s >= 40) return 'Keep it up!';
    return 'Room to improve';
  }

  get scoreBreakdown(): string {
    const totalDue = this.tasksDueToday.length;
    const completedDue = this.completedDueToday.length;
    const extra = this.extraCompletedToday.length;
    const overdue = this.overdueActiveTasks.length;
    const parts: string[] = [];

    if (totalDue === 0 && extra === 0) {
      parts.push(overdue === 0 ? 'No tasks scheduled today' : 'No tasks planned today');
    } else {
      if (totalDue > 0) parts.push(`${completedDue} of ${totalDue} planned completed`);
      if (extra > 0) parts.push(`+${extra} bonus task${extra > 1 ? 's' : ''}`);
    }
    if (overdue > 0) parts.push(`${overdue} overdue task${overdue > 1 ? 's' : ''} penalised`);
    return parts.join(' · ');
  }

  /** stroke-dasharray value for the SVG arc (r=42, circumference≈263.9). */
  get scoreRingDash(): string {
    return `${(this.dailyScore * 2.639).toFixed(1)} 263.9`;
  }

  // ── 7-day trend ────────────────────────────────────────────────────────────

  private get trendKey(): string {
    return `tf_score_${this.currentUser?.id ?? 'anon'}`;
  }

  private buildTrend(): void {
    const today = this.todayStr;
    const stored = localStorage.getItem(this.trendKey);
    const scores: Record<string, number> = stored ? JSON.parse(stored) : {};

    // Persist today's score
    scores[today] = this.dailyScore;

    // Prune entries older than 30 days
    const d30 = new Date();
    d30.setDate(d30.getDate() - 30);
    const cutoff = d30.getFullYear() + '-' +
      String(d30.getMonth() + 1).padStart(2, '0') + '-' +
      String(d30.getDate()).padStart(2, '0');
    Object.keys(scores).forEach(k => { if (k < cutoff) delete scores[k]; });

    localStorage.setItem(this.trendKey, JSON.stringify(scores));

    // Build [today-6 … today]
    this.trendData = Array.from({ length: 7 }, (_, i) => {
      const day = new Date();
      day.setDate(day.getDate() - (6 - i));
      const dateStr = day.getFullYear() + '-' +
        String(day.getMonth() + 1).padStart(2, '0') + '-' +
        String(day.getDate()).padStart(2, '0');
      return {
        date: dateStr,
        score: scores[dateStr] ?? null,
        dayLabel: day.toLocaleDateString('en-US', { weekday: 'short' }),
        isToday: dateStr === today,
      };
    });
  }

  getBarHeight(score: number | null): number {
    return score === null ? 2 : Math.max(2, score * 0.4);
  }

  getBarColor(score: number | null, isToday: boolean): string {
    if (score === null) return '#1e2235';
    if (score >= 80) return '#10b981';
    if (score >= 60) return '#6c63ff';
    if (score >= 40) return '#f59e0b';
    return '#ef4444';
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  goToProjects()          { this.router.navigate(['/app/projects']); }
  goToProject(id: string) { this.router.navigate(['/app/projects', id]); }
  goToMyTasks()           { this.router.navigate(['/app/my-tasks']); }
  goToTeam()              { this.router.navigate(['/app/team']); }

  // ── New project modal ──────────────────────────────────────────────────────

  openNewProjectModal()  { this.showNewProjectModal = true; }
  closeNewProjectModal() {
    this.showNewProjectModal = false;
    this.newProjectName = '';
    this.newProjectDescription = '';
  }

  createProject() {
    if (!this.newProjectName.trim() || !this.currentUser) return;
    this.projectRepo.create({
      name: this.newProjectName.trim(),
      description: this.newProjectDescription.trim(),
      ownerId: this.currentUser.id,
      status: 'active',
    }).subscribe(() => {
      this.closeNewProjectModal();
      this.projectRepo.getByOwner(this.currentUser.id).subscribe((p: Project[]) => {
        this.myProjects = p;
        this.buildCards();
      });
    });
  }

  // ── Friend search modal ────────────────────────────────────────────────────

  openFriendModal() {
    this.showFriendModal = true;
    this.friendSearchQuery = '';
    this.friendSearchResults = [];
    this.isFriendSearching = false;
    this.friendSearchDone = false;
    this.friendAddSuccess = false;
    this.friendAddedName = '';
  }

  closeFriendModal() { this.showFriendModal = false; }

  performFriendSearch() {
    const q = this.friendSearchQuery.trim();
    if (!q || !this.currentUser) return;
    this.isFriendSearching = true;
    this.friendSearchResults = [];
    this.friendSearchDone = false;
    this.friendAddSuccess = false;

    this.friendshipService.searchUsers(q, this.currentUser.id).subscribe({
      next: (results) => {
        this.friendSearchResults = results;
        this.isFriendSearching = false;
        this.friendSearchDone = true;
      },
      error: () => {
        this.isFriendSearching = false;
        this.friendSearchDone = true;
      },
    });
  }

  onFriendSearchKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') this.performFriendSearch();
  }

  addFriendFromDashboard(target: User) {
    if (!this.currentUser) return;
    this.friendshipService.addFriend(this.currentUser.id, target.id).subscribe(() => {
      this.friendAddedName = target.name;
      this.friendAddSuccess = true;
      // Заявка отправлена, но ещё не принята — помечаем именно этого
      // кандидата как 'pending' (не 'accepted'). Друзьями они станут
      // только после accept на стороне получателя (team.component.ts).
      this.friendSearchResults = this.friendSearchResults.map(r =>
        r.user.id === target.id ? { ...r, status: 'pending' as const } : r
      );
    });
  }

  getFriendInitials(name: string): string {
    if (!name) return '?';
    return name.trim().split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
  }
}

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { ProjectRepository } from '../../../domain/repositories/project.repository';
import { AuthService } from '../../../core/auth/auth.service';
import { UrgencyService, UrgencyLevel } from '../../../core/urgency/urgency.service';
import { Project } from '../../../domain/models/project.model';
import { Task } from '../../../domain/models/task.model';
import { User } from '../../../domain/models/user.model';
import { environment } from '../../../../environments/environment';

interface ProjectCard {
  project: Project;
  progress: number;
  totalTasks: number;
  doneTasks: number;
  memberInitials: string[];
}

@Component({
  selector: 'app-project-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './project-list.component.html',
  styleUrl: './project-list.component.scss',
})
export class ProjectListComponent implements OnInit {
  projectCards: ProjectCard[] = [];
  allTasks: Task[] = [];
  allUsers: User[] = [];
  currentUser: any = null;

  showModal = false;
  newProjectName = '';
  newProjectDescription = '';
  newProjectDueDate = '';
  searchQuery = '';
  activeFilter: 'all' | 'active' | 'archived' | 'done' = 'all';
  openMenuId: string | null = null;
  showCompletedProjects = false;
  showArchivedProjects = false;

  constructor(
    private projectRepo: ProjectRepository,
    private authService: AuthService,
    private urgencyService: UrgencyService,
    private router: Router,
    private http: HttpClient,
  ) {}

  ngOnInit() {
    this.currentUser = this.authService.getCurrentUser();
    if (!this.currentUser) return;

    this.http.get<Task[]>(`${environment.apiUrl}/tasks`).subscribe((t: Task[]) => {
      this.allTasks = t;
      this.buildCards();
    });

    this.http.get<User[]>(`${environment.apiUrl}/users`).subscribe((u: User[]) => {
      this.allUsers = u;
      this.buildCards();
    });

    this.projectRepo.getMine().subscribe((projects: Project[]) => {
      this.projectCards = projects.map((p) => ({
        project: p, progress: 0, totalTasks: 0, doneTasks: 0, memberInitials: [],
      }));
      this.buildCards();
    });
  }

  buildCards() {
    this.projectCards = this.projectCards.map((card) => {
      const tasks = this.allTasks.filter((t) => t.projectId === card.project.id);
      const done = tasks.filter((t) => t.status === 'done').length;
      const progress = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;
      const memberIds = [...new Set(tasks.map((t) => t.assignedUserId).filter(Boolean))];
      const memberInitials = memberIds.slice(0, 3).map((id) => {
        const u = this.allUsers.find((u) => u.id === id);
        return u ? u.name.slice(0, 2).toUpperCase() : '??';
      });
      return { ...card, progress, totalTasks: tasks.length, doneTasks: done, memberInitials };
    });
  }

  private matchesSearch(card: ProjectCard): boolean {
    return card.project.name.toLowerCase().includes(this.searchQuery.toLowerCase());
  }

  // ── Filtered card groups ──────────────────────────────────────────────────

  get activeCards(): ProjectCard[] {
    return this.projectCards.filter(
      (c) => this.matchesSearch(c) &&
             c.project.status === 'active' &&
             !this.isOverdue(c.project) &&
             (this.activeFilter === 'all' || this.activeFilter === 'active'),
    );
  }

  /**
   * Архив (Часть 3 ТЗ) — приостановленные ПРОЕКТЫ (status='paused') и
   * просроченные активные (dueDate в прошлом), в одной сворачиваемой секции.
   * Завершённые (status='completed') сюда не входят — это не архив,
   * а штатно закрытые проекты, у них своя секция (completedCards).
   */
  get archivedCards(): ProjectCard[] {
    return this.projectCards.filter(
      (c) => this.matchesSearch(c) &&
             c.project.status !== 'completed' &&
             (c.project.status === 'paused' || this.isOverdue(c.project)) &&
             (this.activeFilter === 'all' || this.activeFilter === 'archived'),
    );
  }

  get completedCards(): ProjectCard[] {
    return this.projectCards.filter(
      (c) => this.matchesSearch(c) &&
             c.project.status === 'completed' &&
             (this.activeFilter === 'all' || this.activeFilter === 'done'),
    );
  }

  get noResultsForSearch(): boolean {
    return (
      !!this.searchQuery &&
      this.activeCards.length === 0 &&
      this.archivedCards.length === 0 &&
      this.completedCards.length === 0
    );
  }

  trackByProjectId(_: number, card: ProjectCard): string { return card.project.id; }

  // ── Filter ────────────────────────────────────────────────────────────────

  setFilter(f: typeof this.activeFilter) {
    this.activeFilter = f;
    if (f === 'done')     this.showCompletedProjects = true;
    if (f === 'archived') this.showArchivedProjects = true;
  }

  toggleCompletedProjects() { this.showCompletedProjects = !this.showCompletedProjects; }
  toggleArchivedProjects()  { this.showArchivedProjects  = !this.showArchivedProjects; }

  // ── Urgency and shared projects (Part 2A / 2B of the spec) ─────────────────

  getUrgency(project: Project): UrgencyLevel | null {
    return this.urgencyService.getLevel(project.dueDate ?? null);
  }

  getUrgencyLabel(project: Project): string {
    return this.urgencyService.getLabel(project.dueDate ?? null);
  }

  isOverdue(project: Project): boolean {
    return this.getUrgency(project) === 'overdue';
  }

  /** A project where I'm not the owner — I'm just a member (shared project). */
  isShared(project: Project): boolean {
    return !!this.currentUser && project.ownerId !== this.currentUser.id;
  }

  /** Only the project owner can delete/pause it — members cannot. */
  isOwner(project: Project): boolean {
    return !!this.currentUser && project.ownerId === this.currentUser.id;
  }

  // ── Create project ────────────────────────────────────────────────────────

  openModal()  { this.showModal = true; }
  closeModal() {
    this.showModal = false;
    this.newProjectName = '';
    this.newProjectDescription = '';
    this.newProjectDueDate = '';
  }

  createProject() {
    if (!this.newProjectName.trim() || !this.currentUser) return;
    this.projectRepo
      .create({
        name: this.newProjectName.trim(),
        description: this.newProjectDescription.trim(),
        ownerId: this.currentUser.id,
        dueDate: this.newProjectDueDate || undefined,
        status: 'active',
      })
      .subscribe(() => { this.closeModal(); this.ngOnInit(); });
  }

  openProject(id: string) { this.router.navigate(['/app/projects', id]); }

  // ── 3-dot menu ────────────────────────────────────────────────────────────

  toggleMenu(id: string, event: Event) {
    event.stopPropagation();
    this.openMenuId = this.openMenuId === id ? null : id;
  }
  closeMenu() { this.openMenuId = null; }

  deleteProject(id: string, event: Event) {
    event.stopPropagation();
    this.openMenuId = null;
    if (!confirm('Delete this project? This cannot be undone.')) return;
    this.http.delete(`${environment.apiUrl}/projects/${id}`).subscribe(() => {
      this.projectCards = this.projectCards.filter((c) => c.project.id !== id);
    });
  }

  // ── Pause / Unpause ───────────────────────────────────────────────────────

  pauseProject(id: string, event: Event) {
    event.stopPropagation();
    this.openMenuId = null;
    if (!confirm('Pause this project? All task due dates will be cleared.')) return;

    this.http.patch<Project>(`${environment.apiUrl}/projects/${id}`, { status: 'paused' })
      .subscribe(() => {
        const card = this.projectCards.find((c) => c.project.id === id);
        if (card) card.project.status = 'paused';

        const projectTasks = this.allTasks.filter((t) => t.projectId === id);
        if (!projectTasks.length) return;

        forkJoin(
          projectTasks.map((task) =>
            this.http.patch(`${environment.apiUrl}/tasks/${task.id}`, { dueDate: null }),
          ),
        ).subscribe(() => {
          projectTasks.forEach((t) => (t.dueDate = null));
        });
      });
  }

  unpauseProject(id: string, event: Event) {
    event.stopPropagation();
    this.openMenuId = null;
    this.http.patch<Project>(`${environment.apiUrl}/projects/${id}`, { status: 'active' })
      .subscribe(() => {
        const card = this.projectCards.find((c) => c.project.id === id);
        if (card) card.project.status = 'active';
      });
  }
}

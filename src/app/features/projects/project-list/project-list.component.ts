import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { ProjectRepository } from '../../../domain/repositories/project.repository';
import { AuthService } from '../../../core/auth/auth.service';
import { Project } from '../../../domain/models/project.model';
import { Task } from '../../../domain/models/task.model';
import { User } from '../../../domain/models/user.model';

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
  activeFilter: 'all' | 'active' | 'paused' | 'done' = 'all';
  openMenuId: string | null = null;
  showCompletedProjects = false;
  showPausedProjects = false;

  constructor(
    private projectRepo: ProjectRepository,
    private authService: AuthService,
    private router: Router,
    private http: HttpClient,
  ) {}

  ngOnInit() {
    this.currentUser = this.authService.getCurrentUser();
    if (!this.currentUser) return;

    this.http.get<Task[]>('http://localhost:3000/tasks').subscribe((t: Task[]) => {
      this.allTasks = t;
      this.buildCards();
    });

    this.http.get<User[]>('http://localhost:3000/users').subscribe((u: User[]) => {
      this.allUsers = u;
      this.buildCards();
    });

    this.projectRepo.getByOwner(this.currentUser.id).subscribe((projects: Project[]) => {
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
             (this.activeFilter === 'all' || this.activeFilter === 'active'),
    );
  }

  get pausedCards(): ProjectCard[] {
    return this.projectCards.filter(
      (c) => this.matchesSearch(c) &&
             c.project.status === 'paused' &&
             (this.activeFilter === 'all' || this.activeFilter === 'paused'),
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
      this.pausedCards.length === 0 &&
      this.completedCards.length === 0
    );
  }

  trackByProjectId(_: number, card: ProjectCard): string { return card.project.id; }

  // ── Filter ────────────────────────────────────────────────────────────────

  setFilter(f: typeof this.activeFilter) {
    this.activeFilter = f;
    if (f === 'done')   this.showCompletedProjects = true;
    if (f === 'paused') this.showPausedProjects = true;
  }

  toggleCompletedProjects() { this.showCompletedProjects = !this.showCompletedProjects; }
  togglePausedProjects()    { this.showPausedProjects    = !this.showPausedProjects; }

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
    this.http.delete(`http://localhost:3000/projects/${id}`).subscribe(() => {
      this.projectCards = this.projectCards.filter((c) => c.project.id !== id);
    });
  }

  // ── Pause / Unpause ───────────────────────────────────────────────────────

  pauseProject(id: string, event: Event) {
    event.stopPropagation();
    this.openMenuId = null;
    if (!confirm('Pause this project? All task due dates will be cleared.')) return;

    this.http.patch<Project>(`http://localhost:3000/projects/${id}`, { status: 'paused' })
      .subscribe(() => {
        const card = this.projectCards.find((c) => c.project.id === id);
        if (card) card.project.status = 'paused';

        const projectTasks = this.allTasks.filter((t) => t.projectId === id);
        if (!projectTasks.length) return;

        forkJoin(
          projectTasks.map((task) =>
            this.http.patch(`http://localhost:3000/tasks/${task.id}`, { dueDate: null }),
          ),
        ).subscribe(() => {
          projectTasks.forEach((t) => (t.dueDate = null));
        });
      });
  }

  unpauseProject(id: string, event: Event) {
    event.stopPropagation();
    this.openMenuId = null;
    this.http.patch<Project>(`http://localhost:3000/projects/${id}`, { status: 'active' })
      .subscribe(() => {
        const card = this.projectCards.find((c) => c.project.id === id);
        if (card) card.project.status = 'active';
      });
  }
}

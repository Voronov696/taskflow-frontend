import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../core/auth/auth.service';
import { FriendshipService, FriendSearchResult, IncomingRequest } from '../../core/friendship/friendship.service';
import { User } from '../../domain/models/user.model';
import { Task } from '../../domain/models/task.model';
import { environment } from '../../../environments/environment';

interface FriendEntry {
  user: User;
  activeTasks: number;
  completedTasks: number;
}

@Component({
  selector: 'app-team',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './team.component.html',
  styleUrl: './team.component.scss',
})
export class TeamComponent implements OnInit {
  currentUser: User | null = null;
  friends: FriendEntry[] = [];
  incomingRequests: IncomingRequest[] = [];

  showSearchModal = false;
  searchQuery = '';
  searchResults: FriendSearchResult[] = [];
  isSearching = false;
  searchDone = false;
  addSuccess = false;
  addedName = '';

  copiedEmail: string | null = null;

  constructor(
    private authService: AuthService,
    private friendshipService: FriendshipService,
    private http: HttpClient,
    private translate: TranslateService,
  ) {}

  ngOnInit() {
    this.currentUser = this.authService.getCurrentUser();
    if (!this.currentUser) return;
    this.loadFriends();
    this.loadIncomingRequests();
  }

  loadFriends() {
    const userId = this.currentUser!.id;
    forkJoin({
      friends: this.friendshipService.getFriends(userId),
      tasks: this.http.get<Task[]>(`${environment.apiUrl}/tasks`),
    }).subscribe(({ friends, tasks }) => {
      this.friends = friends.map((user) => {
        const ut = tasks.filter((t) => t.assignedUserId === user.id);
        return {
          user,
          activeTasks: ut.filter((t) => t.status !== 'done').length,
          completedTasks: ut.filter((t) => t.status === 'done').length,
        };
      });
    });
  }

  loadIncomingRequests() {
    this.friendshipService.getIncomingRequests(this.currentUser!.id).subscribe((requests) => {
      this.incomingRequests = requests;
    });
  }

  acceptRequest(requestId: string, event: Event) {
    event.stopPropagation();
    this.friendshipService.acceptRequest(requestId).subscribe(() => {
      this.incomingRequests = this.incomingRequests.filter((r) => r.requestId !== requestId);
      // Только что принятая заявка стала дружбой — перечитываем список
      // друзей, чтобы отправитель сразу появился в members-grid.
      this.loadFriends();
    });
  }

  declineRequest(requestId: string, event: Event) {
    event.stopPropagation();
    this.friendshipService.declineRequest(requestId).subscribe(() => {
      this.incomingRequests = this.incomingRequests.filter((r) => r.requestId !== requestId);
    });
  }

  openSearchModal() {
    this.showSearchModal = true;
    this.resetSearch();
  }

  closeSearchModal() {
    this.showSearchModal = false;
    this.resetSearch();
  }

  resetSearch() {
    this.searchQuery = '';
    this.searchResults = [];
    this.isSearching = false;
    this.searchDone = false;
    this.addSuccess = false;
    this.addedName = '';
  }

  performSearch() {
    const q = this.searchQuery.trim();
    if (!q || !this.currentUser) return;
    this.isSearching = true;
    this.searchResults = [];
    this.searchDone = false;
    this.addSuccess = false;

    this.friendshipService.searchUsers(q, this.currentUser.id).subscribe({
      next: (results) => {
        this.searchResults = results;
        this.isSearching = false;
        this.searchDone = true;
      },
      error: () => {
        this.isSearching = false;
        this.searchDone = true;
      },
    });
  }

  onSearchKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') this.performSearch();
  }

  addFriend(target: User) {
    if (!this.currentUser) return;

    this.friendshipService.addFriend(this.currentUser.id, target.id).subscribe(() => {
      this.addedName = target.name;
      this.addSuccess = true;
      // Заявка отправлена, но ещё не принята — помечаем именно этого
      // кандидата как 'pending' (не 'accepted'), остальные результаты
      // списка не трогаем. Друзьями они станут только после accept
      // на стороне получателя.
      this.searchResults = this.searchResults.map(r =>
        r.user.id === target.id ? { ...r, status: 'pending' as const } : r
      );
    });
  }

  removeFriend(friendUserId: string, event: Event) {
    event.stopPropagation();
    if (!this.currentUser) return;
    if (!confirm(this.translate.instant('team.confirmRemove'))) return;

    this.friendshipService.removeFriend(this.currentUser.id, friendUserId).subscribe(() => {
      this.friends = this.friends.filter((f) => f.user.id !== friendUserId);
    });
  }

  getInitials(name: string): string {
    if (!name) return '?';
    return name.trim().split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
  }

  copyEmail(email: string, event: Event) {
    event.stopPropagation();
    navigator.clipboard.writeText(email).then(() => {
      this.copiedEmail = email;
      setTimeout(() => (this.copiedEmail = null), 2000);
    });
  }
}

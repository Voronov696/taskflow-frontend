import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { FriendshipService, FriendSearchResult } from '../../core/friendship/friendship.service';
import { User } from '../../domain/models/user.model';
import { Task } from '../../domain/models/task.model';

interface FriendEntry {
  user: User;
  activeTasks: number;
  completedTasks: number;
}

@Component({
  selector: 'app-team',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './team.component.html',
  styleUrl: './team.component.scss',
})
export class TeamComponent implements OnInit {
  currentUser: User | null = null;
  friends: FriendEntry[] = [];

  showSearchModal = false;
  searchQuery = '';
  searchResult: FriendSearchResult | null = null;
  isSearching = false;
  searchDone = false;
  addSuccess = false;
  addedName = '';

  copiedEmail: string | null = null;

  constructor(
    private authService: AuthService,
    private friendshipService: FriendshipService,
    private http: HttpClient,
  ) {}

  ngOnInit() {
    this.currentUser = this.authService.getCurrentUser();
    if (!this.currentUser) return;
    this.loadFriends();
  }

  loadFriends() {
    const userId = this.currentUser!.id;
    forkJoin({
      friends: this.friendshipService.getFriends(userId),
      tasks: this.http.get<Task[]>('http://localhost:3000/tasks'),
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
    this.searchResult = null;
    this.isSearching = false;
    this.searchDone = false;
    this.addSuccess = false;
    this.addedName = '';
  }

  performSearch() {
    const q = this.searchQuery.trim();
    if (!q || !this.currentUser) return;
    this.isSearching = true;
    this.searchResult = null;
    this.searchDone = false;
    this.addSuccess = false;

    this.friendshipService.searchUser(q, this.currentUser.id).subscribe({
      next: (result) => {
        this.searchResult = result;
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

  addFriend() {
    if (!this.searchResult || this.searchResult.alreadyFriend || !this.currentUser) return;
    const target = this.searchResult.user;

    this.friendshipService.addFriend(this.currentUser.id, target.id).subscribe(() => {
      this.addedName = target.name;
      this.addSuccess = true;
      this.searchResult = { ...this.searchResult!, alreadyFriend: true };
      this.loadFriends();
    });
  }

  removeFriend(friendUserId: string, event: Event) {
    event.stopPropagation();
    if (!this.currentUser) return;
    if (!confirm('Remove this person from your team?')) return;

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

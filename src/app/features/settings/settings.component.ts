import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/auth/auth.service';
import { User } from '../../domain/models/user.model';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent implements OnInit {
  currentUser: User | null = null;
  activeTab: 'profile' | 'appearance' | 'notifications' | 'security' | 'danger' = 'profile';

  editName = '';
  editEmail = '';
  editBirthday = '';
  hasUnsavedChanges = false;
  successMessage = '';
  errorMessage = '';

  accentColors = [
    { label: 'Purple', value: '#6c63ff' },
    { label: 'Blue',   value: '#3b82f6' },
    { label: 'Green',  value: '#10b981' },
    { label: 'Pink',   value: '#ec4899' },
  ];
  selectedAccent = '#6c63ff';

  notifications = {
    taskAssigned: true,
    projectUpdates: true,
    weeklySummary: false,
  };

  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  passwordError = '';
  passwordSuccess = '';

  showDeleteWarning = false;

  constructor(
    private authService: AuthService,
    private http: HttpClient
  ) {}

 ngOnInit() {
  this.currentUser = this.authService.getCurrentUser();
  if (this.currentUser) {
    this.editName     = this.currentUser.name;
    this.editEmail    = this.currentUser.email;
    this.editBirthday = (this.currentUser as any).birthday ?? '';
  }
  const saved = localStorage.getItem('accent');
  if (saved) {
    this.selectedAccent = saved;
    document.documentElement.style.setProperty('--accent', saved);
  }
  const notifs = localStorage.getItem('notifications');
  if (notifs) this.notifications = JSON.parse(notifs);
}

  get initials(): string {
    if (!this.currentUser?.name) return '?';
    return this.currentUser.name
      .split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
  }

  onProfileChange() {
    this.hasUnsavedChanges =
      this.editName !== this.currentUser?.name ||
      this.editEmail !== this.currentUser?.email ||
      this.editBirthday !== ((this.currentUser as any).birthday ?? '');
  }

  saveProfile() {
    if (!this.currentUser) return;
    if (!this.editName.trim() || !this.editEmail.trim()) {
      this.errorMessage = 'Name and email cannot be empty.';
      return;
    }

    const newEmail = this.editEmail.trim();
    const emailChanged = newEmail.toLowerCase() !== this.currentUser.email.toLowerCase();

    if (emailChanged) {
      this.authService.isEmailTaken(newEmail, this.currentUser.id).subscribe({
        next: (taken) => {
          if (taken) {
            this.errorMessage = 'That email is already used by another account.';
            return;
          }
          this.executeSaveProfile();
        },
        error: () => { this.errorMessage = 'Could not verify email uniqueness. Try again.'; }
      });
    } else {
      this.executeSaveProfile();
    }
  }

  private executeSaveProfile() {
    if (!this.currentUser) return;
    const updated = {
      ...this.currentUser,
      name: this.editName.trim(),
      email: this.editEmail.trim(),
      birthday: this.editBirthday.trim()
    };
    this.http.put<User>(
      `http://localhost:3000/users/${this.currentUser.id}`, updated
    ).subscribe({
      next: (user) => {
        localStorage.setItem('user', JSON.stringify(user));
        this.currentUser = user;
        this.hasUnsavedChanges = false;
        this.successMessage = 'Profile saved successfully.';
        this.errorMessage = '';
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: () => { this.errorMessage = 'Failed to save.'; }
    });
  }

  selectAccent(color: string) {
    this.selectedAccent = color;
    localStorage.setItem('accent', color);
    document.documentElement.style.setProperty('--accent', color);
  }

  saveNotifications() {
    localStorage.setItem('notifications', JSON.stringify(this.notifications));
    this.successMessage = 'Notification preferences saved.';
    setTimeout(() => this.successMessage = '', 3000);
  }

  changePassword() {
    this.passwordError = '';
    this.passwordSuccess = '';
    if (!this.currentPassword) {
      this.passwordError = 'Please enter your current password.'; return;
    }
    if (this.currentUser && this.currentPassword !== (this.currentUser as any).password) {
      this.passwordError = 'Current password is incorrect.'; return;
    }
    if (this.newPassword.length < 6) {
      this.passwordError = 'New password must be at least 6 characters.'; return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.passwordError = 'Passwords do not match.'; return;
    }
    const updated = { ...this.currentUser, password: this.newPassword };
    this.http.put<User>(
      `http://localhost:3000/users/${this.currentUser!.id}`, updated
    ).subscribe({
      next: (user) => {
        localStorage.setItem('user', JSON.stringify(user));
        this.currentUser = user;
        this.currentPassword = '';
        this.newPassword = '';
        this.confirmPassword = '';
        this.passwordSuccess = 'Password changed successfully.';
        setTimeout(() => this.passwordSuccess = '', 3000);
      },
      error: () => { this.passwordError = 'Failed to update password.'; }
    });
  }

  logout() {
    this.authService.logout();
    window.location.href = '/login';
  }
  confirmDelete() {
    if (!this.currentUser) return;
    this.http.delete(`http://localhost:3000/users/${this.currentUser.id}`)
      .subscribe({
        next: () => {
          this.authService.logout();
          window.location.href = '/register';
        },
        error: () => alert('Failed to delete account.')
      });
  }
}
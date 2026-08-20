import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../core/auth/auth.service';
import { LanguageService, AppLanguage } from '../../core/i18n/language.service';
import { User } from '../../domain/models/user.model';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
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

  currentLang: AppLanguage = 'en';

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
    private http: HttpClient,
    private languageService: LanguageService,
    private translate: TranslateService
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

  this.currentLang = this.languageService.getLanguage();
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
      this.errorMessage = this.translate.instant('settings.profile.errors.emptyFields');
      return;
    }

    const newEmail = this.editEmail.trim();
    const emailChanged = newEmail.toLowerCase() !== this.currentUser.email.toLowerCase();

    if (emailChanged) {
      this.authService.isEmailTaken(newEmail, this.currentUser.id).subscribe({
        next: (taken) => {
          if (taken) {
            this.errorMessage = this.translate.instant('settings.profile.errors.emailTaken');
            return;
          }
          this.executeSaveProfile();
        },
        error: () => { this.errorMessage = this.translate.instant('settings.profile.errors.emailCheckFailed'); }
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
      `${environment.apiUrl}/users/${this.currentUser.id}`, updated
    ).subscribe({
      next: (user) => {
        localStorage.setItem('user', JSON.stringify(user));
        this.currentUser = user;
        this.hasUnsavedChanges = false;
        this.successMessage = this.translate.instant('settings.profile.saveSuccess');
        this.errorMessage = '';
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: () => { this.errorMessage = this.translate.instant('settings.profile.errors.saveFailed'); }
    });
  }

  selectAccent(color: string) {
    this.selectedAccent = color;
    localStorage.setItem('accent', color);
    document.documentElement.style.setProperty('--accent', color);
  }

  selectLanguage(lang: AppLanguage) {
    this.currentLang = lang;
    this.languageService.setLanguage(lang);
  }

  saveNotifications() {
    localStorage.setItem('notifications', JSON.stringify(this.notifications));
    this.successMessage = this.translate.instant('settings.notifications.saveSuccess');
    setTimeout(() => this.successMessage = '', 3000);
  }

  changePassword() {
    this.passwordError = '';
    this.passwordSuccess = '';
    if (!this.currentPassword) {
      this.passwordError = this.translate.instant('settings.security.errors.currentRequired'); return;
    }
    if (this.newPassword.length < 6) {
      this.passwordError = this.translate.instant('settings.security.errors.tooShort'); return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.passwordError = this.translate.instant('settings.security.errors.mismatch'); return;
    }
    if (!this.currentUser) return;

    // Раньше текущий пароль сравнивался на клиенте с currentUser.password —
    // но бэкенд больше не присылает password в объекте юзера вообще, да и
    // сравнивать пароль в браузере небезопасно. Теперь используем отдельный
    // маршрут PUT /users/:id/password — сервер сам проверяет currentPassword
    // через bcrypt.compare с сохранённым хешем и меняет пароль одним запросом.
    this.http.put<User>(
      `${environment.apiUrl}/users/${this.currentUser.id}/password`,
      { currentPassword: this.currentPassword, newPassword: this.newPassword }
    ).subscribe({
      next: (user) => {
        localStorage.setItem('user', JSON.stringify(user));
        this.currentUser = user;
        this.currentPassword = '';
        this.newPassword = '';
        this.confirmPassword = '';
        this.passwordSuccess = this.translate.instant('settings.security.updateSuccess');
        setTimeout(() => this.passwordSuccess = '', 3000);
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 401) {
          this.passwordError = this.translate.instant('settings.security.errors.wrongCurrent');
        } else {
          this.passwordError = this.translate.instant('settings.security.errors.updateFailed');
        }
      }
    });
  }

  logout() {
    this.authService.logout();
    window.location.href = '/login';
  }
  confirmDelete() {
    if (!this.currentUser) return;
    this.http.delete(`${environment.apiUrl}/users/${this.currentUser.id}`)
      .subscribe({
        next: () => {
          this.authService.logout();
          window.location.href = '/register';
        },
        error: () => alert(this.translate.instant('settings.danger.deleteFailed'))
      });
  }
}
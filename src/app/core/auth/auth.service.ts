import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { User } from '../../domain/models/user.model';


@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = 'http://localhost:3000';
  private currentUser: User | null = null;

  constructor(private http: HttpClient) {}

  register(name: string, email: string, password: string): Observable<User> {
    const newUser: Omit<User, 'id'> = { name, email, password };
    return this.http.post<User>(`${this.apiUrl}/users`, newUser);
  }

  login(email: string, password: string): Observable<User | null> {
    return this.http.get<User[]>(`${this.apiUrl}/users`).pipe(
      map((users) => {
        const user = users.find(
          (u) => u.email === email && u.password === password,
        );
        if (user) {
          this.currentUser = user;
          localStorage.setItem('user', JSON.stringify(user));
          return user;
        }
        return null;
      }),
    );
  }
  logout(): void {
    this.currentUser = null;
    localStorage.removeItem('user');
  }

  getCurrentUser(): User | null {
    if (this.currentUser) return this.currentUser;
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  }

  isLoggedIn(): boolean {
    return this.getCurrentUser() !== null;
  }

  /**
   * Returns true if another account already uses this email.
   * Pass excludeId to skip the current user's own record (for profile edits).
   */
  isEmailTaken(email: string, excludeId?: string): Observable<boolean> {
    const lower = email.toLowerCase();
    return this.http.get<User[]>(`${this.apiUrl}/users`).pipe(
      map(users => users.some(u =>
        u.email.toLowerCase() === lower && u.id !== excludeId
      ))
    );
  }
}

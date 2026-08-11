import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { User } from '../../domain/models/user.model';
import { environment } from '../../../environments/environment';


@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = environment.apiUrl;
  private currentUser: User | null = null;

  constructor(private http: HttpClient) {}

  register(name: string, email: string, password: string): Observable<User> {
    const newUser: Omit<User, 'id'> = { name, email, password };
    return this.http.post<User>(`${this.apiUrl}/users`, newUser);
  }

  login(email: string, password: string): Observable<User | null> {
    // Раньше проверка email/пароля шла на клиенте (GET /users + find) —
    // теперь сервер сам ищет юзера и сравнивает пароль через bcrypt.
    // Сервер отдаёт не просто юзера, а { user, token }: токен кладём
    // в отдельный ключ localStorage, чтобы интерцептор мог подставлять
    // его в заголовок Authorization для защищённых маршрутов.
    return this.http
      .post<{ user: User; token: string }>(`${this.apiUrl}/login`, { email, password })
      .pipe(
        map((response) => {
          this.currentUser = response.user;
          localStorage.setItem('user', JSON.stringify(response.user));
          localStorage.setItem('token', response.token);
          return response.user;
        }),
        catchError((err: HttpErrorResponse) => {
          // 401 от сервера — это "неверный email или пароль", ожидаемый
          // результат неудачного логина, а не сбой запроса: превращаем его
          // в null, чтобы компонент логина обработал его так же, как раньше
          // обрабатывал "юзер не найден" через .find().
          if (err.status === 401) {
            return of(null);
          }
          // Любая другая ошибка (сеть, 500 и т.д.) — не наш случай,
          // пробрасываем дальше в error-колбэк подписки.
          return throwError(() => err);
        }),
      );
  }
  logout(): void {
    this.currentUser = null;
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  }

  getToken(): string | null {
    return localStorage.getItem('token');
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

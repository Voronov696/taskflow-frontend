import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Friendship } from '../models/friendship.model';
import { User } from '../models/user.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class FriendshipRepository {
  private api = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /** Records where the current user initiated the friendship. */
  getWhereSender(userId: string): Observable<Friendship[]> {
    return this.http.get<Friendship[]>(`${this.api}/friendships?userId=${userId}`);
  }

  /** Records where the current user was added by someone else. */
  getWhereReceiver(userId: string): Observable<Friendship[]> {
    return this.http.get<Friendship[]>(`${this.api}/friendships?friendId=${userId}`);
  }

  add(userId: string, friendId: string): Observable<Friendship> {
    return this.http.post<Friendship>(`${this.api}/friendships`, { userId, friendId });
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/friendships/${id}`);
  }

  /**
   * Client-side name search — fetches all users and filters locally.
   * json-server v1.x removed _like support, so server-side partial matching is unreliable.
   */
  searchByName(query: string): Observable<User[]> {
    const lower = query.toLowerCase();
    return this.http.get<User[]>(`${this.api}/users`).pipe(
      map(users => users.filter(u => u.name.toLowerCase().includes(lower)))
    );
  }

  /** Client-side email search — same reason as searchByName. */
  searchByEmail(query: string): Observable<User[]> {
    const lower = query.toLowerCase();
    return this.http.get<User[]>(`${this.api}/users`).pipe(
      map(users => users.filter(u => u.email.toLowerCase().includes(lower)))
    );
  }

  /**
   * Exact search by user id — GET /users/:id. Returns an array of 0 or 1
   * users so it slots into searchUser() the same way as searchByName/
   * searchByEmail (which also return arrays); a non-existent id gives a
   * 404 from the server, which the caller is expected to catch.
   */
  searchById(id: string): Observable<User[]> {
    return this.getUserById(id).pipe(map(user => [user]));
  }

  getUserById(id: string): Observable<User> {
    return this.http.get<User>(`${this.api}/users/${id}`);
  }
}

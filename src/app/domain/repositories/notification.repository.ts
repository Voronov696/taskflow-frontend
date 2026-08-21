import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Notification } from '../models/notification.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class NotificationRepository {
  private api = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /** Own notifications only (server derives user from the JWT) — unread first, newest first. */
  getMine(): Observable<Notification[]> {
    return this.http.get<Notification[]>(`${this.api}/notifications`);
  }

  markRead(id: string): Observable<Notification> {
    return this.http.patch<Notification>(`${this.api}/notifications/${id}/read`, {});
  }

  markAllRead(): Observable<void> {
    return this.http.patch<void>(`${this.api}/notifications/read-all`, {});
  }
}

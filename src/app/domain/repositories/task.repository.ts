import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Task } from '../models/task.model';

@Injectable({
  providedIn: 'root'
})
export class TaskRepository {
  private apiUrl = 'http://localhost:3000';

  constructor(private http: HttpClient) {}

  getByProject(projectId: string): Observable<Task[]> {
    return this.http.get<Task[]>(`${this.apiUrl}/tasks?projectId=${projectId}`);
  }

  getByUser(userId: string): Observable<Task[]> {
    return this.http.get<Task[]>(`${this.apiUrl}/tasks?assignedUserId=${userId}`);
  }

  create(task: Omit<Task, 'id'>): Observable<Task> {
    return this.http.post<Task>(`${this.apiUrl}/tasks`, task);
  }

  updateStatus(id: string, status: Task['status']): Observable<Task> {
    const d = new Date();
    const today = d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
    const completedAt = status === 'done' ? today : null;
    return this.http.patch<Task>(`${this.apiUrl}/tasks/${id}`, { status, completedAt });
  }

  update(id: string, changes: Partial<Omit<Task, 'id'>>): Observable<Task> {
    return this.http.patch<Task>(`${this.apiUrl}/tasks/${id}`, changes);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/tasks/${id}`);
  }
}
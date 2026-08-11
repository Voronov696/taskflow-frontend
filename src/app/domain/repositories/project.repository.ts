import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Project } from '../models/project.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ProjectRepository {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getByOwner(ownerId: string): Observable<Project[]> {
    return this.http.get<Project[]>(`${this.apiUrl}/projects?ownerId=${ownerId}`);
  }

  create(project: Omit<Project, 'id'>): Observable<Project> {
    return this.http.post<Project>(`${this.apiUrl}/projects`, project);
  }

  getById(id: string): Observable<Project> {
    return this.http.get<Project>(`${this.apiUrl}/projects/${id}`);
  }

  updateStatus(id: string, status: Project['status']): Observable<Project> {
    return this.http.patch<Project>(`${this.apiUrl}/projects/${id}`, { status });
  }
}
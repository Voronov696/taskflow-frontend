import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Member {
  id?: string;
  projectId: string;
  userId: string;
  role: 'owner' | 'member';
}

@Injectable({ providedIn: 'root' })
export class MemberRepository {
  private api = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getByProject(projectId: string): Observable<Member[]> {
    return this.http.get<Member[]>(`${this.api}/members?projectId=${projectId}`);
  }

  getByUser(userId: string): Observable<Member[]> {
    return this.http.get<Member[]>(`${this.api}/members?userId=${userId}`);
  }

  add(member: Omit<Member, 'id'>): Observable<Member> {
    return this.http.post<Member>(`${this.api}/members`, member);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/members/${id}`);
  }
}
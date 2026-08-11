import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Member {
  id?: string;
  projectId: string;
  userId: string;
  role: 'owner' | 'member';
}

@Injectable({ providedIn: 'root' })
export class MemberRepository {
  private api = 'http://localhost:3000';

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
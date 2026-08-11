import { Injectable } from '@angular/core';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { FriendshipRepository } from '../../domain/repositories/friendship.repository';
import { Friendship } from '../../domain/models/friendship.model';
import { User } from '../../domain/models/user.model';

export interface FriendSearchResult {
  user: User;
  alreadyFriend: boolean;
}

@Injectable({ providedIn: 'root' })
export class FriendshipService {

  constructor(private repo: FriendshipRepository) {}

  /**
   * Returns all friendship records involving this user (both directions merged).
   * One record is stored per pair; querying both sides gives the full picture.
   */
  getAllFriendships(userId: string): Observable<Friendship[]> {
    return forkJoin([
      this.repo.getWhereSender(userId),
      this.repo.getWhereReceiver(userId)
    ]).pipe(
      map(([sent, received]) => [...sent, ...received])
    );
  }

  /**
   * Returns the User objects for everyone who is friends with the given user.
   * Individual user fetches are used deliberately — never exposes the full list.
   */
  getFriends(userId: string): Observable<User[]> {
    return this.getAllFriendships(userId).pipe(
      switchMap(friendships => {
        if (friendships.length === 0) return of([]);
        const friendIds = friendships.map(f =>
          f.userId === userId ? f.friendId : f.userId
        );
        return forkJoin(
          friendIds.map(id =>
            this.repo.getUserById(id).pipe(catchError(() => of(null)))
          )
        ).pipe(
          map(users => users.filter((u): u is User => u !== null))
        );
      })
    );
  }

  /**
   * Searches for a user by exact name OR exact email.
   * Excludes the searching user themselves.
   * Returns the match plus whether they are already a friend.
   */
  searchUser(query: string, currentUserId: string): Observable<FriendSearchResult | null> {
    const trimmed = query.trim();
    if (!trimmed) return of(null);

    return forkJoin([
      this.repo.searchByName(trimmed).pipe(catchError(() => of([]))),
      this.repo.searchByEmail(trimmed).pipe(catchError(() => of([])))
    ]).pipe(
      switchMap(([byName, byEmail]) => {
        // Deduplicate by id, exclude self
        const seen = new Set<string>();
        const candidates = [...byName, ...byEmail].filter(u => {
          if (u.id === currentUserId) return false;
          if (seen.has(u.id)) return false;
          seen.add(u.id);
          return true;
        });

        const found = candidates[0] ?? null;
        if (!found) return of(null);

        return this.areFriends(currentUserId, found.id).pipe(
          map(alreadyFriend => ({ user: found, alreadyFriend }))
        );
      })
    );
  }

  /** Creates the friendship record (one direction stored, queried both ways). */
  addFriend(currentUserId: string, targetUserId: string): Observable<Friendship> {
    return this.repo.add(currentUserId, targetUserId);
  }

  /**
   * Finds the friendship record in either direction and deletes it.
   * Handles both "I added them" and "they added me" cases.
   */
  removeFriend(currentUserId: string, friendUserId: string): Observable<void> {
    return this.getAllFriendships(currentUserId).pipe(
      switchMap(friendships => {
        const record = friendships.find(f =>
          (f.userId === currentUserId && f.friendId === friendUserId) ||
          (f.userId === friendUserId  && f.friendId === currentUserId)
        );
        if (!record?.id) return of(undefined as void);
        return this.repo.remove(record.id);
      })
    );
  }

  /** Returns true if a friendship record exists in either direction. */
  areFriends(userId: string, otherId: string): Observable<boolean> {
    return this.getAllFriendships(userId).pipe(
      map(friendships => friendships.some(f =>
        (f.userId === userId  && f.friendId === otherId) ||
        (f.userId === otherId && f.friendId === userId)
      ))
    );
  }
}

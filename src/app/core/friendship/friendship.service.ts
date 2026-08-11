import { Injectable } from '@angular/core';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { FriendshipRepository } from '../../domain/repositories/friendship.repository';
import { Friendship } from '../../domain/models/friendship.model';
import { User } from '../../domain/models/user.model';

export interface FriendSearchResult {
  user: User;
  /** 'none' — can send a request. 'pending' — request already exists (either direction). 'accepted' — already friends. */
  status: 'none' | 'pending' | 'accepted';
}

export interface IncomingRequest {
  requestId: string;
  user: User;
}

@Injectable({ providedIn: 'root' })
export class FriendshipService {

  constructor(private repo: FriendshipRepository) {}

  /**
   * Returns all friendship records involving the current user, any status.
   * A single GET /friendships call — the server already scopes results to
   * the token's user and merges both directions itself (see server.js),
   * so there's no longer a "sender" and "receiver" call to combine here.
   * (Calling it twice with different query params used to double every
   * record, since the server ignores userId/friendId query filters now —
   * that was the actual cause of duplicate "Friend" cards.)
   */
  getAllFriendships(): Observable<Friendship[]> {
    return this.repo.getMine();
  }

  /**
   * Returns the User objects for everyone who is an ACCEPTED friend of the
   * given user. Pending (not yet accepted) requests are excluded — asking
   * the server to filter by status='accepted' directly, rather than
   * fetching everything and filtering client-side.
   */
  getFriends(userId: string): Observable<User[]> {
    return this.repo.getMine('accepted').pipe(
      switchMap(friendships => {
        if (friendships.length === 0) return of([]);
        // Set() guards against duplicates even if the same pair somehow
        // ended up with more than one accepted record.
        const friendIds = [...new Set(
          friendships.map(f => f.userId === userId ? f.friendId : f.userId)
        )];
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
   * Returns incoming friend requests — records where this user is the
   * recipient (friendId) and status is still 'pending' — with the sender's
   * User profile attached, ready for a "Friend requests" list with
   * Accept/Decline actions.
   */
  getIncomingRequests(userId: string): Observable<IncomingRequest[]> {
    return this.repo.getMine('pending').pipe(
      switchMap(requests => {
        const incoming = requests.filter(r => r.friendId === userId);
        if (incoming.length === 0) return of([]);
        return forkJoin(
          incoming.map(r =>
            this.repo.getUserById(r.userId).pipe(
              map(user => ({ requestId: r.id, user })),
              catchError(() => of(null))
            )
          )
        ).pipe(
          map(results => results.filter((r): r is IncomingRequest => r !== null))
        );
      })
    );
  }

  /**
   * Returns outgoing friend requests — records where this user is the
   * sender (userId) and status is still 'pending'. Used so the search
   * modal can show "Requested" instead of "Add" for someone already asked.
   */
  getOutgoingRequests(userId: string): Observable<Friendship[]> {
    return this.repo.getMine('pending').pipe(
      map(requests => requests.filter(r => r.userId === userId))
    );
  }

  /**
   * Searches for users by partial name OR partial email (case-insensitive
   * substring match — "te" matches "test", "Peter", etc.), plus an exact
   * User ID match. Excludes the searching user themselves and deduplicates
   * by id across all three sources.
   *
   * Friendship/request status is resolved with a SINGLE getAllFriendships()
   * call shared across every candidate, rather than a per-candidate check —
   * important once this can return many results instead of one.
   */
  searchUsers(query: string, currentUserId: string): Observable<FriendSearchResult[]> {
    const trimmed = query.trim();
    if (!trimmed) return of([]);

    return forkJoin([
      this.repo.searchByName(trimmed).pipe(catchError(() => of([]))),
      this.repo.searchByEmail(trimmed).pipe(catchError(() => of([]))),
      // Exact id match. GET /users/:id 404s when the id doesn't exist —
      // that's not a real search failure, just "no match this way",
      // so it's swallowed into an empty array like the other two sources.
      this.repo.searchById(trimmed).pipe(catchError(() => of([]))),
      this.getAllFriendships().pipe(catchError(() => of([])))
    ]).pipe(
      map(([byName, byEmail, byId, friendships]) => {
        // Deduplicate by id, exclude self
        const seen = new Set<string>();
        const candidates = [...byName, ...byEmail, ...byId].filter(u => {
          if (u.id === currentUserId) return false;
          if (seen.has(u.id)) return false;
          seen.add(u.id);
          return true;
        });

        // Map other-user-id → status, from every friendship record touching
        // currentUserId. 'accepted' wins over 'pending' if both somehow exist.
        const statusByUserId = new Map<string, 'pending' | 'accepted'>();
        for (const f of friendships) {
          const otherId = f.userId === currentUserId ? f.friendId : f.userId;
          if (f.status === 'accepted' || !statusByUserId.has(otherId)) {
            statusByUserId.set(otherId, f.status);
          }
        }

        return candidates.map(user => ({
          user,
          status: statusByUserId.get(user.id) ?? 'none',
        }));
      })
    );
  }

  /** Sends a friend request (server creates it as status='pending'). */
  addFriend(currentUserId: string, targetUserId: string): Observable<Friendship> {
    return this.repo.add(currentUserId, targetUserId);
  }

  /** Accepts a pending incoming request — recipient-only, enforced server-side. */
  acceptRequest(requestId: string): Observable<Friendship> {
    return this.repo.accept(requestId);
  }

  /** Declines a pending request (before acceptance) — same endpoint as removeFriend. */
  declineRequest(requestId: string): Observable<void> {
    return this.repo.remove(requestId);
  }

  /**
   * Finds the friendship record (any status, either direction) between the
   * two users and deletes it. Handles both "I added them" and "they added
   * me" cases, and both an accepted friendship and a still-pending request.
   */
  removeFriend(currentUserId: string, friendUserId: string): Observable<void> {
    return this.getAllFriendships().pipe(
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

  /** Returns true if an ACCEPTED friendship record exists in either direction. */
  areFriends(userId: string, otherId: string): Observable<boolean> {
    return this.getAllFriendships().pipe(
      map(friendships => friendships.some(f =>
        f.status === 'accepted' &&
        ((f.userId === userId  && f.friendId === otherId) ||
         (f.userId === otherId && f.friendId === userId))
      ))
    );
  }
}

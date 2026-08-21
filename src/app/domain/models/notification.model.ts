export type NotificationType = 'friend_request' | 'task_assigned' | 'task_completed';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  actorId: string | null;
  taskId: string | null;
  projectId: string | null;
  friendshipId: string | null;
  isRead: boolean;
  createdAt: string;
}

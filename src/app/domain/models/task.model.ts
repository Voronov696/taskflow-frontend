export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'done';
  projectId: string | null;
  assignedUserId: string;
  dueDate: string | null;
  /** ISO date (YYYY-MM-DD) set when status → 'done', cleared on un-complete. */
  completedAt?: string | null;
}
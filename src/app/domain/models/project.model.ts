export interface Project {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  dueDate?: string | null;
  status: 'active' | 'paused' | 'completed';
}
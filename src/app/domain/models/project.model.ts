export interface Project {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  dueDate?: string;
  status: 'active' | 'paused' | 'completed';
}
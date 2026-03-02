// Migration script to move V5 projects and priorities to V6
// Run this in the browser console or as a one-time script

import { setData, pushData } from '../lib/firebase';

interface V5Project {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'completed' | 'on-hold';
  progress?: number;
  tasksCompleted?: number;
  tasksTotal?: number;
  dueDate?: string;
  tags?: string[];
  tasks?: any[];
}

interface V5Priority {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in-progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  createdAt?: string;
}

export async function migrateV5ToV6() {
  console.log('Starting V5 to V6 migration...');
  
  // Fetch V5 data from Firebase
  const v5Projects = await fetchV5Data('data/projects');
  const v5Priorities = await fetchV5Data('data/priorities');
  
  console.log(`Found ${v5Projects.length} projects and ${v5Priorities.length} priorities in V5`);
  
  // Migrate projects to V6
  for (const project of v5Projects) {
    const v6Project = {
      ...project,
      tasks: project.tasks || [],
      tags: project.tags || [],
      progress: project.progress || 0,
      tasksCompleted: project.tasksCompleted || 0,
      tasksTotal: project.tasksTotal || 0,
    };
    
    await setData(`v6/data/projects/${project.id}`, v6Project);
    console.log(`Migrated project: ${project.name}`);
  }
  
  // Migrate priorities to V6 tasks
  for (const priority of v5Priorities) {
    const v6Task = {
      title: priority.title,
      priority: priority.priority || 'medium',
      status: mapStatus(priority.status),
      createdBy: 'user' as const,
      createdAt: priority.createdAt || new Date().toISOString(),
      tags: ['priority', 'migrated-from-v5'],
    };
    
    await pushData('v6/tasks/pending', v6Task);
    console.log(`Migrated priority as task: ${priority.title}`);
  }
  
  console.log('Migration complete!');
}

async function fetchV5Data(path: string): Promise<any[]> {
  // This would need to be implemented with your Firebase connection
  // For now, return empty array - you'll need to fetch from V5 manually
  console.log(`Fetching ${path} from V5...`);
  return [];
}

function mapStatus(v5Status: string): 'pending' | 'in-progress' | 'completed' {
  switch (v5Status) {
    case 'completed': return 'completed';
    case 'in-progress': return 'in-progress';
    case 'pending':
    default: return 'pending';
  }
}

// Manual migration helper - paste V5 data here and run
export async function migrateWithData(v5Projects: any[], v5Priorities: any[]) {
  console.log('Migrating with provided data...');
  
  for (const project of v5Projects) {
    await setData(`v6/data/projects/${project.id}`, {
      ...project,
      tasks: project.tasks || [],
      tags: project.tags || [],
    });
  }
  
  for (const priority of v5Priorities) {
    await pushData('v6/tasks/pending', {
      title: priority.title,
      priority: priority.priority || 'medium',
      status: mapStatus(priority.status),
      createdBy: 'user',
      createdAt: priority.createdAt || new Date().toISOString(),
      tags: ['priority', 'migrated-from-v5'],
    });
  }
  
  console.log('Migration complete!');
}
// Migration utility to import V5 data into V6
// Run this in browser console after loading V6

import { setData, pushData } from './firebase';

/**
 * Migrate V5 projects to V6
 * V5: { backlog: [], todo: [], inprogress: [], done: [] }
 * V6: Flat array with status field
 */
export async function migrateV5Projects(v5Projects: any) {
  console.log('Migrating V5 projects...');
  
  const allProjects: any[] = [];
  
  // Map V5 columns to V6 status
  const columnMap: Record<string, string> = {
    backlog: 'on-hold',
    todo: 'active',
    inprogress: 'active',
    done: 'completed'
  };
  
  // Process each column
  for (const [column, projects] of Object.entries(v5Projects)) {
    if (!Array.isArray(projects)) continue;
    
    for (const project of projects) {
      const v6Project = {
        id: project.id || Date.now().toString() + Math.random().toString(36).substr(2, 9),
        name: project.title || project.name || 'Untitled Project',
        description: project.description || project.notes || '',
        status: columnMap[column] || 'active',
        progress: project.progress || (column === 'done' ? 100 : 0),
        tasksCompleted: project.tasksCompleted || 0,
        tasksTotal: project.tasksTotal || 0,
        dueDate: project.dueDate || null,
        tags: project.tags || (project.board ? [project.board] : []),
        tasks: (project.tasks || []).map((t: any) => ({
          id: t.id || Date.now().toString(),
          title: t.title || t.text || 'Untitled Task',
          completed: t.completed || t.status === 'done' || false,
          priority: t.priority || 'medium'
        })),
        priority: project.priority || 'medium',
        board: project.board || null,
        assignee: project.assignee || null,
        createdAt: project.createdAt || new Date().toISOString(),
        updatedAt: project.updatedAt || new Date().toISOString(),
      };
      
      allProjects.push(v6Project);
      await setData(`v6/data/projects/${v6Project.id}`, v6Project);
    }
  }
  
  console.log(`Migrated ${allProjects.length} projects`);
  return allProjects;
}

/**
 * Migrate V5 priorities to V6 tasks
 * V5: Flat array with completed boolean
 * V6: Organized by status in Firebase
 */
export async function migrateV5Priorities(v5Priorities: any[]) {
  console.log('Migrating V5 priorities...');
  
  if (!Array.isArray(v5Priorities)) {
    console.error('v5Priorities must be an array');
    return [];
  }
  
  const migratedTasks: any[] = [];
  
  for (const priority of v5Priorities) {
    // Determine status
    let status: 'pending' | 'in-progress' | 'completed' = 'pending';
    if (priority.completed) {
      status = 'completed';
    } else if (priority.status === 'in-progress' || priority.status === 'doing') {
      status = 'in-progress';
    }
    
    const v6Task = {
      title: priority.title || priority.text || 'Untitled Task',
      priority: (priority.priority || 'medium').toLowerCase(),
      status,
      createdBy: priority.assignee || 'user',
      createdAt: priority.createdAt || priority.date || new Date().toISOString(),
      tags: [
        ...(priority.tags || []),
        'migrated-from-v5',
        ...(priority.board ? [priority.board] : [])
      ],
      dueDate: priority.dueDate || null,
      assignee: priority.assignee || null,
      description: priority.description || priority.notes || '',
    };
    
    // Save to appropriate column in V6
    const path = status === 'completed' ? 'v6/tasks/completed' : 
                 status === 'in-progress' ? 'v6/tasks/inProgress' : 
                 'v6/tasks/pending';
    
    const newRef = await pushData(path, v6Task);
    migratedTasks.push({ id: newRef.key, ...v6Task });
  }
  
  console.log(`Migrated ${migratedTasks.length} priorities as tasks`);
  return migratedTasks;
}

/**
 * Full migration - call this with V5 data
 */
export async function migrateV5ToV6(v5Data: {
  projects?: any;
  priorities?: any[];
  revenueHistory?: any;
  events?: any[];
  notes?: any[];
}) {
  console.log('Starting V5 to V6 migration...');
  
  const results: Record<string, any> = {};
  
  if (v5Data.projects) {
    results.projects = await migrateV5Projects(v5Data.projects);
  }
  
  if (v5Data.priorities) {
    results.priorities = await migrateV5Priorities(v5Data.priorities);
  }
  
  if (v5Data.revenueHistory) {
    await setData('v6/data/revenue', v5Data.revenueHistory);
    results.revenue = v5Data.revenueHistory;
  }
  
  if (v5Data.events) {
    for (const event of v5Data.events) {
      const id = event.id || Date.now().toString();
      await setData(`v6/data/events/${id}`, event);
    }
    results.events = v5Data.events.length;
  }
  
  if (v5Data.notes) {
    for (const note of v5Data.notes) {
      const id = note.id || Date.now().toString();
      await setData(`v6/data/notes/${id}`, note);
    }
    results.notes = v5Data.notes.length;
  }
  
  console.log('Migration complete!', results);
  return results;
}

/**
 * Export current V5 data from localStorage (if available)
 */
export function exportV5FromLocalStorage() {
  const v5Data: Record<string, any> = {};
  
  // Try to get V5 data from localStorage
  const projects = localStorage.getItem('mc_projects');
  const priorities = localStorage.getItem('mc_priorities');
  const revenue = localStorage.getItem('mc_revenue');
  
  if (projects) v5Data.projects = JSON.parse(projects);
  if (priorities) v5Data.priorities = JSON.parse(priorities);
  if (revenue) v5Data.revenueHistory = JSON.parse(revenue);
  
  console.log('V5 data from localStorage:', v5Data);
  return v5Data;
}

// Auto-run migration if V5 data exists in window
if (typeof window !== 'undefined' && (window as any).mcV5Data) {
  migrateV5ToV6((window as any).mcV5Data);
}
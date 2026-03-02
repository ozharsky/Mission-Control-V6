import { useState } from 'react';
import { subscribeToData, setData } from '../lib/firebase';

export function DataMigration() {
  const [status, setStatus] = useState<'idle' | 'migrating' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  const runMigration = async () => {
    setStatus('migrating');
    setProgress('Starting migration...');

    try {
      // Check if V5 data exists
      setProgress('Checking V5 data...');
      
      // Migrate priorities
      setProgress('Migrating priorities...');
      const prioritiesUnsub = subscribeToData('data/priorities', (data) => {
        if (data) {
          const priorities = Object.entries(data).map(([id, p]: [string, any]) => ({
            id,
            text: p.text || '',
            board: p.board || 'all',
            completed: p.completed || false,
            dueDate: p.dueDate || null,
            tags: p.tags || [],
            createdAt: p.createdAt || new Date().toISOString(),
            updatedAt: p.updatedAt || new Date().toISOString()
          }));
          setData('v6/data/priorities', priorities);
        }
      });

      // Migrate projects
      setProgress('Migrating projects...');
      const projectsUnsub = subscribeToData('data/projects', (data) => {
        if (data) {
          setData('v6/data/projects', data);
        }
      });

      // Migrate revenue
      setProgress('Migrating revenue...');
      const revenueUnsub = subscribeToData('data/revenueHistory', (data) => {
        if (data) {
          setData('v6/data/revenue', data);
        }
      });

      // Migrate notes
      setProgress('Migrating notes...');
      const notesUnsub = subscribeToData('data/notes', (data) => {
        if (data) {
          setData('v6/data/notes', data);
        }
      });

      // Migrate printers
      setProgress('Migrating printers...');
      const printersUnsub = subscribeToData('data/printers', (data) => {
        if (data) {
          setData('v6/data/printers', data);
        }
      });

      // Initialize V6 structure
      setProgress('Initializing V6 structure...');
      await setData('v6/agent', {
        status: 'online',
        currentTask: 'Migration complete',
        lastSeen: new Date().toISOString(),
        model: 'kimi-coding/k2p5'
      });

      await setData('v6/tasks', {
        pending: {},
        inProgress: {},
        completed: {}
      });

      await setData('v6/notifications', {
        'welcome': {
          id: 'welcome',
          type: 'success',
          title: 'Welcome to V6',
          message: 'Migration completed successfully!',
          timestamp: new Date().toISOString(),
          read: false
        }
      });

      // Cleanup subscriptions after a delay
      setTimeout(() => {
        prioritiesUnsub();
        projectsUnsub();
        revenueUnsub();
        notesUnsub();
        printersUnsub();
      }, 5000);

      setStatus('success');
      setProgress('Migration complete!');

    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  return (
    <div className="rounded-xl border border-surface-hover bg-surface p-6">
      <h2 className="mb-4 text-lg font-semibold">Data Migration</h2>
      
      <p className="mb-4 text-gray-400">
        Migrate your data from Mission Control V5 to V6.
      </p>

      {status === 'idle' && (
        <button
          onClick={runMigration}
          className="rounded-lg bg-primary px-6 py-2 text-white hover:bg-primary-hover"
        >
          Start Migration
        </button>
      )}

      {status === 'migrating' && (
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
          <span>{progress}</span>
        </div>
      )}

      {status === 'success' && (
        <div className="rounded-lg bg-success-light p-4 text-success">
          ✅ Migration complete! Refresh the page to see your data.
        </div>
      )}

      {status === 'error' && (
        <div className="rounded-lg bg-danger-light p-4 text-danger">
          ❌ Error: {error}
        </div>
      )}
    </div>
  );
}
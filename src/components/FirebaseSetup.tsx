import { useState } from 'react';
import { Rocket } from 'lucide-react';

interface FirebaseSetupProps {
  onConfigured: () => void;
}

export function FirebaseSetup({ onConfigured }: FirebaseSetupProps) {
  const [config, setConfig] = useState({
    apiKey: localStorage.getItem('mc_firebase_api_key') || '',
    authDomain: localStorage.getItem('mc_firebase_auth_domain') || '',
    databaseURL: localStorage.getItem('mc_firebase_url') || '',
    projectId: localStorage.getItem('mc_firebase_project_id') || '',
    storageBucket: localStorage.getItem('mc_firebase_storage_bucket') || '',
    messagingSenderId: localStorage.getItem('mc_firebase_messaging_sender_id') || '',
    appId: localStorage.getItem('mc_firebase_app_id') || ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Save to localStorage
    Object.entries(config).forEach(([key, value]) => {
      localStorage.setItem(`mc_firebase_${key === 'databaseURL' ? 'url' : key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)}`, value);
    });
    
    onConfigured();
    window.location.reload();
  };

  const handleChange = (field: string, value: string) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-xl border border-surface-hover bg-surface p-8">
        <div className="mb-6 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary">
            <Rocket className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold">Mission Control V6</h1>
          <p className="mt-2 text-gray-400">Configure Firebase to get started</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-gray-400">API Key</label>
            <input
              type="text"
              value={config.apiKey}
              onChange={(e) => handleChange('apiKey', e.target.value)}
              className="w-full rounded-lg border border-surface-hover bg-background px-4 py-2 text-white"
              placeholder="AIzaSy..."
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-gray-400">Database URL</label>
            <input
              type="text"
              value={config.databaseURL}
              onChange={(e) => handleChange('databaseURL', e.target.value)}
              className="w-full rounded-lg border border-surface-hover bg-background px-4 py-2 text-white"
              placeholder="https://...firebaseio.com"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-gray-400">Auth Domain</label>
            <input
              type="text"
              value={config.authDomain}
              onChange={(e) => handleChange('authDomain', e.target.value)}
              className="w-full rounded-lg border border-surface-hover bg-background px-4 py-2 text-white"
              placeholder="...firebaseapp.com"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-gray-400">Project ID</label>
            <input
              type="text"
              value={config.projectId}
              onChange={(e) => handleChange('projectId', e.target.value)}
              className="w-full rounded-lg border border-surface-hover bg-background px-4 py-2 text-white"
              placeholder="my-project"
            />
          </div>

          <button
            type="submit"
            className="min-h-[44px] w-full rounded-lg bg-primary py-3 font-medium text-white hover:bg-primary-hover"
          >
            Connect to Firebase
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          Your credentials are stored locally in your browser.
        </p>
      </div>
    </div>
  );
}
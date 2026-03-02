import { useState, useEffect } from 'react';

interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export function SettingsPage() {
  const [config, setConfig] = useState<FirebaseConfig>({
    apiKey: '',
    authDomain: '',
    databaseURL: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: ''
  });
  const [saved, setSaved] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    // Load existing config from localStorage
    setConfig({
      apiKey: localStorage.getItem('mc_firebase_api_key') || '',
      authDomain: localStorage.getItem('mc_firebase_auth_domain') || '',
      databaseURL: localStorage.getItem('mc_firebase_url') || '',
      projectId: localStorage.getItem('mc_firebase_project_id') || '',
      storageBucket: localStorage.getItem('mc_firebase_storage_bucket') || '',
      messagingSenderId: localStorage.getItem('mc_firebase_messaging_sender_id') || '',
      appId: localStorage.getItem('mc_firebase_app_id') || ''
    });
    
    setIsConfigured(!!localStorage.getItem('mc_firebase_url'));
  }, []);

  const handleSave = () => {
    localStorage.setItem('mc_firebase_api_key', config.apiKey);
    localStorage.setItem('mc_firebase_auth_domain', config.authDomain);
    localStorage.setItem('mc_firebase_url', config.databaseURL);
    localStorage.setItem('mc_firebase_project_id', config.projectId);
    localStorage.setItem('mc_firebase_storage_bucket', config.storageBucket);
    localStorage.setItem('mc_firebase_messaging_sender_id', config.messagingSenderId);
    localStorage.setItem('mc_firebase_app_id', config.appId);
    
    setSaved(true);
    setIsConfigured(true);
    setTimeout(() => setSaved(false), 3000);
    
    // Reload page to initialize Firebase with new config
    window.location.reload();
  };

  const handleClear = () => {
    localStorage.removeItem('mc_firebase_api_key');
    localStorage.removeItem('mc_firebase_auth_domain');
    localStorage.removeItem('mc_firebase_url');
    localStorage.removeItem('mc_firebase_project_id');
    localStorage.removeItem('mc_firebase_storage_bucket');
    localStorage.removeItem('mc_firebase_messaging_sender_id');
    localStorage.removeItem('mc_firebase_app_id');
    
    setConfig({
      apiKey: '',
      authDomain: '',
      databaseURL: '',
      projectId: '',
      storageBucket: '',
      messagingSenderId: '',
      appId: ''
    });
    setIsConfigured(false);
    window.location.reload();
  };

  return (
    <div className="rounded-xl border border-surface-hover bg-surface p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Settings</h2>
        <p className="mt-1 text-gray-400">Configure Firebase connection</p>
      </div>

      {isConfigured ? (
        <div className="mb-6 rounded-lg bg-success-light p-4 text-success">
          ✅ Firebase is configured and connected
        </div>
      ) : (
        <div className="mb-6 rounded-lg bg-warning-light p-4 text-warning">
          ⚠️ Firebase not configured - enter credentials below
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm text-gray-400">Database URL</label>
          <input
            type="text"
            value={config.databaseURL}
            onChange={(e) => setConfig({ ...config, databaseURL: e.target.value })}
            placeholder="https://your-project.firebaseio.com"
            className="w-full rounded-lg border border-surface-hover bg-background px-4 py-2 text-white placeholder-gray-600 focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-gray-400">API Key</label>
          <input
            type="text"
            value={config.apiKey}
            onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
            placeholder="AIzaSy..."
            className="w-full rounded-lg border border-surface-hover bg-background px-4 py-2 text-white placeholder-gray-600 focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-gray-400">Auth Domain</label>
          <input
            type="text"
            value={config.authDomain}
            onChange={(e) => setConfig({ ...config, authDomain: e.target.value })}
            placeholder="your-project.firebaseapp.com"
            className="w-full rounded-lg border border-surface-hover bg-background px-4 py-2 text-white placeholder-gray-600 focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-gray-400">Project ID</label>
          <input
            type="text"
            value={config.projectId}
            onChange={(e) => setConfig({ ...config, projectId: e.target.value })}
            placeholder="your-project"
            className="w-full rounded-lg border border-surface-hover bg-background px-4 py-2 text-white placeholder-gray-600 focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-gray-400">Storage Bucket</label>
          <input
            type="text"
            value={config.storageBucket}
            onChange={(e) => setConfig({ ...config, storageBucket: e.target.value })}
            placeholder="your-project.appspot.com"
            className="w-full rounded-lg border border-surface-hover bg-background px-4 py-2 text-white placeholder-gray-600 focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-gray-400">Messaging Sender ID</label>
          <input
            type="text"
            value={config.messagingSenderId}
            onChange={(e) => setConfig({ ...config, messagingSenderId: e.target.value })}
            placeholder="123456789"
            className="w-full rounded-lg border border-surface-hover bg-background px-4 py-2 text-white placeholder-gray-600 focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-gray-400">App ID</label>
          <input
            type="text"
            value={config.appId}
            onChange={(e) => setConfig({ ...config, appId: e.target.value })}
            placeholder="1:123456789:web:abcdef"
            className="w-full rounded-lg border border-surface-hover bg-background px-4 py-2 text-white placeholder-gray-600 focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <button
          onClick={handleSave}
          className="rounded-lg bg-primary px-6 py-2 font-medium text-white hover:bg-primary-hover"
        >
          {saved ? 'Saved!' : 'Save Settings'}
        </button>
        
        {isConfigured && (
          <button
            onClick={handleClear}
            className="rounded-lg border border-surface-hover px-6 py-2 font-medium text-gray-400 hover:bg-surface-hover"
          >
            Clear
          </button>
        )}
      </div>

      <div className="mt-6 rounded-lg bg-surface-hover p-4">
        <h3 className="mb-2 font-medium">How to get Firebase credentials:</h3>
        <ol className="list-decimal space-y-1 pl-4 text-sm text-gray-400">
          <li>Go to Firebase Console (console.firebase.google.com)</li>
          <li>Select your project</li>
          <li>Click the gear icon → Project settings</li>
          <li>Scroll to "Your apps" section</li>
          <li>Copy the firebaseConfig values</li>
        </ol>
      </div>
    </div>
  );
}
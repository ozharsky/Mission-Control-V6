import { useState, useEffect } from 'react';
import { SimplyPrintSettings } from './settings/SimplyPrintSettings';
import { DataMigration } from './DataMigration';
import { ActivityLog } from './ActivityLog';
import { History } from 'lucide-react';

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
  const [errors, setErrors] = useState<Partial<Record<keyof FirebaseConfig, string>>>({});

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

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof FirebaseConfig, string>> = {};
    
    if (!config.apiKey.trim()) newErrors.apiKey = 'API Key is required';
    if (!config.authDomain.trim()) newErrors.authDomain = 'Auth Domain is required';
    if (!config.databaseURL.trim()) newErrors.databaseURL = 'Database URL is required';
    if (!config.projectId.trim()) newErrors.projectId = 'Project ID is required';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    
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
    <div className="rounded-xl touch-feedback border border-surface-hover bg-surface p-6">
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
        {[
          { key: 'databaseURL', label: 'Database URL', placeholder: 'https://your-project.firebaseio.com' },
          { key: 'apiKey', label: 'API Key', placeholder: 'AIzaSy...' },
          { key: 'authDomain', label: 'Auth Domain', placeholder: 'your-project.firebaseapp.com' },
          { key: 'projectId', label: 'Project ID', placeholder: 'your-project' },
          { key: 'storageBucket', label: 'Storage Bucket', placeholder: 'your-project.appspot.com' },
          { key: 'messagingSenderId', label: 'Messaging Sender ID', placeholder: '123456789' },
          { key: 'appId', label: 'App ID', placeholder: '1:123456789:web:abcdef' },
        ].map(({ key, label, placeholder }) => (
          <div key={key}>
            <label className="mb-1 block text-sm text-gray-400">{label}</label>
            <input
              type="text"
              value={config[key as keyof FirebaseConfig]}
              onChange={(e) => {
                setConfig({ ...config, [key]: e.target.value });
                if (errors[key as keyof FirebaseConfig]) {
                  setErrors({ ...errors, [key]: undefined });
                }
              }}
              placeholder={placeholder}
              className={`w-full truncate rounded-lg border bg-background px-4 py-2 text-sm text-white placeholder-gray-600 focus:outline-none ${
                errors[key as keyof FirebaseConfig] 
                  ? 'border-danger focus:border-danger' 
                  : 'border-surface-hover focus:border-primary'
              }`}
            />
            {errors[key as keyof FirebaseConfig] && (
              <p className="mt-1 text-xs text-danger">{errors[key as keyof FirebaseConfig]}</p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          onClick={handleSave}
          className="min-h-[44px] rounded-lg bg-primary px-6 py-2 font-medium text-white hover:bg-primary-hover"
        >
          {saved ? 'Saved!' : 'Save Settings'}
        </button>
        
        {isConfigured && (
          <button
            onClick={handleClear}
            className="min-h-[44px] rounded-lg border border-surface-hover px-6 py-2 font-medium text-gray-400 hover:bg-surface-hover"
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

      <SimplyPrintSettings />

      <div className="mt-8 border-t border-surface-hover pt-8">
        <h3 className="mb-4 text-lg font-semibold">Data Management</h3>
        <DataMigration />
      </div>

      <div className="mt-8 border-t border-surface-hover pt-8">
        <div className="mb-4 flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Activity Log</h3>
        </div>
        <ActivityLog limit={20} />
      </div>
    </div>
  );
}
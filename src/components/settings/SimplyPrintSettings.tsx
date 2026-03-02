import { useState, useEffect } from 'react';
import { initSimplyPrint, getSimplyPrint, clearSimplyPrint, SimplyPrintPrinter } from '../../lib/simplyprint';
import { Loader2, RefreshCw, CheckCircle, XCircle } from 'lucide-react';

export function SimplyPrintSettings() {
  const [apiKey, setApiKey] = useState(localStorage.getItem('simplyprint_api_key') || '');
  const [proxyUrl, setProxyUrl] = useState(localStorage.getItem('simplyprint_proxy_url') || 'https://mission-control-fawn-eight.vercel.app/api/printers');
  const [isConnected, setIsConnected] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [printers, setPrinters] = useState<SimplyPrintPrinter[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const savedKey = localStorage.getItem('simplyprint_api_key');
    const savedProxy = localStorage.getItem('simplyprint_proxy_url');
    if (savedKey) {
      setApiKey(savedKey);
      if (savedProxy) setProxyUrl(savedProxy);
      initSimplyPrint(savedKey, savedProxy || undefined);
      setIsConnected(true);
      fetchPrinters();
    }
  }, []);

  const fetchPrinters = async () => {
    setIsLoading(true);
    const api = getSimplyPrint();
    if (api) {
      const printerList = await api.getPrinters();
      setPrinters(printerList);
    }
    setIsLoading(false);
  };

  const handleSave = () => {
    if (apiKey.trim()) {
      localStorage.setItem('simplyprint_api_key', apiKey);
      localStorage.setItem('simplyprint_proxy_url', proxyUrl);
      initSimplyPrint(apiKey, proxyUrl);
      setIsConnected(true);
      fetchPrinters();
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    
    try {
      const api = initSimplyPrint(apiKey, proxyUrl);
      const printerList = await api.getPrinters();
      
      if (printerList.length > 0) {
        setTestResult({
          success: true,
          message: `Connected! Found ${printerList.length} printer(s).`
        });
        setPrinters(printerList);
      } else {
        setTestResult({
          success: true,
          message: 'Connected! No printers found.'
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Connection failed. Check your API key and proxy URL.'
      });
    }
    
    setIsTesting(false);
  };

  const handleClear = () => {
    localStorage.removeItem('simplyprint_api_key');
    localStorage.removeItem('simplyprint_proxy_url');
    setApiKey('');
    clearSimplyPrint();
    setIsConnected(false);
    setPrinters([]);
    setTestResult(null);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-surface-hover bg-surface p-6">
        <h2 className="mb-4 text-xl font-semibold">SimplyPrint Integration</h2>
        
        <p className="mb-6 text-gray-400">
          Connect your SimplyPrint account to monitor your 3D printers in real-time.
        </p>

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your SimplyPrint API key"
              className="w-full rounded-xl border border-surface-hover bg-background px-4 py-3 text-white placeholder-gray-500 focus:border-primary focus:outline-none"
            />
            <p className="mt-2 text-xs text-gray-500">
              Find your API key in SimplyPrint → Settings → API
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Proxy URL (for CORS)</label>
            <input
              type="text"
              value={proxyUrl}
              onChange={(e) => setProxyUrl(e.target.value)}
              placeholder="https://your-app.vercel.app/api/simplyprint"
              className="w-full rounded-xl border border-surface-hover bg-background px-4 py-3 text-white placeholder-gray-500 focus:border-primary focus:outline-none"
            />
            <p className="mt-2 text-xs text-gray-500">
              Deploy the proxy from /api/simplyprint.js to Vercel
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleTest}
              disabled={!apiKey.trim() || isTesting}
              className="flex items-center gap-2 rounded-xl border border-surface-hover px-4 py-2 font-medium transition-colors hover:bg-surface-hover disabled:opacity-50"
            >
              {isTesting && <Loader2 className="h-4 w-4 animate-spin"></Loader2>}
              Test Connection
            </button>

            <button
              onClick={handleSave}
              disabled={!apiKey.trim()}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
            >
              Save
            </button>

            {isConnected && (
              <button
                onClick={handleClear}
                className="rounded-xl border border-danger/30 px-4 py-2 font-medium text-danger transition-colors hover:bg-danger/10"
              >
                Disconnect
              </button>
            )}
          </div>

          {testResult && (
            <div className={`rounded-xl p-4 ${testResult.success ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
              <div className="flex items-center gap-2">
                {testResult.success ? <CheckCircle className="h-5 w-5"></CheckCircle> : <XCircle className="h-5 w-5"></XCircle>}
                <span>{testResult.message}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {isConnected && (
        <div className="rounded-2xl border border-surface-hover bg-surface p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Connected Printers</h3>
            <button
              onClick={fetchPrinters}
              disabled={isLoading}
              className="flex items-center gap-2 rounded-lg border border-surface-hover px-3 py-1.5 text-sm hover:bg-surface-hover"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}></RefreshCw>
              Refresh
            </button>
          </div>

          {printers.length > 0 ? (
            <div className="space-y-3">
              {printers.map((printer) => (
                <div
                  key={printer.id}
                  className="flex items-center justify-between rounded-xl border border-surface-hover bg-background p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-3 w-3 rounded-full ${
                      printer.status === 'printing' ? 'bg-primary' :
                      printer.status === 'operational' || printer.status === 'idle' ? 'bg-success' :
                      printer.status === 'error' ? 'bg-danger' : 'bg-gray-500'
                    }`}></div>
                    <div>
                      <p className="font-medium">{printer.name}</p>
                      <p className="text-sm text-gray-500 capitalize">{printer.status}</p>
                    </div>
                  </div>
                  
                  {printer.progress !== undefined && printer.progress > 0 && (
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-24 overflow-hidden rounded-full bg-surface">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${printer.progress}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium">{printer.progress}%</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-gray-500">
              <p>No printers found in your SimplyPrint account.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
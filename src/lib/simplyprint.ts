// SimplyPrint API Integration for Mission Control V6
// Uses Vercel proxy to avoid CORS issues

interface SimplyPrintConfig {
  apiKey: string;
  proxyUrl?: string;
}

interface SimplyPrintPrinter {
  id: string;
  name: string;
  status: 'operational' | 'printing' | 'idle' | 'error' | 'offline';
  progress?: number;
  currentJob?: {
    name: string;
    timeLeft?: number;
    layer?: string;
  };
  temperature?: {
    nozzle: number;
    targetNozzle?: number;
    bed: number;
    targetBed?: number;
  };
  lastSeen?: string;
}

class SimplyPrintAPI {
  private apiKey: string;
  private proxyUrl: string;

  constructor(config: SimplyPrintConfig) {
    this.apiKey = config.apiKey;
    // Use Vercel proxy or fallback to direct (for local dev with CORS extension)
    this.proxyUrl = config.proxyUrl || 'https://your-vercel-app.vercel.app/api/simplyprint';
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${this.proxyUrl}?path=${encodeURIComponent(endpoint.replace(/^\//, ''))}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`SimplyPrint API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getPrinters(): Promise<SimplyPrintPrinter[]> {
    try {
      const data = await this.request('printers');
      return data.printers || [];
    } catch (error) {
      console.error('Failed to fetch printers:', error);
      return [];
    }
  }

  async getPrinterStatus(printerId: string): Promise<SimplyPrintPrinter | null> {
    try {
      const data = await this.request(`printers/${printerId}/status`);
      return data;
    } catch (error) {
      console.error(`Failed to fetch printer ${printerId} status:`, error);
      return null;
    }
  }

  async startPrint(printerId: string, fileId: string): Promise<boolean> {
    try {
      await this.request(`printers/${printerId}/print`, {
        method: 'POST',
        body: JSON.stringify({ file_id: fileId }),
      });
      return true;
    } catch (error) {
      console.error('Failed to start print:', error);
      return false;
    }
  }

  async pausePrint(printerId: string): Promise<boolean> {
    try {
      await this.request(`printers/${printerId}/pause`, { method: 'POST' });
      return true;
    } catch (error) {
      console.error('Failed to pause print:', error);
      return false;
    }
  }

  async cancelPrint(printerId: string): Promise<boolean> {
    try {
      await this.request(`printers/${printerId}/cancel`, { method: 'POST' });
      return true;
    } catch (error) {
      console.error('Failed to cancel print:', error);
      return false;
    }
  }

  async getFiles(printerId: string): Promise<any[]> {
    try {
      const data = await this.request(`printers/${printerId}/files`);
      return data.files || [];
    } catch (error) {
      console.error('Failed to fetch files:', error);
      return [];
    }
  }
}

// Create singleton instance
let simplyPrintInstance: SimplyPrintAPI | null = null;

export function initSimplyPrint(apiKey: string, proxyUrl?: string) {
  simplyPrintInstance = new SimplyPrintAPI({ apiKey, proxyUrl });
  return simplyPrintInstance;
}

export function getSimplyPrint(): SimplyPrintAPI | null {
  return simplyPrintInstance;
}

export function clearSimplyPrint() {
  simplyPrintInstance = null;
}

export type { SimplyPrintPrinter, SimplyPrintConfig };
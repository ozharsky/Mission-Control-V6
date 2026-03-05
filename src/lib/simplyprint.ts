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
    // Use V5 proxy by default, ensure https:// protocol
    let url = config.proxyUrl || 'https://mission-control-fawn-eight.vercel.app/api/printers';
    if (!url.startsWith('http')) {
      url = 'https://' + url;
    }
    this.proxyUrl = url;
  }

  private async request(action: string, params: Record<string, any> = {}) {
    const url = `${this.proxyUrl}?action=${action}${Object.entries(params).map(([k, v]) => `&${k}=${encodeURIComponent(v)}`).join('')}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`SimplyPrint API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getPrinters(): Promise<SimplyPrintPrinter[]> {
    try {
      const data = await this.request('get_printers');
      return data.printers || data.data || [];
    } catch (error) {
      return [];
    }
  }

  async getPrinterStatus(printerId: string): Promise<SimplyPrintPrinter | null> {
    try {
      const data = await this.request('get_printer', { printer_id: printerId });
      return data.printer || data.data || null;
    } catch (error) {
      return null;
    }
  }

  async startPrint(printerId: string, fileId: string): Promise<boolean> {
    try {
      await this.request('start_print', { printer_id: printerId, file_id: fileId });
      return true;
    } catch (error) {
      return false;
    }
  }

  async pausePrint(printerId: string): Promise<boolean> {
    try {
      await this.request('pause_print', { printer_id: printerId });
      return true;
    } catch (error) {
      return false;
    }
  }

  async cancelPrint(printerId: string): Promise<boolean> {
    try {
      await this.request('cancel_print', { printer_id: printerId });
      return true;
    } catch (error) {
      return false;
    }
  }

  async getFiles(printerId: string): Promise<any[]> {
    try {
      const data = await this.request('get_files', { printer_id: printerId });
      return data.files || data.data || [];
    } catch (error) {
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
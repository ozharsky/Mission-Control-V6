// CSV parsing utilities for Mission Control V6

export interface ParsedCSVRow {
  [key: string]: string;
}

export interface EtsyOrder {
  date: string;  // YYYY-MM
  orderId: string;
  items: number;
  value: number;
  net: number;
}

export function parseCSV(text: string): ParsedCSVRow[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const rows: ParsedCSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: ParsedCSVRow = {};
    headers.forEach((header, index) => {
      row[header.trim()] = values[index]?.trim() || '';
    });
    rows.push(row);
  }

  return rows;
}

function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

function parseEtsyDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  const parts = dateStr.trim().split('/');
  if (parts.length !== 3) return null;

  let month = parseInt(parts[0]);
  let day = parseInt(parts[1]);
  let year = parseInt(parts[2]);

  if (year < 100) {
    year = 2000 + year;
  }

  const date = new Date(year, month - 1, day);
  if (isNaN(date.getTime())) return null;

  return date;
}

export function parseEtsyCSV(csvText: string): EtsyOrder[] {
  const rows = parseCSV(csvText);
  console.log('Parsed CSV rows:', rows.length);
  
  if (rows.length === 0) {
    console.log('No rows found in CSV');
    return [];
  }

  // Log first row to see column names
  console.log('First row columns:', Object.keys(rows[0]));
  console.log('First row sample:', rows[0]);

  const results: EtsyOrder[] = [];

  rows.forEach((row, idx) => {
    // Try to find date column - check multiple possible names
    const dateStr = row['Sale Date'] || row['Date'] || row['date'] || row['SaleDate'];
    
    if (!dateStr) {
      console.log(`Row ${idx}: No date found`, row);
      return;
    }

    const date = parseEtsyDate(dateStr);
    if (!date) {
      console.log(`Row ${idx}: Could not parse date: ${dateStr}`);
      return;
    }

    // Try to find order value - check multiple possible column names
    let orderValue = 0;
    const orderValueStr = row['Order Net'] || row['Order Value'] || row['Order Total'] || row['Net'] || row['Total'];
    
    if (orderValueStr) {
      // Remove $ and commas, then parse
      const cleanValue = orderValueStr.replace(/[$,]/g, '');
      orderValue = parseFloat(cleanValue);
    }

    // Try to find number of items
    let items = 1;
    const itemsStr = row['Number of Items'] || row['Items'] || row['Quantity'] || row['Item Count'];
    if (itemsStr) {
      items = parseInt(itemsStr) || 1;
    }

    // Format date as YYYY-MM
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const formattedDate = `${year}-${month}`;

    results.push({
      date: formattedDate,
      orderId: row['Order ID'] || row['OrderID'] || row['OrderId'] || '',
      items,
      value: orderValue,
      net: orderValue,
    });
  });

  console.log('Successfully parsed orders:', results.length);
  return results;
}

export function aggregateRevenueByMonth(orders: EtsyOrder[]): { month: string; value: number; orders: number }[] {
  const monthly: Record<string, { value: number; orders: number }> = {};

  orders.forEach((order) => {
    if (!monthly[order.date]) {
      monthly[order.date] = { value: 0, orders: 0 };
    }
    monthly[order.date].value += order.value;
    monthly[order.date].orders += 1;
  });

  return Object.entries(monthly)
    .map(([month, data]) => ({ month, ...data }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
}

export function downloadTemplate(type: 'revenue' | 'etsy'): void {
  let content = '';
  let filename = '';

  if (type === 'revenue') {
    content = 'Month,Revenue,Orders\n2026-01,500.00,15\n2026-02,750.00,22\n2026-03,600.00,18';
    filename = 'revenue-template.csv';
  } else if (type === 'etsy') {
    content = 'Sale Date,Order ID,Number of Items,Order Value\n01/15/26,1234567890,2,$45.00\n01/20/26,1234567891,1,$25.00\n02/05/26,1234567892,3,$75.00';
    filename = 'etsy-orders-template.csv';
  }

  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Export data as JSON
export function exportToJSON(data: any, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  downloadFile(json, filename, 'application/json');
}

// Export as CSV
export function exportToCSV(data: any[], filename: string): void {
  if (!data || data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csv = [
    headers.join(','),
    ...data.map(row => headers.map(h => {
      const val = row[h]?.toString() || '';
      if (val.includes(',') || val.includes('"')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    }).join(','))
  ].join('\n');

  downloadFile(csv, filename, 'text/csv');
}

function downloadFile(content: string, filename: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
// Inventory types for Mission Control V6

export type InventoryCategory = 'product' | 'material' | 'tool' | 'supply';
export type InventoryStatus = 'in-stock' | 'low-stock' | 'out-of-stock' | 'discontinued';

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  description: string;
  category: InventoryCategory;
  status: InventoryStatus;
  quantity: number;
  minStock: number; // Alert when below this
  maxStock: number; // Ideal stock level
  unitCost: number;
  sellingPrice?: number;
  location?: string; // Where it's stored
  supplier?: string;
  supplierUrl?: string;
  tags: string[];
  images: string[];
  notes: string;
  
  // For products
  materials?: string[]; // IDs of materials used
  printTime?: number; // Minutes
  weight?: number; // Grams
  
  // Tracking
  lastRestocked?: string;
  lastSold?: string;
  totalSold: number;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}

export interface InventoryTransaction {
  id: string;
  itemId: string;
  type: 'in' | 'out' | 'adjustment';
  quantity: number;
  reason: string;
  notes: string;
  date: string;
  cost?: number;
}

export interface InventoryFilter {
  category?: InventoryCategory | 'all';
  status?: InventoryStatus | 'all';
  search?: string;
  lowStock?: boolean;
}

export const CATEGORY_LABELS: Record<InventoryCategory, string> = {
  product: 'Product',
  material: 'Material',
  tool: 'Tool',
  supply: 'Supply',
};

export const CATEGORY_COLORS: Record<InventoryCategory, string> = {
  product: 'bg-blue-500/20 text-blue-400',
  material: 'bg-orange-500/20 text-orange-400',
  tool: 'bg-purple-500/20 text-purple-400',
  supply: 'bg-gray-700 text-gray-400',
};

export const STATUS_LABELS: Record<InventoryStatus, string> = {
  'in-stock': 'In Stock',
  'low-stock': 'Low Stock',
  'out-of-stock': 'Out of Stock',
  'discontinued': 'Discontinued',
};

export const STATUS_COLORS: Record<InventoryStatus, string> = {
  'in-stock': 'bg-success/20 text-success border-success/30',
  'low-stock': 'bg-warning/20 text-warning border-warning/30',
  'out-of-stock': 'bg-danger/20 text-danger border-danger/30',
  'discontinued': 'bg-gray-700 text-gray-400 border-gray-600',
};
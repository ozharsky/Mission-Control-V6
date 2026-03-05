import { useState, useMemo } from 'react';
import { 
  Package, Plus, Search, Filter, Download, Upload, 
  AlertTriangle, Archive, Edit2, Trash2, ChevronDown, 
  ChevronUp, Minus, Plus as PlusIcon, History, DollarSign,
  Box, Wrench, Droplets, Tag, X, FileSpreadsheet
} from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { LoadingButton } from '../components/Loading';
import type { InventoryItem, InventoryTransaction, InventoryCategory, InventoryStatus } from '../types/inventory';
import { 
  CATEGORY_LABELS, 
  CATEGORY_COLORS, 
  STATUS_LABELS, 
  STATUS_COLORS 
} from '../types/inventory';

interface InventoryViewProps {
  items: InventoryItem[];
}

export function InventoryView({ items }: InventoryViewProps) {
  const { addInventoryItem, updateInventoryItem, deleteInventoryItem, addInventoryTransaction } = useAppStore();
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<InventoryCategory | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<InventoryStatus | 'all'>('all');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState('');
  const [adjustQuantity, setAdjustQuantity] = useState<{itemId: string, amount: number, reason: string} | null>(null);

  const [formData, setFormData] = useState<Partial<InventoryItem>>({
    sku: '',
    name: '',
    description: '',
    category: 'product',
    status: 'in-stock',
    quantity: 0,
    minStock: 5,
    maxStock: 50,
    unitCost: 0,
    sellingPrice: 0,
    location: '',
    supplier: '',
    supplierUrl: '',
    tags: [],
    notes: '',
    printTime: 0,
    weight: 0,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter items
  const filteredItems = useMemo(() => {
    let result = [...items];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(item => 
        item.name.toLowerCase().includes(query) ||
        item.sku.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    if (filterCategory !== 'all') {
      result = result.filter(item => item.category === filterCategory);
    }

    if (filterStatus !== 'all') {
      result = result.filter(item => item.status === filterStatus);
    }

    if (showLowStockOnly) {
      result = result.filter(item => item.quantity <= item.minStock);
    }

    return result;
  }, [items, searchQuery, filterCategory, filterStatus, showLowStockOnly]);

  // Stats
  const stats = useMemo(() => {
    const totalValue = items.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0);
    const lowStock = items.filter(item => item.quantity <= item.minStock && item.status !== 'discontinued').length;
    const outOfStock = items.filter(item => item.status === 'out-of-stock').length;
    
    return {
      total: items.length,
      totalValue,
      lowStock,
      outOfStock,
      products: items.filter(i => i.category === 'product').length,
      materials: items.filter(i => i.category === 'material').length,
    };
  }, [items]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.sku || !formData.name) return;

    const itemData: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt' | 'totalSold'> = {
      sku: formData.sku,
      name: formData.name,
      description: formData.description || '',
      category: formData.category || 'product',
      status: formData.status || 'in-stock',
      quantity: formData.quantity || 0,
      minStock: formData.minStock || 5,
      maxStock: formData.maxStock || 50,
      unitCost: formData.unitCost || 0,
      sellingPrice: formData.sellingPrice,
      location: formData.location,
      supplier: formData.supplier,
      supplierUrl: formData.supplierUrl,
      tags: formData.tags || [],
      images: [],
      notes: formData.notes || '',
      materials: formData.materials,
      printTime: formData.printTime,
      weight: formData.weight,
    };

    setIsSubmitting(true);
    try {
      if (editingItem) {
        await updateInventoryItem(editingItem.id, itemData);
      } else {
        await addInventoryItem(itemData);
      }
      resetForm();
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      sku: '',
      name: '',
      description: '',
      category: 'product',
      status: 'in-stock',
      quantity: 0,
      minStock: 5,
      maxStock: 50,
      unitCost: 0,
      sellingPrice: 0,
      location: '',
      supplier: '',
      supplierUrl: '',
      tags: [],
      notes: '',
      printTime: 0,
      weight: 0,
    });
    setEditingItem(null);
    setShowForm(false);
  };

  const openEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData(item);
    setShowForm(true);
  };

  const handleQuickAdjust = async () => {
    if (!adjustQuantity) return;
    
    const item = items.find(i => i.id === adjustQuantity.itemId);
    if (!item) return;

    const newQuantity = Math.max(0, item.quantity + adjustQuantity.amount);
    
    await updateInventoryItem(item.id, { quantity: newQuantity });
    await addInventoryTransaction({
      itemId: item.id,
      type: adjustQuantity.amount > 0 ? 'in' : 'out',
      quantity: Math.abs(adjustQuantity.amount),
      reason: adjustQuantity.reason,
      notes: '',
      date: new Date().toISOString(),
    });

    setAdjustQuantity(null);
  };

  const handleExport = () => {
    const exportData = items.map(item => ({
      sku: item.sku,
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      unitCost: item.unitCost,
      sellingPrice: item.sellingPrice,
      status: item.status,
      location: item.location,
    }));
    
    const csv = [
      'SKU,Name,Category,Quantity,Unit Cost,Selling Price,Status,Location',
      ...exportData.map(row => 
        `${row.sku},${row.name},${row.category},${row.quantity},${row.unitCost},${row.sellingPrice || ''},${row.status},${row.location || ''}`
      )
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const handleImport = async () => {
    try {
      const lines = importData.trim().split('\n');
      const headers = lines[0].split(',');
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        const row: any = {};
        headers.forEach((h, idx) => row[h.trim()] = values[idx]?.trim());
        
        await addInventoryItem({
          sku: row.SKU || row.sku,
          name: row.Name || row.name,
          category: (row.Category || row.category || 'product') as InventoryCategory,
          quantity: parseInt(row.Quantity || row.quantity) || 0,
          unitCost: parseFloat(row['Unit Cost'] || row.unitCost) || 0,
          sellingPrice: parseFloat(row['Selling Price'] || row.sellingPrice) || undefined,
          status: (row.Status || row.status || 'in-stock') as InventoryStatus,
          location: row.Location || row.location,
          description: '',
          minStock: 5,
          maxStock: 50,
          tags: [],
          images: [],
          notes: 'Imported from CSV',
        });
      }
      
      setImportData('');
      setShowImportModal(false);
      alert('Import complete!');
    } catch (err) {
      alert('Import failed: ' + (err as Error).message);
    }
  };

  const getStockProgress = (item: InventoryItem) => {
    if (item.maxStock === 0) return 0;
    return Math.min(100, (item.quantity / item.maxStock) * 100);
  };

  const getStockColor = (item: InventoryItem) => {
    if (item.quantity === 0) return 'bg-danger';
    if (item.quantity <= item.minStock) return 'bg-warning';
    return 'bg-success';
  };

  return (
    <div className="space-y-4 max-w-full overflow-x-hidden">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: 'Total Items', value: stats.total, color: 'bg-primary/10 text-primary' },
          { label: 'Inventory Value', value: `$${stats.totalValue.toFixed(2)}`, color: 'bg-green-500/10 text-green-400' },
          { label: 'Low Stock', value: stats.lowStock, color: 'bg-warning/10 text-warning' },
          { label: 'Out of Stock', value: stats.outOfStock, color: 'bg-danger/10 text-danger' },
        ].map(stat => (
          <div key={stat.label} className={`rounded-xl border border-surface-hover p-4 ${stat.color}`}>
            <div className="text-2xl font-bold">{stat.value}</div>
            <div className="text-sm opacity-80">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Filters and Actions */}
      <div className="rounded-xl border border-surface-hover bg-surface p-4">
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
          <div className="flex-1 min-w-0 w-full min-w-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by SKU, name, or tag..."
                className="w-full rounded-lg border border-surface-hover bg-background pl-10 pr-4 py-2 text-white"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as InventoryCategory | 'all')}
              className="rounded-lg border border-surface-hover bg-background px-3 py-2 text-white shrink-0"
            >
              <option value="all">All Categories</option>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as InventoryStatus | 'all')}
              className="rounded-lg border border-surface-hover bg-background px-3 py-2 text-white shrink-0"
            >
              <option value="all">All Status</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>

            <button
              onClick={() => setShowLowStockOnly(!showLowStockOnly)}
              className={`flex min-h-[44px] items-center gap-2 rounded-lg px-3 py-2 shrink-0 ${showLowStockOnly ? 'bg-warning text-white' : 'border border-surface-hover text-gray-400'}`}
            >
              <AlertTriangle className="h-4 w-4" />
              Low Stock
            </button>

            <button
              onClick={handleExport}
              className="flex min-h-[44px] items-center gap-2 rounded-lg border border-surface-hover px-3 py-2 text-gray-400 hover:bg-surface-hover shrink-0"
            >
              <Download className="h-4 w-4" />
              Export
            </button>

            <button
              onClick={() => setShowImportModal(true)}
              className="flex min-h-[44px] items-center gap-2 rounded-lg border border-surface-hover px-3 py-2 text-gray-400 hover:bg-surface-hover shrink-0"
            >
              <Upload className="h-4 w-4" />
              Import
            </button>

            <button
              onClick={() => setShowForm(true)}
              className="flex min-h-[44px] items-center gap-2 rounded-lg bg-primary px-4 py-2 text-white shrink-0"
            >
              <Plus className="h-4 w-4" />
              Add Item
            </button>
          </div>
        </div>
      </div>

      {/* Items List */}
      <div className="space-y-4 max-w-full overflow-x-hidden">
        {filteredItems.length === 0 ? (
          <div className="rounded-xl border border-surface-hover bg-surface p-12 text-center">
            <Package className="mx-auto mb-4 h-12 w-12 text-gray-500" />
            <p className="text-gray-400">No inventory items found</p>
            <p className="text-sm text-gray-500">Add items or adjust filters</p>
          </div>
        ) : (
          filteredItems.map(item => {
            const isExpanded = expandedItem === item.id;
            const stockProgress = getStockProgress(item);
            const stockColor = getStockColor(item);
            const isLowStock = item.quantity <= item.minStock;

            return (
              <div
                key={item.id}
                className={`rounded-xl border ${isLowStock ? 'border-warning/50' : 'border-surface-hover'} bg-surface overflow-hidden`}
              >
                {/* Header */}
                <div
                  onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                  className="cursor-pointer p-4 hover:bg-surface-hover/50"
                >
                  <div className="flex items-start justify-between"
>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-mono text-sm text-gray-500">{item.sku}</span>
                        <h3 className="font-semibold">{item.name}</h3>
                        <span className={`rounded-full border px-2 py-0.5 text-xs ${CATEGORY_COLORS[item.category]}`}>
                          {CATEGORY_LABELS[item.category]}
                        </span>
                        <span className={`rounded-full border px-2 py-0.5 text-xs ${STATUS_COLORS[item.status]}`}>
                          {STATUS_LABELS[item.status]}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
                        <span className="flex items-center gap-1">
                          <Package className="h-4 w-4" />
                          Qty: {item.quantity}
                        </span>
                        
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-4 w-4" />
                          ${item.unitCost.toFixed(2)} each
                        </span>
                        
                        {item.sellingPrice && (
                          <span className="flex items-center gap-1 text-success">
                            Sells: ${item.sellingPrice.toFixed(2)}
                          </span>
                        )}

                        {item.location && (
                          <span>📍 {item.location}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Quick Adjust */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setAdjustQuantity({ itemId: item.id, amount: -1, reason: 'Quick removal' });
                          }}
                          className="rounded p-1 text-gray-400 hover:bg-danger/10 hover:text-danger"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-8 text-center font-mono">{item.quantity}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setAdjustQuantity({ itemId: item.id, amount: 1, reason: 'Quick add' });
                          }}
                          className="rounded p-1 text-gray-400 hover:bg-success/10 hover:text-success"
                        >
                          <PlusIcon className="h-4 w-4" />
                        </button>
                      </div>

                      <button
                        onClick={(e) => { e.stopPropagation(); openEdit(item); }}
                        className="rounded-lg p-2 text-gray-400 hover:bg-surface-hover"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>

                      <button
                        onClick={(e) => { e.stopPropagation(); deleteInventoryItem(item.id); }}
                        className="rounded-lg p-2 text-gray-400 hover:bg-danger/10 hover:text-danger"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>

                      {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </div>
                  </div>

                  {/* Stock Level Bar */}
                  <div className="mt-3">
                    <div className="h-2 overflow-hidden rounded-full bg-surface">
                      <div
                        className={`h-full rounded-full ${stockColor}`}
                        style={{ width: `${stockProgress}%` }}
                      />
                    </div>
                    <div className="mt-1 flex justify-between text-xs text-gray-500">
                      <span>Min: {item.minStock}</span>
                      <span>Current: {item.quantity}</span>
                      <span>Max: {item.maxStock}</span>
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-surface-hover p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4 max-w-full overflow-x-hidden">
                        <div>
                          <h4 className="text-sm font-medium text-gray-400 mb-2">Description</h4>
                          <p className="text-sm">{item.description || 'No description'}</p>
                        </div>

                        {item.notes && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-400 mb-2">Notes</h4>
                            <p className="text-sm">{item.notes}</p>
                          </div>
                        )}

                        {item.tags.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {item.tags.map(tag => (
                              <span key={tag} className="rounded-full bg-surface-hover px-2 py-1 text-xs text-gray-400">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="space-y-4 max-w-full overflow-x-hidden">
                        {item.supplier && (
                          <div className="text-sm">
                            <span className="text-gray-400">Supplier: </span>
                            {item.supplierUrl ? (
                              <a href={item.supplierUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{item.supplier}</a>
                            ) : (
                              item.supplier
                            )}
                          </div>
                        )}

                        {item.printTime > 0 && (
                          <div className="text-sm">
                            <span className="text-gray-400">Print Time: </span>{item.printTime} min
                          </div>
                        )}

                        {item.weight > 0 && (
                          <div className="text-sm">
                            <span className="text-gray-400">Weight: </span>{item.weight}g
                          </div>
                        )}

                        <div className="text-sm text-gray-400">
                          Total Value: ${(item.quantity * item.unitCost).toFixed(2)}
                        </div>

                        {item.totalSold > 0 && (
                          <div className="text-sm text-gray-400">
                            Total Sold: {item.totalSold} units
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add/Edit Modal - truncated for brevity */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-surface-hover bg-surface p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold">{editingItem ? 'Edit Item' : 'Add Inventory Item'}</h3>
              <button onClick={resetForm} className="text-gray-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm text-gray-400">SKU *</label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full rounded-lg border border-surface-hover bg-background px-4 py-2 text-white"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm text-gray-400">Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-lg border border-surface-hover bg-background px-4 py-2 text-white"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm text-gray-400">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as InventoryCategory })}
                    className="w-full rounded-lg border border-surface-hover bg-background px-4 py-2 text-white"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm text-gray-400">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as InventoryStatus })}
                    className="w-full rounded-lg border border-surface-hover bg-background px-4 py-2 text-white"
                  >
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm text-gray-400">Quantity</label>
                  <input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                    className="w-full rounded-lg border border-surface-hover bg-background px-4 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm text-gray-400">Min Stock Alert</label>
                  <input
                    type="number"
                    value={formData.minStock}
                    onChange={(e) => setFormData({ ...formData, minStock: parseInt(e.target.value) || 0 })}
                    className="w-full rounded-lg border border-surface-hover bg-background px-4 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm text-gray-400">Unit Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.unitCost}
                    onChange={(e) => setFormData({ ...formData, unitCost: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-lg border border-surface-hover bg-background px-4 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm text-gray-400">Selling Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: parseFloat(e.target.value) || undefined })}
                    className="w-full rounded-lg border border-surface-hover bg-background px-4 py-2 text-white"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 rounded-lg border border-surface-hover py-2 text-gray-400 hover:bg-surface-hover"
                >
                  Cancel
                </button>
                <LoadingButton
                  type="submit"
                  isLoading={isSubmitting}
                  loadingText={editingItem ? 'Saving...' : 'Adding...'}
                  className="flex-1 rounded-lg bg-primary py-2 font-medium text-white disabled:opacity-50"
                >
                  {editingItem ? 'Save Changes' : 'Add Item'}
                </LoadingButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-surface-hover bg-surface p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold">Import Inventory</h3>
              <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mb-4 text-sm text-gray-400">Paste CSV data with headers: SKU, Name, Category, Quantity, Unit Cost, Selling Price, Status, Location</p>

            <textarea
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              placeholder="SKU,Name,Category,Quantity,Unit Cost,Selling Price,Status,Location"
              rows={10}
              className="w-full rounded-lg border border-surface-hover bg-background px-4 py-2 text-white font-mono text-sm"
            />

            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setShowImportModal(false)}
                className="flex-1 rounded-lg border border-surface-hover py-2 text-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                className="flex-1 rounded-lg bg-primary py-2 font-medium text-white"
              >
                Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
import { useState, useRef } from 'react';
import { 
  Upload, File, Image, FileText, Archive, MoreVertical, 
  Search, Filter, Grid, List, Download, Trash2, Eye,
  X, Check, Folder
} from 'lucide-react';

interface FileItem {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  uploadedAt: string;
  category?: string;
  projectId?: string;
  thumbnailUrl?: string;
}

interface FileManagerProps {
  files: FileItem[];
  onUpload?: (files: FileList) => void;
  onDelete?: (id: string) => void;
  onDownload?: (file: FileItem) => void;
}

const CATEGORIES = ['all', 'Etsy', 'Photography', 'Strategy', 'Research', 'Marketing', 'Operations', 'Design'];

const FILE_ICONS: Record<string, any> = {
  image: Image,
  pdf: FileText,
  zip: Archive,
  default: File,
};

function getFileIcon(type: string) {
  if (type.startsWith('image/')) return FILE_ICONS.image;
  if (type.includes('pdf')) return FILE_ICONS.pdf;
  if (type.includes('zip') || type.includes('compressed')) return FILE_ICONS.zip;
  return FILE_ICONS.default;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function FileCard({ file, viewMode, onDelete, onDownload }: { 
  file: FileItem; 
  viewMode: 'grid' | 'list';
  onDelete?: (id: string) => void;
  onDownload?: (file: FileItem) => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const Icon = getFileIcon(file.type);
  const isImage = file.type.startsWith('image/');

  if (viewMode === 'list') {
    return (
      <div className="group flex items-center gap-4 rounded-xl border border-surface-hover bg-background p-4 transition-all hover:border-primary">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface">
          <Icon className="h-5 w-5 text-gray-400"></Icon>
        </div>
        
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{file.name}</p>
          <p className="text-sm text-gray-500">
            {formatSize(file.size)} • {new Date(file.uploadedAt).toLocaleDateString()}
          </p>
        </div>

        {file.category && (
          <span className="rounded-full bg-surface px-2.5 py-1 text-xs text-gray-400">
            {file.category}
          </span>
        )}

        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button 
            onClick={() => onDownload?.(file)}
            className="rounded-lg p-2 hover:bg-surface-hover"
            title="Download"
          >
            <Download className="h-4 w-4"></Download>
          </button>
          <button 
            onClick={() => onDelete?.(file.id)}
            className="rounded-lg p-2 text-danger hover:bg-danger/10"
            title="Delete"
          >
            <Trash2 className="h-4 w-4"></Trash2>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative rounded-xl border border-surface-hover bg-background p-4 transition-all hover:border-primary hover:shadow-lg"
    >
      {/* Thumbnail or Icon */}
      <div className="mb-3 aspect-square rounded-lg bg-surface overflow-hidden">
        {isImage && file.thumbnailUrl ? (
          <img 
            src={file.thumbnailUrl} 
            alt={file.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center"
          >
            <Icon className="h-12 w-12 text-gray-600"></Icon>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0"
      >
        <p className="truncate font-medium">{file.name}</p>
        <div className="mt-1 flex items-center justify-between text-sm text-gray-500"
        >
          <span>{formatSize(file.size)}</span>
          <span>{new Date(file.uploadedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
        </div>

        {file.category && (
          <span className="mt-2 inline-block rounded-full bg-surface px-2 py-0.5 text-xs text-gray-400"
          >
            {file.category}
          </span>
        )}
      </div>

      {/* Hover Actions */}
      <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100"
      >
        <button 
          onClick={() => onDownload?.(file)}
          className="rounded-lg bg-surface p-2 shadow-lg hover:bg-surface-hover"
          title="Download"
        >
          <Download className="h-4 w-4"></Download>
        </button>
        <button 
          onClick={() => onDelete?.(file.id)}
          className="rounded-lg bg-surface p-2 text-danger shadow-lg hover:bg-danger/10"
          title="Delete"
        >
          <Trash2 className="h-4 w-4"></Trash2>
        </button>
      </div>
    </div>
  );
}

export function FileManager({ files, onUpload, onDelete, onDownload }: FileManagerProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredFiles = files.filter((file) => {
    const matchesCategory = selectedCategory === 'all' || file.category === selectedCategory;
    const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      onUpload?.(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload?.(e.target.files);
    }
  };

  return (
    <div className="space-y-6"
    >
      {/* Header */}
      <div className="rounded-2xl border border-surface-hover bg-surface p-6"
      >
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-3"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10"
            >
              <Folder className="h-6 w-6 text-primary"></Folder>
            </div>
            <div>
              <h2 className="text-2xl font-bold">Files</h2>
              <p className="text-sm text-gray-400">{filteredFiles.length} files • {formatSize(files.reduce((acc, f) => acc + f.size, 0))}</p>
            </div>
          </div>

          <div className="flex items-center gap-2"
          >
            <div className="flex rounded-lg border border-surface-hover"
            >
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-2 ${viewMode === 'grid' ? 'bg-primary text-white' : 'hover:bg-surface-hover'} rounded-l-lg`}
              >
                <Grid className="h-4 w-4"></Grid>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-2 ${viewMode === 'list' ? 'bg-primary text-white' : 'hover:bg-surface-hover'} rounded-r-lg`}
              >
                <List className="h-4 w-4"></List>
              </button>
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 font-medium text-white hover:bg-primary-hover"
            >
              <Upload className="h-4 w-4"></Upload>
              Upload
            </button>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col gap-3 sm:flex-row"
        >
          <div className="relative flex-1"
          >
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"></Search>
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-surface-hover bg-background py-2.5 pl-10 pr-4 text-white placeholder-gray-500 focus:border-primary focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap gap-2"
          >
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                  selectedCategory === cat
                    ? 'bg-primary text-white'
                    : 'bg-surface-hover text-gray-400 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Upload Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
          isDragging 
            ? 'border-primary bg-primary/10' 
            : 'border-surface-hover hover:border-surface'
        }`}
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-surface"
        >
          <Upload className="h-8 w-8 text-gray-400"></Upload>
        </div>
        <p className="mt-4 text-lg font-medium">Drop files here to upload</p>
        <p className="text-sm text-gray-500">or click the Upload button</p>
      </div>

      {/* Files Grid/List */}
      <div className={viewMode === 'grid' ? 'grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4' : 'space-y-2'}
      >
        {filteredFiles.map((file) => (
          <FileCard 
            key={file.id} 
            file={file} 
            viewMode={viewMode}
            onDelete={onDelete}
            onDownload={onDownload}
          />
        ))}
      </div>

      {filteredFiles.length === 0 && (
        <div className="rounded-2xl border border-dashed border-surface-hover py-16 text-center"
        >
          <div className="mb-4 text-6xl">📁</div>
          <h3 className="mb-2 text-xl font-semibold">No files found</h3>
          <p className="text-gray-500">{searchQuery ? 'Try a different search' : 'Upload your first file'}</p>
        </div>
      )}
    </div>
  );
}
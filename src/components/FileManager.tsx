import { useState, useRef, useEffect } from 'react';
import { 
  Upload, File, Image, FileText, Archive, MoreVertical, 
  Search, Filter, Grid, List, Download, Trash2, Eye,
  X, Check, Folder, Link, Loader2
} from 'lucide-react';
import { getFileStorage, FileItem } from '../lib/fileStorage';
import { useAppStore } from '../stores/appStore';
import { setData, subscribeToData } from '../lib/firebase';

interface FileManagerProps {
  projectId?: string;
}

const CATEGORIES = ['Etsy', 'Photography', 'Strategy', 'Research', 'Marketing', 'Operations', 'Design'];

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

function FileCard({ 
  file, 
  viewMode, 
  onDelete, 
  onDownload,
  projectName
}: { 
  file: FileItem; 
  viewMode: 'grid' | 'list';
  onDelete?: (file: FileItem) => void;
  onDownload?: (file: FileItem) => void;
  projectName?: string;
}) {
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
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>{formatSize(file.size)}</span>
            <span>•</span>
            <span>{new Date(file.uploadedAt).toLocaleDateString()}</span>
            {file.projectId && projectName && (
              <>
                <span>•</span>
                <span className="text-primary">{projectName}</span>
              </>
            )}
          </div>
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
            onClick={() => onDelete?.(file)}
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
      <div className="mb-3 aspect-square rounded-lg bg-surface overflow-hidden">
        {isImage && file.thumbnailUrl ? (
          <a 
            href={file.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block h-full w-full"
          >
            <img 
              src={file.thumbnailUrl} 
              alt={file.name}
              className="h-full w-full object-cover"
              crossOrigin="anonymous"
            />
          </a>
        ) : (
          <div className="flex h-full items-center justify-center"
          >
            <Icon className="h-12 w-12 text-gray-600"></Icon>
          </div>
        )}
      </div>

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
        
        {file.projectId && projectName && (
          <div className="mt-2 flex items-center gap-1 text-xs text-primary"
          >
            <Link className="h-3 w-3"></Link>
            {projectName}
          </div>
        )}
      </div>

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
          onClick={() => onDelete?.(file)}
          className="rounded-lg bg-surface p-2 text-danger shadow-lg hover:bg-danger/10"
          title="Delete"
        >
          <Trash2 className="h-4 w-4"></Trash2>
        </button>
      </div>
    </div>
  );
}

export function FileManager({ projectId }: FileManagerProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [linkToProject, setLinkToProject] = useState(projectId || '');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileStorage = getFileStorage();
  const { projects } = useAppStore();

  // Load files from Firebase
  useEffect(() => {
    const unsubscribe = subscribeToData('v6/files', (data) => {
      if (data) {
        const fileList = Object.values(data) as FileItem[];
        setFiles(fileList);
      }
    });
    return unsubscribe;
  }, []);

  const filteredFiles = files.filter((file) => {
    const matchesCategory = selectedCategory === 'all' || file.category === selectedCategory;
    const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProject = !projectId || file.projectId === projectId;
    return matchesCategory && matchesSearch && matchesProject;
  });

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      await uploadFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await uploadFiles(Array.from(e.target.files));
    }
  };

  const uploadFiles = async (fileList: File[]) => {
    if (!fileStorage.isAvailable()) {
      alert('Firebase Storage not configured. Please set up Firebase in Settings.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    
    const uploadedFiles: FileItem[] = [];
    
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      try {
        const uploadedFile = await fileStorage.uploadFile({
          file,
          category: selectedCategory !== 'all' ? selectedCategory : 'Uncategorized',
          projectId: linkToProject || undefined,
        });
        
        if (uploadedFile) {
          // Remove undefined values before saving to Firebase
          const fileData = { ...uploadedFile };
          if (!fileData.projectId) delete (fileData as any).projectId;
          if (!fileData.category) delete (fileData as any).category;
          
          // Save to Firebase Realtime Database
          await setData(`v6/files/${uploadedFile.id}`, fileData);
          uploadedFiles.push(uploadedFile);
        }
        
        setUploadProgress(((i + 1) / fileList.length) * 100);
      } catch (error) {
        console.error('Upload failed:', error);
        alert(`Failed to upload ${file.name}`);
      }
    }
    
    setIsUploading(false);
    setUploadProgress(0);
  };

  const handleDelete = async (file: FileItem) => {
    if (!confirm(`Delete ${file.name}?`)) return;
    
    try {
      await fileStorage.deleteFile(file.storagePath);
      await setData(`v6/files/${file.id}`, null);
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete file');
    }
  };

  const handleDownload = (file: FileItem) => {
    window.open(file.url, '_blank');
  };

  const getProjectName = (projectId?: string) => {
    if (!projectId) return undefined;
    const project = projects.find(p => p.id === projectId);
    return project?.name;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-surface-hover bg-surface p-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Folder className="h-6 w-6 text-primary"></Folder>
            </div>
            <div>
              <h2 className="text-2xl font-bold">{projectId ? 'Project Files' : 'Files'}</h2>
              <p className="text-sm text-gray-400">{filteredFiles.length} files • {formatSize(filteredFiles.reduce((acc, f) => acc + f.size, 0))}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-surface-hover">
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
              disabled={isUploading}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 font-medium text-white hover:bg-primary-hover disabled:opacity-50"
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin"></Loader2>
              ) : (
                <Upload className="h-4 w-4"></Upload>
              )}
              {isUploading ? `${Math.round(uploadProgress)}%` : 'Upload'}
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

        {/* Search, Filter & Project Link */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"></Search>
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-surface-hover bg-background py-2.5 pl-10 pr-4 text-white placeholder-gray-500 focus:border-primary focus:outline-none"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded-xl border border-surface-hover bg-background px-4 py-2.5 text-white focus:border-primary focus:outline-none"
          >
            <option value="all">All Categories</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {!projectId && (
            <select
              value={linkToProject}
              onChange={(e) => setLinkToProject(e.target.value)}
              className="rounded-xl border border-surface-hover bg-background px-4 py-2.5 text-white focus:border-primary focus:outline-none"
            >
              <option value="">Link to Project (Optional)</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          )}
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
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-surface">
          <Upload className="h-8 w-8 text-gray-400"></Upload>
        </div>
        <p className="mt-4 text-lg font-medium">Drop files here to upload</p>
        <p className="text-sm text-gray-500">or click the Upload button</p>
      </div>

      {/* Files Grid/List */}
      <div className={viewMode === 'grid' ? 'grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4' : 'space-y-2'}>
        {filteredFiles.map((file) => (
          <FileCard 
            key={file.id} 
            file={file} 
            viewMode={viewMode}
            onDelete={handleDelete}
            onDownload={handleDownload}
            projectName={getProjectName(file.projectId)}
          />
        ))}
      </div>

      {filteredFiles.length === 0 && (
        <div className="rounded-2xl border border-dashed border-surface-hover py-16 text-center">
          <div className="mb-4 text-6xl">📁</div>
          <h3 className="mb-2 text-xl font-semibold">No files found</h3>
          <p className="text-gray-500">{searchQuery ? 'Try a different search' : 'Upload your first file'}</p>
        </div>
      )}
    </div>
  );
}
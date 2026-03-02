import { useState } from 'react';

interface FileItem {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  uploadedAt: string;
  category?: string;
  priorityId?: string;
}

interface FileManagerProps {
  files: FileItem[];
}

export function FileManager({ files }: FileManagerProps) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = ['all', 'Etsy', 'Photography', 'Strategy', 'Research', 'Marketing', 'Operations'];

  const filteredFiles = files.filter((file) => {
    const matchesCategory = selectedCategory === 'all' || file.category === selectedCategory;
    const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (type: string) => {
    if (type.includes('image')) return '🖼️';
    if (type.includes('pdf')) return '📄';
    if (type.includes('zip') || type.includes('compressed')) return '📦';
    return '📎';
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-surface-hover bg-surface p-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Files</h2>
            <p className="text-sm text-gray-400">{filteredFiles.length} files</p>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-lg border border-surface-hover bg-background px-4 py-2 text-white placeholder-gray-600 focus:border-primary focus:outline-none"
            />
            <button className="rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary-hover">
              Upload
            </button>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-full px-3 py-1 text-sm capitalize ${
                selectedCategory === cat
                  ? 'bg-primary text-white'
                  : 'bg-surface-hover text-gray-400 hover:bg-surface'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredFiles.map((file) => (
            <a
              key={file.id}
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 rounded-lg border border-surface-hover bg-background p-4 transition-colors hover:border-primary"
            >
              <div className="text-2xl">{getFileIcon(file.type)}</div>
              
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{file.name}</p>
                <div className="mt-1 flex items-center gap-2 text-sm text-gray-400">
                  <span>{formatSize(file.size)}</span>
                  <span>•</span>
                  <span>{new Date(file.uploadedAt).toLocaleDateString()}</span>
                </div>
                {file.category && (
                  <span className="mt-2 inline-block rounded-full bg-surface-hover px-2 py-0.5 text-xs text-gray-400">
                    {file.category}
                  </span>
                )}
              </div>
            </a>
          ))}
        </div>

        {filteredFiles.length === 0 && (
          <div className="py-12 text-center text-gray-500">
            📭 No files found
          </div>
        )}
      </div>
    </div>
  );
}
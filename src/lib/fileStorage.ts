import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage';
import { app } from './firebase';

interface UploadFileOptions {
  file: File;
  category?: string;
  projectId?: string;
  onProgress?: (progress: number) => void;
}

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
  storagePath: string;
  uploadedBy?: string;
}

class FileStorage {
  private storage: any = null;

  constructor() {
    if (app) {
      this.storage = getStorage(app);
    }
  }

  isAvailable(): boolean {
    return !!this.storage;
  }

  async uploadFile({ file, category, projectId, onProgress }: UploadFileOptions): Promise<FileItem | null> {
    if (!this.storage) {
      throw new Error('Firebase Storage not initialized');
    }

    try {
      // Create unique filename
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const path = `files/${category || 'uncategorized'}/${timestamp}_${safeName}`;
      
      const storageRef = ref(this.storage, path);
      
      // Upload file
      const snapshot = await uploadBytes(storageRef, file);
      
      // Get download URL
      const url = await getDownloadURL(snapshot.ref);
      
      // Generate thumbnail for images
      let thumbnailUrl: string | undefined;
      if (file.type.startsWith('image/')) {
        thumbnailUrl = url;
      }

      const fileItem: FileItem = {
        id: `${timestamp}`,
        name: file.name,
        size: file.size,
        type: file.type,
        url,
        uploadedAt: new Date().toISOString(),
        category,
        projectId,
        thumbnailUrl,
        storagePath: path,
      };

      return fileItem;
    } catch (error) {
      throw error;
    }
  }

  async deleteFile(storagePath: string): Promise<void> {
    if (!this.storage) {
      throw new Error('Firebase Storage not initialized');
    }

    try {
      const fileRef = ref(this.storage, storagePath);
      await deleteObject(fileRef);
    } catch (error) {
      throw error;
    }
  }

  async getFiles(category?: string): Promise<FileItem[]> {
    if (!this.storage) {
      return [];
    }

    try {
      const path = category ? `files/${category}` : 'files';
      const listRef = ref(this.storage, path);
      const result = await listAll(listRef);
      
      const files: FileItem[] = [];
      
      for (const item of result.items) {
        const url = await getDownloadURL(item);
        
        files.push({
          id: item.name.split('_')[0],
          name: item.name,
          size: 0,
          type: 'application/octet-stream',
          url,
          uploadedAt: new Date().toISOString(),
          storagePath: item.fullPath,
        });
      }

      return files;
    } catch (error) {
      return [];
    }
  }
}

// Singleton instance
let fileStorageInstance: FileStorage | null = null;

export function getFileStorage(): FileStorage {
  if (!fileStorageInstance) {
    fileStorageInstance = new FileStorage();
  }
  return fileStorageInstance;
}

export type { FileItem, UploadFileOptions };
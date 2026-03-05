import React, { useState, useEffect, useCallback } from 'react';
import { Database, ref, onValue } from 'firebase/database';
import { FileText, Download, Trash2, X } from 'lucide-react';
import { CompiledDocument } from '../../services/workflowCompletionService';
import { WorkflowCompletionService } from '../../services/workflowCompletionService';

interface AgentDocumentsProps {
  firebaseDb: Database;
}

export const AgentDocuments: React.FC<AgentDocumentsProps> = ({ firebaseDb }) => {
  const [documents, setDocuments] = useState<CompiledDocument[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<CompiledDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const service = new WorkflowCompletionService(firebaseDb);

  const loadDocuments = useCallback(async () => {
    try {
      const data = await service.listDocuments();
      setDocuments(data);
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setLoading(false);
    }
  }, [firebaseDb]);

  useEffect(() => {
    loadDocuments();
    
    // Real-time listener
    const docsRef = ref(firebaseDb, 'v6/agentDocuments');
    const unsubscribe = onValue(docsRef, () => loadDocuments());
    
    return () => unsubscribe();
  }, [firebaseDb, loadDocuments]);

  const handleDelete = async (docId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    
    try {
      setDeleting(docId);
      await service.deleteDocument(docId);
      if (selectedDoc?.id === docId) setSelectedDoc(null);
    } catch (err) {
      alert('Failed to delete document');
      console.error(err);
    } finally {
      setDeleting(null);
    }
  };

  const handleDownload = (doc: CompiledDocument) => {
    const blob = new Blob([doc.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.name.replace(/\s+/g, '_')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  if (selectedDoc) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSelectedDoc(null)}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white"
          >
            ← Back to Documents
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => handleDownload(selectedDoc)}
              className="flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary/90"
            >
              <Download className="h-4 w-4" />
              Download
            </button>
            <button
              onClick={() => handleDelete(selectedDoc.id)}
              disabled={deleting === selectedDoc.id}
              className="flex items-center gap-2 rounded-lg bg-red-500/20 px-3 py-1.5 text-sm font-medium text-red-400 hover:bg-red-500/30 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              {deleting === selectedDoc.id ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>

        <div className="rounded-xl touch-feedback border border-surface-hover bg-surface p-6">
          <h2 className="text-xl font-semibold mb-2">{selectedDoc.name}</h2>
          <p className="text-sm text-gray-400 mb-4">
            Created {formatDate(selectedDoc.createdAt)} · {selectedDoc.sections.length} sections
          </p>
          
          <div className="flex flex-wrap gap-2 mb-6">
            {selectedDoc.tags.map(tag => (
              <span key={tag} className="px-2 py-1 rounded-full text-xs bg-surface-hover text-gray-400">
                {tag}
              </span>
            ))}
          </div>

          <div className="prose prose-invert max-w-none">
            <pre className="whitespace-pre-wrap font-mono text-sm bg-surface-hover p-4 rounded-lg overflow-auto">
              {selectedDoc.content}
            </pre>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Compiled Documents</h2>
        <span className="text-sm text-gray-400">{documents.length} documents</span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading documents...</div>
      ) : documents.length === 0 ? (
        <div className="rounded-xl touch-feedback border border-surface-hover bg-surface p-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-hover mx-auto mb-4">
            <FileText className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium mb-2">No documents yet</h3>
          <p className="text-gray-400">Complete a workflow to generate a compiled document</p>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map(doc => (
            <div
              key={doc.id}
              className="rounded-xl touch-feedback border border-surface-hover bg-surface p-4 hover:border-primary/50 cursor-pointer transition-colors"
              onClick={() => setSelectedDoc(doc)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                  <div className="min-w-0">
                    <h4 className="font-medium truncate">{doc.name}</h4>
                    <p className="text-sm text-gray-400">
                      {doc.sections.length} sections · {formatDate(doc.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(doc);
                    }}
                    className="p-2 rounded-lg hover:bg-surface-hover text-gray-400 hover:text-white"
                    title="Download"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(doc.id);
                    }}
                    disabled={deleting === doc.id}
                    className="p-2 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400 disabled:opacity-50"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

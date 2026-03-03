/**
 * New Workflow Modal Component
 * Mission Control V6
 */

import React, { useState } from 'react';
import { Database } from 'firebase/database';
import { AgentTaskService } from '../../services/agentTaskService';
import { WORKFLOW_TEMPLATES } from '../../constants/agents';
import { X, Bot, Sparkles, Search, ShoppingCart, BarChart3, FileText, Code } from 'lucide-react';

interface NewWorkflowModalProps {
  firebaseDb: Database;
  isOpen: boolean;
  onClose: () => void;
  onWorkflowCreated?: () => void;
}

const templateIcons: Record<string, React.ReactNode> = {
  'product-research': <Search className="w-6 h-6" />,
  'create-listing': <ShoppingCart className="w-6 h-6" />,
  'market-analysis': <BarChart3 className="w-6 h-6" />,
  'content-creation': <FileText className="w-6 h-6" />,
  'technical-implementation': <Code className="w-6 h-6" />
};

const templateDescriptions: Record<string, string> = {
  'product-research': 'Research market trends and generate product ideas for Etsy',
  'create-listing': 'Create a complete Etsy listing from concept to publish-ready copy',
  'market-analysis': 'Analyze competitors and market opportunities',
  'content-creation': 'Create blog posts, social media content, or marketing materials',
  'technical-implementation': 'Design and implement technical features or automation'
};

export const NewWorkflowModal: React.FC<NewWorkflowModalProps> = ({
  firebaseDb,
  isOpen,
  onClose,
  onWorkflowCreated
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const service = new AgentTaskService(firebaseDb);

  if (!isOpen) return null;

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    setStep(2);
  };

  const handleCreate = async () => {
    if (!selectedTemplate || !input.trim()) return;

    setIsCreating(true);
    setError(null);

    try {
      await service.createWorkflow(
        selectedTemplate,
        { topic: input.trim() },
        'oleg.photos' // TODO: Get from auth
      );

      onWorkflowCreated?.();
      onClose();
      // Reset state
      setStep(1);
      setSelectedTemplate(null);
      setInput('');
    } catch (err: any) {
      const errorMessage = err?.message || 'Unknown error';
      setError(`Failed to create workflow: ${errorMessage}`);
      console.error('Workflow creation error:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleBack = () => {
    setStep(1);
    setSelectedTemplate(null);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-surface border border-surface-hover shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-surface-hover">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold">
              {step === 1 ? 'New Agent Workflow' : 'Configure Workflow'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-surface-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {step === 1 ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-400 mb-4">
                Choose a workflow template to automate multi-agent tasks
              </p>

              {Object.entries(WORKFLOW_TEMPLATES).map(([id, template]) => (
                <button
                  key={id}
                  onClick={() => handleTemplateSelect(id)}
                  className="w-full p-4 rounded-lg border border-surface-hover hover:border-primary hover:bg-surface-hover transition-all text-left"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      {templateIcons[id] || <Sparkles className="w-6 h-6" />}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium">{template.name}</h4>
                      <p className="text-sm text-gray-400 mt-1">
                        {templateDescriptions[id]}
                      </p>
                      <div className="flex gap-2 mt-2">
                        {template.steps.map((step, i) => (
                          <span
                            key={i}
                            className="text-xs px-2 py-1 rounded bg-surface-hover text-gray-400"
                          >
                            {step.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <button
                onClick={handleBack}
                className="text-sm text-primary hover:underline"
              >
                ← Back to templates
              </button>

              {selectedTemplate && (
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20"
                >
                  <div className="flex items-center gap-2 text-primary">
                    {templateIcons[selectedTemplate]}
                    <span className="font-medium">
                      {WORKFLOW_TEMPLATES[selectedTemplate].name}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">
                  What should the agents work on?
                </label>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    selectedTemplate === 'product-research'
                      ? "e.g., Research 3D printable nicotine pouch cases for Etsy"
                      : selectedTemplate === 'create-listing'
                      ? "e.g., Create listing for Keychain Can Carrier"
                      : "Describe what you want the agents to work on..."
                  }
                  className="w-full p-3 rounded-lg bg-surface border border-surface-hover focus:border-primary focus:outline-none resize-none"
                  rows={3}
                />
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
                >
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 rounded-lg border border-surface-hover hover:bg-surface-hover transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!input.trim() || isCreating}
                  className="flex-1 px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isCreating ? 'Creating...' : 'Start Workflow'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NewWorkflowModal;

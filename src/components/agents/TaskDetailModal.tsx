/**
 * Task Detail Modal Component
 * Mission Control V6
 */

import React, { useState, useEffect } from 'react';
import { Database } from 'firebase/database';
import { AgentTaskService } from '../../services/agentTaskService';
import { AgentTask, AgentWorkflow } from '../../types/agentTask';
import { AGENT_EMOJIS, AGENT_NAMES, WORKFLOW_TEMPLATES } from '../../constants/agents';
import { X, Bot, ChevronRight, Clock, CheckCircle, Circle } from 'lucide-react';

interface TaskDetailModalProps {
  firebaseDb: Database;
  taskId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  firebaseDb,
  taskId,
  isOpen,
  onClose
}) => {
  const [task, setTask] = useState<AgentTask | null>(null);
  const [workflow, setWorkflow] = useState<AgentWorkflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCompleting, setIsCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');

  const service = new AgentTaskService(firebaseDb);

  useEffect(() => {
    if (isOpen && taskId) {
      loadTask();
    }
  }, [isOpen, taskId]);

  const loadTask = async () => {
    if (!taskId) return;
    setLoading(true);
    setCompleteError(null);
    setResponseText('');
    
    const taskData = await service.getAgentTask(taskId);
    setTask(taskData);
    
    if (taskData?.workflowId) {
      const workflowData = await service.getWorkflow(taskData.workflowId);
      setWorkflow(workflowData);
    }
    
    setLoading(false);
  };

  const handleComplete = async () => {
    if (!taskId || !task) return;
    
    setIsCompleting(true);
    setCompleteError(null);
    
    try {
      // Use the response text entered by user, or default
      const output = responseText.trim() || 'Task completed';
      
      // Complete the task and trigger next agent
      await service.completeWorkflowTask(taskId, { result: output });
      
      // Reload to show updated state
      await loadTask();
      
      // Close modal after a brief delay
      setTimeout(() => {
        onClose();
      }, 1500);
      
    } catch (error: any) {
      setCompleteError(error?.message || 'Failed to complete task');
    } finally {
      setIsCompleting(false);
    }
  };

  if (!isOpen || !taskId) return null;

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const getWorkflowSteps = () => {
    if (!workflow) return [];
    const template = WORKFLOW_TEMPLATES[workflow.template];
    if (!template) return [];
    
    return template.steps.map((step, index) => {
      const stepTaskId = workflow.tasks[index];
      const isCurrent = stepTaskId === workflow.currentTaskId;
      const isCompleted = workflow.tasks.indexOf(stepTaskId) < workflow.tasks.indexOf(workflow.currentTaskId || '');
      
      return {
        ...step,
        taskId: stepTaskId,
        isCurrent,
        isCompleted
      };
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-surface border border-surface-hover shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-surface-hover sticky top-0 bg-surface">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{task && AGENT_EMOJIS[task.assignee]}</span>
            <div>
              <h3 className="font-semibold">{task?.title || 'Loading...'}</h3>
              <span className="text-xs text-gray-400">{task?.id}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-surface-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : task ? (
          <div className="p-4 space-y-6">
            {/* Status & Priority */}
            <div className="flex flex-wrap gap-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium border ${
                task.status === 'active' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                task.status === 'complete' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                task.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                'bg-gray-500/10 text-gray-500 border-gray-500/20'
              }`}>
                {task.status}
              </span>
              <span className="px-3 py-1 rounded-full text-sm bg-surface-hover text-gray-400">
                {AGENT_NAMES[task.assignee]}
              </span>
              <span className="px-3 py-1 rounded-full text-sm bg-surface-hover">
                {task.priority === 'urgent' ? '🔴' : task.priority === 'high' ? '🟠' : task.priority === 'medium' ? '🟡' : '🟢'} {task.priority}
              </span>
            </div>

            {/* Input / Prompt */}
            {task.input && (
              <div className="rounded-lg bg-surface-hover p-4">
                <h4 className="text-sm font-medium text-gray-400 mb-2">
                  {task.previousAgentTaskId ? 'Input from Previous Agent' : 'Prompt'}
                </h4>
                <div className="text-sm">
                  {task.input.topic ? (
                    <p className="italic">"{task.input.topic}"</p>
                  ) : task.input.result ? (
                    <div className="whitespace-pre-wrap font-mono text-xs bg-surface p-2 rounded max-h-40 overflow-y-auto">
                      {String(task.input.result).substring(0, 500)}
                      {String(task.input.result).length > 500 && '...'}
                    </div>
                  ) : (
                    <pre className="text-xs">{JSON.stringify(task.input, null, 2)}</pre>
                  )}
                </div>
              </div>
            )}

            {/* Workflow Steps */}
            {workflow && (
              <div className="rounded-lg border border-surface-hover p-4">
                <h4 className="text-sm font-medium mb-3">Workflow: {workflow.name}</h4>
                <div className="space-y-2">
                  {getWorkflowSteps().map((step, index) => (
                    <div
                      key={index}
                      className={`flex items-center gap-3 p-2 rounded-lg ${
                        step.isCurrent ? 'bg-primary/10 border border-primary/20' :
                        step.isCompleted ? 'bg-green-500/5' : 'bg-surface-hover'
                      }`}
                    >
                      <div className="flex-shrink-0">
                        {step.isCompleted ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : step.isCurrent ? (
                          <Circle className="w-5 h-5 text-primary animate-pulse" />
                        ) : (
                          <Circle className="w-5 h-5 text-gray-500" />
                        )}
                      </div>
                      <span className="text-lg">{AGENT_EMOJIS[step.agent]}</span>
                      <div className="flex-1">
                        <div className="text-sm font-medium">{step.label}</div>
                        <div className="text-xs text-gray-400">{AGENT_NAMES[step.agent]}</div>
                      </div>
                      {step.isCurrent && <span className="text-xs text-primary">Current</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Output */}
            {task?.output && (
              <div className="rounded-lg bg-green-500/5 border border-green-500/20 p-4">
                <h4 className="text-sm font-medium text-green-400 mb-2">Output</h4>
                <div className="text-sm whitespace-pre-wrap font-mono bg-surface p-3 rounded max-h-60 overflow-y-auto">
                  {typeof task.output === 'string' 
                    ? task.output 
                    : task.output?.result 
                      ? String(task.output.result)
                      : JSON.stringify(task.output, null, 2)}
                </div>
              </div>
            )}

            {/* Activity Log */}
            {task.activityLog?.length > 0 && (
              <div className="rounded-lg border border-surface-hover p-4">
                <h4 className="text-sm font-medium mb-3">Activity Log</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {task.activityLog.map((entry, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <Clock className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="text-gray-400">{formatDate(entry.timestamp)}</span>
                        <p>{entry.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Output / Response Input */}
            {task?.status === 'active' && (
              <div className="rounded-lg border border-surface-hover p-4">
                <h4 className="text-sm font-medium mb-2">Agent Response</h4>
                <textarea
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  placeholder="Paste the agent's response from Discord here..."
                  className="w-full p-3 rounded-lg bg-surface border border-surface-hover focus:border-primary focus:outline-none resize-none min-h-[120px]"
                  rows={4}
                />
              </div>
            )}

            {task?.output && (
              <div className="rounded-lg bg-green-500/5 border border-green-500/20 p-4">
                <h4 className="text-sm font-medium text-green-400 mb-2">Output</h4>
                <div className="text-sm whitespace-pre-wrap font-mono bg-surface p-3 rounded">
                  {typeof task.output === 'string' 
                    ? task.output 
                    : task.output?.result 
                      ? String(task.output.result).replace(/\\n/g, '\n')
                      : JSON.stringify(task.output, null, 2)}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {task?.status === 'active' && (
              <div className="space-y-3">
                {completeError && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {completeError}
                  </div>
                )}
                <div className="flex gap-3 pt-4 border-t border-surface-hover">
                  <button
                    onClick={handleComplete}
                    disabled={isCompleting}
                    className="flex-1 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isCompleting ? 'Completing...' : '✅ Mark Complete'}
                  </button>
                  <button
                    onClick={onClose}
                    className="px-4 py-2 rounded-lg border border-surface-hover hover:bg-surface-hover transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}

            {/* Timestamps */}
            <div className="flex flex-wrap gap-4 text-xs text-gray-400">
              <span>Created: {formatDate(task.createdAt)}</span>
              {task.startedAt && <span>Started: {formatDate(task.startedAt)}</span>}
              {task.completedAt && <span>Completed: {formatDate(task.completedAt)}</span>}
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-gray-400">Task not found</div>
        )}
      </div>
    </div>
  );
};

export default TaskDetailModal;

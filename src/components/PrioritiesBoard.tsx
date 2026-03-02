interface Priority {
  id: string;
  text: string;
  board: string;
  completed: boolean;
  dueDate?: string;
  tags: string[];
}

interface PrioritiesBoardProps {
  priorities: Priority[];
}

export function PrioritiesBoard({ priorities }: PrioritiesBoardProps) {
  const boards = ['etsy', 'photography', '3dprint', 'all'];
  
  const getBoardColor = (board: string) => {
    switch (board) {
      case 'etsy': return 'bg-pink-500/20 text-pink-400';
      case 'photography': return 'bg-cyan-500/20 text-cyan-400';
      case '3dprint': return 'bg-blue-500/20 text-blue-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const activePriorities = priorities.filter(p => !p.completed);
  const completedPriorities = priorities.filter(p => p.completed);

  return (
    <div className="rounded-xl border border-surface-hover bg-surface p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Priorities</h2>
        <div className="flex gap-2">
          <span className="rounded-full bg-primary-light px-3 py-1 text-sm text-primary">
            {activePriorities.length} active
          </span>
          <span className="rounded-full bg-gray-800 px-3 py-1 text-sm text-gray-400">
            {completedPriorities.length} done
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {activePriorities.map((priority) => (
          <div
            key={priority.id}
            className="flex items-start gap-3 rounded-lg border border-surface-hover bg-background p-4"
          >
            <input
              type="checkbox"
              className="mt-1 h-5 w-5 rounded border-gray-600 bg-surface"
            />
            <div className="flex-1">
              <p className="font-medium">{priority.text}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs ${getBoardColor(priority.board)}`}>
                  {priority.board}
                </span>
                
                {priority.dueDate && (
                  <span className="text-xs text-gray-500">
                    Due: {new Date(priority.dueDate).toLocaleDateString()}
                  </span>
                )}
                
                {priority.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-surface px-2 py-0.5 text-xs text-gray-400"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}

        {activePriorities.length === 0 && (
          <div className="py-8 text-center text-gray-500">
            No active priorities. Great job! 🎉
          </div>
        )}
      </div>
    </div>
  );
}
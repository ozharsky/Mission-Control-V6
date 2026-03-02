interface ChatMessage {
  id: string;
  from: 'user' | 'agent';
  text: string;
  timestamp: string;
}

interface AgentChatProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
}

export function AgentChat({ messages, onSendMessage }: AgentChatProps) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const input = e.currentTarget.elements.namedItem('message') as HTMLInputElement;
    if (input.value.trim()) {
      onSendMessage(input.value);
      input.value = '';
    }
  };

  return (
    <div className="flex h-[500px] flex-col rounded-xl border border-surface-hover bg-surface">
      <div className="border-b border-surface-hover p-4">
        <h2 className="text-lg font-semibold">Agent Chat</h2>
        <p className="text-sm text-gray-400">Direct messaging with your AI agent</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                msg.from === 'user'
                  ? 'bg-primary text-white'
                  : 'bg-surface-hover text-white'
              }`}
            >
              <p>{msg.text}</p>
              <span className="mt-1 block text-xs opacity-70">
                {new Date(msg.timestamp).toLocaleTimeString()}
              </span>
            </div>
          </div>
        ))}

        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-gray-500">
            No messages yet. Start a conversation!
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-surface-hover p-4">
        <div className="flex gap-2">
          <input
            type="text"
            name="message"
            placeholder="Type a message..."
            className="flex-1 rounded-lg border border-surface-hover bg-background px-4 py-2 text-white placeholder-gray-500 focus:border-primary focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primary-hover"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
'use client';

import React, { useState, useRef, useEffect } from 'react';

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  body: string;
  emojis: string[];
  createdAt: string;
  files?: Array<{ name: string; url: string; type?: string }>;
}

interface ClassroomChatProps {
  messages: ChatMessage[];
  onSendMessage: (body: string, emojis: string[], files: Array<{ name: string; url: string; type?: string }>) => void;
}

const EMOJI_SUGGESTIONS = ['🔥', '👏', '💡', '✅', '🎯', '👍', '❤️', '🎉'];

export default function ClassroomChat({ messages, onSendMessage }: ClassroomChatProps) {
  const [draft, setDraft] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = () => {
    if (!draft.trim()) return;

    const detectedEmojis = EMOJI_SUGGESTIONS.filter((e) => draft.includes(e));
    const files = fileName && fileUrl ? [{ name: fileName, url: fileUrl, type: 'link' }] : [];

    onSendMessage(draft, detectedEmojis, files);
    setDraft('');
    setFileName('');
    setFileUrl('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">No messages yet. Start the conversation!</p>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="rounded-xl bg-slate-50 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-900">{msg.userName}</p>
                <span className="text-xs text-slate-400">
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-700">{msg.body}</p>
              {msg.emojis.length > 0 && (
                <p className="mt-1 text-lg">{msg.emojis.join(' ')}</p>
              )}
              {msg.files && msg.files.length > 0 && (
                <div className="mt-1 space-y-1">
                  {msg.files.map((file, i) => (
                    <a key={i} href={file.url} className="block text-xs text-sky-600 underline hover:text-sky-800">
                      📎 {file.name}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Emoji suggestions */}
      <div className="flex flex-wrap gap-1 py-2">
        {EMOJI_SUGGESTIONS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => setDraft((prev) => `${prev} ${emoji}`.trim())}
            className="rounded-full bg-slate-100 px-2 py-0.5 text-sm hover:bg-slate-200"
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="space-y-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
          rows={2}
          className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
        />

        <div className="flex gap-2">
          <input
            type="text"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            placeholder="File name"
            className="flex-1 rounded-lg border border-slate-200 px-2 py-1 text-xs"
          />
          <input
            type="text"
            value={fileUrl}
            onChange={(e) => setFileUrl(e.target.value)}
            placeholder="https://..."
            className="flex-1 rounded-lg border border-slate-200 px-2 py-1 text-xs"
          />
        </div>

        <button
          onClick={handleSend}
          disabled={!draft.trim()}
          className="w-full rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-500 disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}

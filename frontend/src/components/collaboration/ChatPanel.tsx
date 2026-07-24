'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { Send, X, Smile } from 'lucide-react';

interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  message: string;
  timestamp: Date;
}

interface EmojiReaction {
  userId: string;
  username: string;
  emoji: string;
  timestamp: number;
}

interface ChatPanelProps {
  socket: Socket | null;
  roomId: string;
  username: string;
  onClose: () => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ socket, roomId, username, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [reactions, setReactions] = useState<EmojiReaction[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const emojis = ['👍', '❤️', '😂', '😮', '😢', '🎉', '👏', '🔥'];

  useEffect(() => {
    if (!socket) return;

    socket.on('chat-message', (message: ChatMessage) => {
      setMessages(prev => [...prev, message]);
    });

    socket.on('emoji-reaction', (reaction: EmojiReaction) => {
      setReactions(prev => [...prev, reaction]);
      setTimeout(() => {
        setReactions(prev => prev.filter(r => r.timestamp !== reaction.timestamp));
      }, 3000);
    });

    return () => {
      socket.off('chat-message');
      socket.off('emoji-reaction');
    };
  }, [socket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    if (!inputMessage.trim() || !socket) return;

    socket.emit('chat-message', {
      roomId,
      message: inputMessage,
      username
    });

    setInputMessage('');
  };

  const sendEmoji = (emoji: string) => {
    if (!socket) return;

    socket.emit('emoji-reaction', {
      roomId,
      emoji,
      username
    });

    setShowEmojiPicker(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="w-80 bg-gray-800 flex flex-col border-l border-gray-700">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Chat</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-700 rounded transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => (
          <div key={msg.id} className="bg-gray-700 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-blue-400">
                {msg.username}
              </span>
              <span className="text-xs text-gray-400">
                {new Date(msg.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <p className="text-sm text-gray-200 break-words">{msg.message}</p>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Emoji reactions overlay */}
      {reactions.length > 0 && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          {reactions.map((reaction) => (
            <div
              key={reaction.timestamp}
              className="text-6xl animate-bounce"
              style={{
                animation: 'float 3s ease-out forwards'
              }}
            >
              {reaction.emoji}
            </div>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="p-4 border-t border-gray-700">
        {/* Emoji picker */}
        {showEmojiPicker && (
          <div className="mb-2 p-2 bg-gray-700 rounded-lg flex gap-2 flex-wrap">
            {emojis.map((emoji) => (
              <button
                key={emoji}
                onClick={() => sendEmoji(emoji)}
                className="text-2xl hover:scale-125 transition-transform"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            <Smile className="w-5 h-5" />
          </button>
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={sendMessage}
            disabled={!inputMessage.trim()}
            className="p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes float {
          0% {
            transform: translateY(0) scale(0);
            opacity: 0;
          }
          50% {
            opacity: 1;
          }
          100% {
            transform: translateY(-200px) scale(1.5);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default ChatPanel;

import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { env } from '@/lib/env';

interface WebSocketMessage {
  id: string;
  content: string;
  type: 'user' | 'assistant' | 'system';
  timestamp: Date;
  attachments?: any[];
}

interface UseWebSocketReturn {
  sendMessage: (message: string, context?: any) => Promise<WebSocketMessage | null>;
  isConnected: boolean;
  connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'error';
  socket: Socket | null;
}

export const useWebSocket = (): UseWebSocketReturn => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected' | 'error'>('disconnected');
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    if (socket?.connected) return;

    setConnectionStatus('connecting');
    
    // Get WebSocket URL from environment or use default
    const wsUrl = env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3001';
    
    const newSocket = io(wsUrl, {
      transports: ['websocket', 'polling'],
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    newSocket.on('connect', () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      setConnectionStatus('connected');
      reconnectAttemptsRef.current = 0;
      
      // Join chat room
      newSocket.emit('join-chat', {
        userId: 'current-user', // This should come from auth context
        timestamp: new Date()
      });
    });

    newSocket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      setIsConnected(false);
      setConnectionStatus('disconnected');
      
      // Attempt to reconnect if not intentionally disconnected
      if (reason !== 'io client disconnect' && reconnectAttemptsRef.current < maxReconnectAttempts) {
        reconnectAttemptsRef.current++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 5000);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log(`Reconnecting... Attempt ${reconnectAttemptsRef.current}`);
          connect();
        }, delay);
      }
    });

    newSocket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setConnectionStatus('error');
      setIsConnected(false);
    });

    newSocket.on('message', (data: WebSocketMessage) => {
      console.log('Received message:', data);
      // This would be handled by the chat component
    });

    newSocket.on('typing', (data: { isTyping: boolean; userId: string }) => {
      console.log('Typing indicator:', data);
      // This would be handled by the chat component
    });

    setSocket(newSocket);
  }, [socket]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (socket) {
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
      setConnectionStatus('disconnected');
    }
  }, [socket]);

  const sendMessage = useCallback(async (message: string, context?: any): Promise<WebSocketMessage | null> => {
    if (!socket || !socket.connected) {
      console.error('WebSocket not connected');
      return null;
    }

    try {
      const messageData = {
        id: Date.now().toString(),
        content: message,
        type: 'user',
        timestamp: new Date(),
        context
      };

      // Send message to server
      socket.emit('send-message', messageData);

      // For now, simulate AI response
      // In production, this would come from the server
      const aiResponse: WebSocketMessage = {
        id: (Date.now() + 1).toString(),
        content: await generateAIResponse(message, context),
        type: 'assistant',
        timestamp: new Date()
      };

      return aiResponse;
    } catch (error) {
      console.error('Error sending message:', error);
      return null;
    }
  }, [socket]);

  // Auto-connect on mount
  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    sendMessage,
    isConnected,
    connectionStatus,
    socket
  };
};

// Mock AI response generator - replace with actual AI service integration
async function generateAIResponse(message: string, context?: any): Promise<string> {
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
  
  const lowerMessage = message.toLowerCase();
  
  // Context-aware responses
  if (context?.courseTitle) {
    if (lowerMessage.includes('help') || lowerMessage.includes('stuck')) {
      return `I understand you need help with ${context.courseTitle}. Let me provide some guidance based on the course content. Could you tell me more specifically what you're struggling with?`;
    }
    
    if (lowerMessage.includes('explain') || lowerMessage.includes('what is')) {
      return `Based on ${context.courseTitle}, I can help explain concepts. What specific topic would you like me to clarify?`;
    }
  }
  
  // General educational responses
  if (lowerMessage.includes('study') || lowerMessage.includes('learn')) {
    return `Here are some effective study strategies I recommend:\n\n1. **Active Recall**: Test yourself regularly instead of just re-reading\n2. **Spaced Repetition**: Review material at increasing intervals\n3. **Pomodoro Technique**: Study in focused 25-minute sessions\n4. **Feynman Technique**: Explain concepts in simple terms\n\nWould you like me to elaborate on any of these techniques?`;
  }
  
  if (lowerMessage.includes('motivation') || lowerMessage.includes('encouragement')) {
    return `You're doing great! Remember that learning is a journey, and every step forward counts. Here's some motivation:\n\n💪 **You're capable of amazing things**\n🎯 **Focus on progress, not perfection**\n🌟 **Your hard work will pay off**\n\nKeep going! What specific challenge are you working on right now?`;
  }
  
  if (lowerMessage.includes('question') || lowerMessage.includes('ask')) {
    return `I'm here to help with your questions! Feel free to ask about:\n\n• Course concepts and topics\n• Study strategies and techniques\n• Time management and organization\n• Test preparation tips\n• Career guidance in your field\n\nWhat's on your mind?`;
  }
  
  // Default response
  const responses = [
    "I'm here to help you learn! What would you like to know about your course material?",
    "Great question! Let me think about that and provide you with a helpful answer.",
    "I'd be happy to assist you with your learning journey. What specific topic can I help with?",
    "That's an interesting point! Let me provide you with some insights on that topic.",
    "I'm designed to support your educational goals. How can I help you succeed today?"
  ];
  
  return responses[Math.floor(Math.random() * responses.length)];
}

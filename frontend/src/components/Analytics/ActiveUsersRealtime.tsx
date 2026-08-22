import React, { useState, useEffect } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Activity, Users, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Transaction {
  id: string;
  type: string;
  user: string;
  timestamp: string;
  status: 'pending' | 'completed' | 'failed';
}

export const ActiveUsersRealtime: React.FC = () => {
  const { socket, isConnected } = useWebSocket();
  const [activeCount, setActiveCount] = useState<number>(0);
  const [liveTransactions, setLiveTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    if (!socket) return;

    socket.on('active-users-update', (data: { count: number }) => {
      setActiveCount(data.count);
    });

    socket.on('new-transaction', (transaction: Transaction) => {
      setLiveTransactions((prev: Transaction[]) => [transaction, ...prev].slice(0, 5));
    });

    return () => {
      socket.off('active-users-update');
      socket.off('new-transaction');
    };
  }, [socket]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card className="md:col-span-1">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Realtime Active Users</CardTitle>
          <div className="relative">
            <Users className="h-4 w-4 text-green-500" />
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{activeCount}</div>
          <p className="text-xs text-gray-500 mt-1">
            {isConnected ? 'Live connection active' : 'Connecting to live updates...'}
          </p>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Live Transactions</CardTitle>
          <Activity className="h-4 w-4 text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {liveTransactions.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">Waiting for transactions...</p>
            ) : (
              liveTransactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between text-sm border-b border-gray-50 pb-2 last:border-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className="p-1 bg-blue-50 rounded">
                      <Zap className="w-3 h-3 text-blue-500" />
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">{tx.type}</span>
                      <span className="text-gray-400 ml-2">by {tx.user}</span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(tx.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

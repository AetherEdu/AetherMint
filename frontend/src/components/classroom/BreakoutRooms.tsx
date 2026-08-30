'use client';

import React, { useState } from 'react';

interface BreakoutRoom {
  id: string;
  title: string;
  participantIds: string[];
}

interface Participant {
  userId: string;
  name: string;
  isOnline: boolean;
}

interface BreakoutRoomsProps {
  rooms: BreakoutRoom[];
  participants: Participant[];
  onCreateRoom: (title: string, participantIds: string[]) => void;
  onRemoveRoom: (roomId: string) => void;
  isInstructor: boolean;
}

export default function BreakoutRooms({
  rooms,
  participants,
  onCreateRoom,
  onRemoveRoom,
  isInstructor,
}: BreakoutRoomsProps) {
  const [newTitle, setNewTitle] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);

  const toggleParticipant = (userId: string) => {
    setSelectedParticipants((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    onCreateRoom(newTitle.trim(), selectedParticipants);
    setNewTitle('');
    setSelectedParticipants([]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <svg className="h-5 w-5 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <h3 className="text-lg font-semibold text-slate-900">Breakout Rooms</h3>
      </div>

      {isInstructor && (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Room name (e.g. Concept Clinic)"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />

          <div className="max-h-32 overflow-y-auto">
            <p className="mb-2 text-xs font-medium text-slate-500">Assign participants:</p>
            <div className="flex flex-wrap gap-1">
              {participants.map((p) => (
                <button
                  key={p.userId}
                  onClick={() => toggleParticipant(p.userId)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    selectedParticipants.includes(p.userId)
                      ? 'bg-sky-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={!newTitle.trim()}
            className="w-full rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-500 disabled:opacity-50"
          >
            Create Breakout Room
          </button>
        </div>
      )}

      {rooms.length === 0 ? (
        <p className="text-sm text-slate-500">No breakout rooms yet.</p>
      ) : (
        <div className="space-y-2">
          {rooms.map((room) => (
            <div key={room.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
              <div>
                <p className="font-medium text-slate-900">{room.title}</p>
                <p className="text-xs text-slate-500">
                  {room.participantIds.length} participant{room.participantIds.length !== 1 ? 's' : ''}
                </p>
              </div>
              {isInstructor && (
                <button
                  onClick={() => onRemoveRoom(room.id)}
                  className="rounded-lg px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

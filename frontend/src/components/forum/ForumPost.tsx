'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquare, ThumbsUp, CheckCircle, Flag } from 'lucide-react';

type ForumPostProps = {
  post: {
    _id: string;
    title: string;
    content: string;
    authorId: string;
    tags: string[];
    upvotes: number;
    isResolved: boolean;
    createdAt: string;
  };
};

export function ForumPost({ post }: ForumPostProps) {
  const [upvotes, setUpvotes] = useState(post.upvotes);

  const handleUpvote = async () => {
    // API call to upvote
    setUpvotes(upvotes + 1);
  };

  return (
    <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm">
      <div className="flex items-start justify-between">
        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{post.title}</h3>
        {post.isResolved && (
          <span className="flex items-center text-sm text-green-600 bg-green-50 dark:bg-green-950 px-2 py-1 rounded-full">
            <CheckCircle className="w-4 h-4 mr-1" />
            Resolved
          </span>
        )}
      </div>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">{post.content}</p>
      
      <div className="flex items-center gap-2 mt-4">
        {post.tags.map(tag => (
          <span key={tag} className="text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded text-zinc-600 dark:text-zinc-400">
            {tag}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-4 text-zinc-500">
          <button onClick={handleUpvote} className="flex items-center gap-1 hover:text-blue-500 transition-colors">
            <ThumbsUp className="w-4 h-4" />
            <span className="text-sm">{upvotes}</span>
          </button>
          <div className="flex items-center gap-1">
            <MessageSquare className="w-4 h-4" />
            <span className="text-sm">Replies</span>
          </div>
        </div>
        
        <button className="flex items-center gap-1 text-sm text-zinc-500 hover:text-red-500 transition-colors">
          <Flag className="w-4 h-4" />
          Report
        </button>
      </div>
    </div>
  );
}

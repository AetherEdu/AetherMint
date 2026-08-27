'use client';

import React, { useState, useEffect } from 'react';
import { ForumPost } from './ForumPost';
import { Button } from '@/components/ui/button';
import { CheckCircle, Award } from 'lucide-react';

export function ForumThread({ postId, courseId }: { postId: string, courseId?: string }) {
  const [post, setPost] = useState<any>(null);
  const [replies, setReplies] = useState<any[]>([]);

  // In a real implementation, you would fetch these from the backend
  useEffect(() => {
    // Mock data fetch
    setPost({
      _id: postId,
      title: 'How does the staking mechanism work?',
      content: 'I am confused about how staking rewards are calculated...',
      authorId: 'user123',
      tags: ['staking', 'question'],
      upvotes: 5,
      isResolved: true,
      createdAt: new Date().toISOString(),
    });

    setReplies([
      {
        _id: 'reply1',
        postId,
        content: 'Staking rewards are calculated based on your proportional share of the pool...',
        authorId: 'instructor456',
        upvotes: 12,
        isAcceptedAnswer: true,
        isInstructorAnswer: true,
        createdAt: new Date().toISOString(),
      }
    ]);
  }, [postId]);

  if (!post) return <div>Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <ForumPost post={post} />
      
      <div className="space-y-4 pl-4 md:pl-8 border-l-2 border-zinc-100 dark:border-zinc-800">
        <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">Replies</h4>
        
        {replies.map(reply => (
          <div key={reply._id} className={`p-4 rounded-lg border ${reply.isAcceptedAnswer ? 'bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-900' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'}`}>
            {reply.isAcceptedAnswer && (
              <div className="flex items-center gap-1 text-green-600 mb-2 font-medium text-sm">
                <CheckCircle className="w-4 h-4" />
                Accepted Answer
              </div>
            )}
            
            <div className="flex items-center gap-2 mb-2">
              <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100">User {reply.authorId}</span>
              {reply.isInstructorAnswer && (
                <span className="flex items-center text-xs text-blue-600 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded-full">
                  <Award className="w-3 h-3 mr-1" />
                  Instructor
                </span>
              )}
            </div>
            
            <p className="text-zinc-600 dark:text-zinc-400">{reply.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

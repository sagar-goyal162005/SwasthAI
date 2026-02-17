'use client';

import Image from 'next/image';
import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MessageCircle, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CommunityPost } from '@/lib/data';
import type { User } from '@/lib/user-store';
import { addCommentToPost } from '@/actions/community';

type Props = {
  post: CommunityPost;
  currentUser: User | null;
  onRefresh: () => Promise<void>;
};

export default function PostCard({ post, currentUser, onRefresh }: Props) {
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isAddingComment, setIsAddingComment] = useState(false);

  const handleAddComment = async () => {
    if (!currentUser || !newComment.trim()) return;
    setIsAddingComment(true);
    try {
      await addCommentToPost(post.id, {
        user: {
          uid: currentUser.uid,
          name: currentUser.name,
          avatarUrl: currentUser.avatarUrl,
        },
        content: newComment.trim(),
      });
      setNewComment('');
      await onRefresh();
    } finally {
      setIsAddingComment(false);
    }
  };

  return (
    <div className={cn('bg-[var(--card-bg)] p-6 rounded-2xl border border-white/5', 'transition duration-200 hover:bg-[var(--card-hover)]')}>
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={post.user.avatarUrl} alt={post.user.name} />
          <AvatarFallback>{post.user.name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="font-medium text-[var(--text-primary)] truncate">{post.user.name}</p>
          <p className="text-xs text-[var(--text-secondary)]">
            {formatDistanceToNow(new Date(post.timestamp), { addSuffix: true })}
          </p>
        </div>
      </div>

      <p className="mt-4 text-[var(--text-primary)] break-words">{post.content}</p>

      {post.imageUrl ? (
        <div className="mt-4 relative w-full aspect-[4/3] overflow-hidden rounded-xl border border-white/5">
          <Image src={post.imageUrl} alt="Post image" fill className="object-cover" data-ai-hint={post.imageHint} />
        </div>
      ) : null}

      <div className="mt-4 flex gap-6 text-sm text-[var(--text-secondary)]">
        <button type="button" className="hover:text-primary transition duration-200" aria-disabled>
          ❤️ {Object.values(post.reactions || {}).reduce((a, b) => a + (b || 0), 0)}
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-2 hover:text-primary transition duration-200"
          onClick={() => setShowComments((v) => !v)}
        >
          <MessageCircle className="h-4 w-4" />
          {(post.comments?.length || 0).toString()}
        </button>
      </div>

      {showComments ? (
        <div className="mt-4 space-y-3">
          {(post.comments || []).map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={comment.user.avatarUrl} alt={comment.user.name} />
                <AvatarFallback>{comment.user.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="rounded-xl bg-white/5 border border-white/5 p-3">
                  <p className="text-sm font-medium text-[var(--text-primary)]">{comment.user.name}</p>
                  <p className="text-sm text-[var(--text-primary)]">{comment.content}</p>
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  {formatDistanceToNow(new Date(comment.timestamp), { addSuffix: true })}
                </p>
              </div>
            </div>
          ))}

          {currentUser ? (
            <div className="flex gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={currentUser.avatarUrl} alt={currentUser.name} />
                <AvatarFallback>{currentUser.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 flex gap-2">
                <Textarea
                  placeholder="Write a comment…"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="min-h-[60px] resize-none bg-transparent border border-white/5 focus-visible:ring-0 focus-visible:ring-offset-0"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void handleAddComment();
                    }
                  }}
                />
                <Button
                  size="sm"
                  onClick={() => void handleAddComment()}
                  disabled={!newComment.trim() || isAddingComment}
                  className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

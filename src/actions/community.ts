'use client';

import type { CommunityPost, PostComment } from '@/lib/data';
import { apiFetch } from '@/lib/api-client';

// Get all community posts (public)
export async function getAllCommunityPosts(communitySlug?: string | null): Promise<CommunityPost[]> {
  const qs = communitySlug ? `?community=${encodeURIComponent(communitySlug)}` : '';
  return apiFetch<CommunityPost[]>(`/posts${qs}`);
}

// Add a new community post (requires auth)
export async function addCommunityPost(
  newPost: Omit<CommunityPost, 'id'>,
  communitySlug?: string | null
): Promise<{ success: boolean; id?: string; error?: string; details?: any }> {
  try {
    const created = await apiFetch<CommunityPost>('/posts', {
      method: 'POST',
      body: JSON.stringify({
        content: newPost.content,
        imageUrl: newPost.imageUrl,
        imageHint: newPost.imageHint,
        communitySlug: communitySlug || undefined,
      }),
    });
    return { success: true, id: created.id };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to create post' };
  }
}

// Reactions are currently read-only in the UI; keep API surface for future.
export async function togglePostReaction(_postId: string, _userId: string, _emoji: string) {
  return;
}

export async function addCommentToPost(postId: string, comment: Omit<PostComment, 'id' | 'timestamp'>) {
  await apiFetch(`/posts/${postId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ content: comment.content }),
  });
}

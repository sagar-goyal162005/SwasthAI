/**
 * SwasthAI - AI-Powered Personalized Wellness Companion
 * Copyright © 2025 Akash Rathaur. All Rights Reserved.
 * 
 * Community Page - Social wellness platform
 * Features community sharing, challenges, and peer support for wellness journeys
 * 
 * @author Akash Rathaur
 * @email akashsrathaur@gmail.com
 * @website https://github.com/akashsrathaur
 */

'use client';
import { Button } from '@/components/ui/button';
import { type CommunityPost } from '@/lib/data';
import { RotateCcw, Users, Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';
import { defaultUser, type User } from '@/lib/user-store';
import { addCommunityPost as addPostAction } from '@/actions/community';
import { apiFetch } from '@/lib/api-client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import CommunityHeader from '@/components/community/community-header';
import CreatePost from '@/components/community/create-post';
import PostCard from '@/components/community/post-card';
import SidebarGroups from '@/components/community/sidebar-groups';
import SidebarMembers from '@/components/community/sidebar-members';


export default function CommunityPage() {
  const { user, posts, loading, refreshPosts } = useAuth();
  const userData = user || { ...defaultUser, uid: '' };
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  type Community = { slug: string; name: string; description?: string; memberCount?: number };
  const [communities, setCommunities] = useState<Community[]>([]);
  const [communitiesLoading, setCommunitiesLoading] = useState(true);
  const [activeCommunity, setActiveCommunity] = useState<string>('general');

  const [isCreateCommunityOpen, setIsCreateCommunityOpen] = useState(false);
  const [newCommunitySlug, setNewCommunitySlug] = useState('');
  const [newCommunityName, setNewCommunityName] = useState('');
  const [newCommunityDescription, setNewCommunityDescription] = useState('');
  const [creatingCommunity, setCreatingCommunity] = useState(false);

  const loadCommunities = useCallback(async () => {
    setCommunitiesLoading(true);
    try {
      const list = await apiFetch<Community[]>('/communities');
      setCommunities(list || []);
    } catch {
      setCommunities([]);
    } finally {
      setCommunitiesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCommunities();
  }, [loadCommunities]);

  useEffect(() => {
    refreshPosts(activeCommunity);
  }, [activeCommunity, refreshPosts]);

  // Keep the feed updated so posts from other accounts appear automatically.
  useEffect(() => {
    const intervalMs = 15000;
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      refreshPosts(activeCommunity);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [activeCommunity, refreshPosts]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshPosts(activeCommunity);
      toast({
        title: 'Refreshed',
        description: 'Community feed has been refreshed.',
      });
    } catch (error) {
      console.error('Error refreshing posts:', error);
      toast({
        variant: 'destructive',
        title: 'Refresh Failed',
        description: 'Unable to refresh posts. Please try again.',
      });
    }
    setRefreshing(false);
  };

  const handleAddPost = async (content: string, imageUrl?: string, imageHint?: string) => {
    if (!user) {
      console.log('Post creation failed: User not logged in');
      toast({
        variant: 'destructive',
        title: 'Not Logged In',
        description: 'Please log in to create posts.',
      });
      return;
    }

    console.log('Starting post creation...', {
      user: {
        uid: user.uid,
        name: user.name,
        authenticated: !!user.uid
      },
      content: content.slice(0, 50) + '...',
      hasImage: !!imageUrl
    });

    try {
      const newPost: Omit<CommunityPost, 'id'> = {
        user: {
          uid: user.uid,
          name: user.name,
          avatarUrl: user.avatarUrl,
        },
        timestamp: new Date().toISOString(),
        content: content,
        imageUrl: imageUrl,
        imageHint: imageHint,
        reactions: {},
        userReactions: {},
        comments: []
      };

      console.log('Attempting to save post:', newPost);
      const result = await addPostAction(newPost, activeCommunity);
      console.log('Post creation result:', result);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to create post');
      }
      
      toast({
        title: 'Post Created!',
        description: 'Your post has been shared with the community.',
      });
      await refreshPosts(activeCommunity);
    } catch (error) {
      console.error('Error creating post:', error);
      console.error('Error details:', {
        name: (error as any)?.name,
        message: (error as any)?.message,
        code: (error as any)?.code,
        stack: (error as any)?.stack,
        cause: (error as any)?.cause
      });
      
      // Provide specific error messages based on error type
      let errorMessage = 'Unable to create post. Please try again.';
      let errorTitle = 'Post Failed';
      
      if ((error as any)?.code === 'permission-denied') {
        errorMessage = 'You don\'t have permission to create posts. Please check your authentication.';
        errorTitle = 'Permission Denied';
      } else if ((error as any)?.code === 'unavailable') {
        errorMessage = 'Service temporarily unavailable. Please try again in a moment.';
        errorTitle = 'Service Unavailable';
      }
      
      toast({
        variant: 'destructive',
        title: errorTitle,
        description: errorMessage,
      });
    }
  };

  const handleCreateCommunity = async () => {
    if (!user) {
      toast({ variant: 'destructive', title: 'Not Logged In', description: 'Please log in to create a community.' });
      return;
    }

    const slug = newCommunitySlug.trim().toLowerCase();
    const name = newCommunityName.trim();
    if (!slug || !name) return;

    setCreatingCommunity(true);
    try {
      await apiFetch('/communities', {
        method: 'POST',
        body: JSON.stringify({
          slug,
          name,
          description: newCommunityDescription.trim() || undefined,
        }),
      });
      setIsCreateCommunityOpen(false);
      setNewCommunitySlug('');
      setNewCommunityName('');
      setNewCommunityDescription('');
      await loadCommunities();
      setActiveCommunity(slug);
      toast({ title: 'Community Created', description: 'Your community is ready.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Create Failed', description: e?.message || 'Unable to create community.' });
    } finally {
      setCreatingCommunity(false);
    }
  };

  if (loading) {
      return (
        <div className="mx-auto max-w-2xl">
          <div className="text-center py-12">
            <div className="loading-spinner mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading community posts...</p>
          </div>
        </div>
      )
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] p-6">
      <CommunityHeader
        title="Community"
        subtitle="Connect, share, and grow together."
        onRefresh={handleRefresh}
        refreshing={refreshing}
        rightSlot={
          <div className="flex items-center gap-2 justify-end">
            <Select value={activeCommunity} onValueChange={setActiveCommunity} disabled={communitiesLoading}>
              <SelectTrigger className="w-[220px] bg-[var(--card-bg)] border border-white/5 rounded-xl">
                <SelectValue placeholder={communitiesLoading ? 'Loading…' : 'Select community'} />
              </SelectTrigger>
              <SelectContent>
                {(communities || []).map((c) => (
                  <SelectItem key={c.slug} value={c.slug}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsCreateCommunityOpen(true)}
              className={cn(
                'rounded-xl bg-white/5 hover:bg-white/10 text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-white/5',
                'transition duration-200'
              )}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create
            </Button>
          </div>
        }
      />

      {user ? (
        <div className="mt-6">
          <CreatePost onAddPost={handleAddPost} userData={userData as any} />
        </div>
      ) : null}

      <div className="grid grid-cols-12 gap-6 mt-6">
        <div className="col-span-12 lg:col-span-8 space-y-6">
          {posts.length === 0 ? (
            <div className="bg-[var(--card-bg)] p-6 rounded-2xl border border-white/5 transition duration-200 hover:bg-[var(--card-hover)]">
              <div className="flex flex-col items-center gap-4 py-10 text-center">
                <Users className="h-12 w-12 text-[var(--text-secondary)]" />
                <div>
                  <h3 className="font-semibold">No posts yet</h3>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">Be the first to share something with the community.</p>
                </div>
                <Button
                  onClick={handleRefresh}
                  variant="secondary"
                  size="sm"
                  className={cn(
                    'rounded-xl bg-white/5 hover:bg-white/10 text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-white/5',
                    'transition duration-200'
                  )}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Check for posts
                </Button>
              </div>
            </div>
          ) : (
            posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentUser={user}
                onRefresh={() => refreshPosts(activeCommunity)}
              />
            ))
          )}
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-6">
          <SidebarGroups
            groups={(communities || []).map((c) => ({ slug: c.slug, name: c.name }))}
            activeSlug={activeCommunity}
            onOpen={(slug) => setActiveCommunity(slug)}
          />
          <SidebarMembers />
        </div>
      </div>

      <Dialog open={isCreateCommunityOpen} onOpenChange={setIsCreateCommunityOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a community</DialogTitle>
            <DialogDescription>
              Pick a short slug (e.g., <span className="font-mono">yoga</span>) and a display name.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="community-slug">Slug</Label>
              <Input
                id="community-slug"
                placeholder="general"
                value={newCommunitySlug}
                onChange={(e) => setNewCommunitySlug(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="community-name">Name</Label>
              <Input
                id="community-name"
                placeholder="General"
                value={newCommunityName}
                onChange={(e) => setNewCommunityName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="community-description">Description (optional)</Label>
              <Input
                id="community-description"
                placeholder="A place to share wellness tips"
                value={newCommunityDescription}
                onChange={(e) => setNewCommunityDescription(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateCommunityOpen(false)}
              disabled={creatingCommunity}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateCommunity}
              disabled={creatingCommunity || !newCommunitySlug.trim() || !newCommunityName.trim()}
            >
              {creatingCommunity ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

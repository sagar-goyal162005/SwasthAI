'use client';

import Image from 'next/image';
import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Camera, Send, Smile, Trophy } from 'lucide-react';
import { CameraDialog } from '@/components/ui/camera-dialog';
import type { User } from '@/lib/user-store';
import { cn } from '@/lib/utils';

type Props = {
  userData: User;
  onAddPost: (content: string, imageUrl?: string, imageHint?: string) => void;
};

export default function CreatePost({ userData, onAddPost }: Props) {
  const [content, setContent] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const canPost = !!content.trim() || !!image;

  const handlePost = () => {
    if (!canPost) return;
    onAddPost(content.trim(), image || undefined, image ? 'community post image' : undefined);
    setContent('');
    setImage(null);
  };

  const handleImageCaptured = (imageDataUrl: string) => {
    setImage(imageDataUrl);
    setIsCameraOpen(false);
  };

  return (
    <>
      <div className={cn('bg-[var(--card-bg)] p-6 rounded-2xl border border-white/5', 'transition duration-200 hover:bg-[var(--card-hover)]')}>
        <div className="flex gap-4">
          <Avatar className="h-10 w-10">
            <AvatarImage src={userData.avatarUrl} alt={userData.name} />
            <AvatarFallback>{userData.name?.charAt(0) || 'U'}</AvatarFallback>
          </Avatar>

          <div className="flex-1">
            <Textarea
              placeholder="Share an update..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[90px] w-full bg-transparent border border-white/5 focus-visible:ring-0 focus-visible:ring-offset-0 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] resize-none"
            />

            {image ? (
              <div className="mt-3 relative w-full max-w-[320px] aspect-[4/3] overflow-hidden rounded-xl border border-white/5">
                <Image src={image} alt="Post preview" fill className="object-cover" />
              </div>
            ) : null}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4">
              <div className="flex flex-wrap gap-4 text-[var(--text-secondary)] text-sm">
                <button type="button" onClick={() => setIsCameraOpen(true)} className="inline-flex items-center gap-2 hover:text-primary transition duration-200">
                  <Camera className="h-4 w-4" />
                  Photo
                </button>
                <button type="button" className="inline-flex items-center gap-2 hover:text-primary transition duration-200" aria-disabled>
                  <Smile className="h-4 w-4" />
                  Vibe
                </button>
                <button type="button" className="inline-flex items-center gap-2 hover:text-primary transition duration-200" aria-disabled>
                  <Trophy className="h-4 w-4" />
                  Challenge
                </button>
              </div>

              <Button
                type="button"
                onClick={handlePost}
                disabled={!canPost}
                className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition duration-200"
              >
                Post
                <Send className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <CameraDialog
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onImageCaptured={handleImageCaptured}
      />
    </>
  );
}

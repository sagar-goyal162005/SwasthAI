'use client';

import { useEffect, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChatBuddy } from '@/components/chat-buddy';

export default function ChatbotClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const sidebarTab = useMemo(() => {
    const tab = searchParams.get('tab');
    if (tab === 'history') return 'history' as const;
    if (tab === 'new') return 'new' as const;
    return null;
  }, [searchParams]);

  // Treat `?tab=` as an action trigger, then clear it so clicking
  // the same sidebar item again works reliably.
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (!tab) return;

    const next = new URLSearchParams(searchParams);
    next.delete('tab');
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, pathname, searchParams]);

  return (
    <div className="h-[calc(100vh-8rem)] overflow-hidden bg-background bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.05),transparent_40%)]">
      <div className="mx-auto h-full w-full max-w-6xl">
        <ChatBuddy variant="embedded" hideLauncher sidebarTab={sidebarTab} />
      </div>
    </div>
  );
}

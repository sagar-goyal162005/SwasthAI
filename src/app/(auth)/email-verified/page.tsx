'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';

export default function EmailVerifiedPage() {
  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="flex flex-col items-center space-y-4 text-center">
        <Icons.logo className="h-8 w-auto" />
        <h1 className="text-xl font-bold">Your email has been verified</h1>
        <p className="text-sm text-muted-foreground">Now you can close this tab.</p>
      </div>

      <div className="gradient-border-card">
        <Card className="gradient-border-card-inner rounded-t-3xl bg-card p-8">
          <div className="space-y-4 text-center">
            <Button asChild className="w-full" variant="secondary">
              <Link href="/signup?verified=1">Back to Signup</Link>
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

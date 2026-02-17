
'use client';

import { useAuth } from '@/context/auth-context';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

const publicRoutes = ['/login', '/signup'];

function LoadingScreen() {
    return (
        <div className="h-screen w-full flex items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                <p className="text-muted-foreground">Loading your wellness journey...</p>
            </div>
        </div>
    );
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isPublicRoute = publicRoutes.some((path) => pathname.startsWith(path));
  const isSignupRoute = pathname.startsWith('/signup');
  const isLoginRoute = pathname.startsWith('/login');

  useEffect(() => {
    if (loading) {
      console.log('AuthGuard: Still loading auth state');
      return; // Wait for the auth state to be determined.
    }

    console.log('AuthGuard: Auth state loaded', { 
      user: !!user, 
      pathname, 
      isPublicRoute 
    });

    // If user is not logged in and trying to access a protected route, redirect to login
    if (!user && !isPublicRoute) {
      console.log('AuthGuard: Redirecting to login - user not authenticated');
      router.replace('/login');
      return;
    }
    
    // If user is logged in and tries to access login, redirect to dashboard.
    if (user && isPublicRoute && isLoginRoute && !isSignupRoute) {
      console.log('AuthGuard: Redirecting to dashboard - user already authenticated');
      router.replace('/dashboard');
      return;
    }

    // NOTE: We intentionally do NOT redirect away from /signup because the
    // signup flow may temporarily create/sign-in a user before profile
    // bootstrap is completed.

    console.log('AuthGuard: No redirect needed, staying on', pathname);
  }, [user, loading, pathname, router, isPublicRoute, isLoginRoute, isSignupRoute]);

  // While loading auth state, avoid unmounting public routes like /signup.
  // Unmount/remount clears form state (e.g., password fields) and looks like a refresh.
  if (loading && !isPublicRoute) return <LoadingScreen />;
  
  // After loading, if we are on a public route or if user is authenticated for a private one
  if (isPublicRoute || user) {
    return <>{children}</>;
  }

  // Fallback loading screen during redirection
  return <LoadingScreen />;
}

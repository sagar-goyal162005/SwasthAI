'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { BuddyPersona, User } from '@/lib/user-store';
import type { Challenge, CommunityPost, DailyVibe } from '@/lib/data';
import { apiFetch } from '@/lib/api-client';
import { getFirebaseAuth } from '@/lib/firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';

type ProgressState = {
  streak: number;
  completedTasks: number;
};

type BootstrapPayload = {
  name: string;
  age: number;
  gender: User['gender'];
  phone?: string;
  dosha?: User['dosha'];
  doshaIsBalanced?: boolean;
  avatarUrl?: string;
  bio?: string;
};

interface AuthContextType {
  user: User | null;
  loading: boolean;
  authBusy: boolean;

  challenges: Challenge[];
  setChallenges: React.Dispatch<React.SetStateAction<Challenge[]>>;

  dailyVibes: DailyVibe[];
  setDailyVibes: React.Dispatch<React.SetStateAction<DailyVibe[]>>;

  posts: CommunityPost[];
  setPosts: React.Dispatch<React.SetStateAction<CommunityPost[]>>;

  userProgress: ProgressState | null;
  setUserProgress: React.Dispatch<React.SetStateAction<ProgressState | null>>;

  streak: number;

  login: (email: string, password: string) => Promise<void>;
  bootstrapProfile: (payload: BootstrapPayload) => Promise<void>;
  logout: () => Promise<void>;

  refreshPosts: (communitySlug?: string | null) => Promise<void>;
  refreshUserData: () => Promise<void>;

  updateProfile: (updates: Partial<Omit<User, 'uid'>>) => Promise<void>;
  updateBuddy: (buddyPersona: BuddyPersona) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  authBusy: false,
  challenges: [],
  setChallenges: () => {},
  dailyVibes: [],
  setDailyVibes: () => {},
  posts: [],
  setPosts: () => {},
  userProgress: null,
  setUserProgress: () => {},
  streak: 0,
  login: async () => {},
  bootstrapProfile: async () => {},
  logout: async () => {},
  refreshPosts: async () => {},
  refreshUserData: async () => {},
  updateProfile: async () => {},
  updateBuddy: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);

  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [dailyVibes, setDailyVibes] = useState<DailyVibe[]>([]);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [userProgress, setUserProgress] = useState<ProgressState | null>(null);

  const refreshUserData = useCallback(async () => {
    const data = await apiFetch<{ challenges: Challenge[]; dailyVibes: DailyVibe[] }>('/user-data/me');
    setChallenges(data.challenges || []);
    setDailyVibes(data.dailyVibes || []);

    const completedTasks = (data.dailyVibes || []).filter((v: any) => {
      if (v.id === 'medication') return v.progress === 100;
      return !!v.completedAt;
    }).length;

    setUserProgress({ streak: (user?.streak || 0) as number, completedTasks });
  }, [user?.streak]);

  const refreshPosts = useCallback(async (communitySlug?: string | null) => {
    try {
      const qs = communitySlug ? `?community=${encodeURIComponent(communitySlug)}` : '';
      const list = await apiFetch<CommunityPost[]>(`/posts${qs}`);
      setPosts(list || []);
    } catch {
      setPosts([]);
    }
  }, []);

  useEffect(() => {
    let unsubscribe = () => {};
    try {
      const auth = getFirebaseAuth();
      unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
        setLoading(true);
        if (!fbUser) {
          setUser(null);
          setChallenges([]);
          setDailyVibes([]);
          setPosts([]);
          setUserProgress(null);
          setLoading(false);
          return;
        }

        try {
          const me = await apiFetch<User>('/auth/me');
          setUser(me);
          await Promise.all([refreshUserData(), refreshPosts()]);
        } catch {
          setUser(null);
        } finally {
          setLoading(false);
        }
      });
    } catch {
      // Firebase web config not set yet.
      setUser(null);
      setLoading(false);
    }

    return () => unsubscribe();
  }, [refreshPosts, refreshUserData]);

  const login = useCallback(
    async (email: string, password: string) => {
      setAuthBusy(true);
      try {
        const auth = getFirebaseAuth();
        const cred = await signInWithEmailAndPassword(auth, email, password);
        const idToken = await cred.user.getIdToken(true);
        const me = await apiFetch<User>('/auth/me', undefined, idToken);
        setUser(me);
        await Promise.all([refreshUserData(), refreshPosts()]);
      } finally {
        setAuthBusy(false);
      }
    },
    [refreshPosts, refreshUserData]
  );

  const bootstrapProfile = useCallback(
    async (payload: BootstrapPayload) => {
      setAuthBusy(true);
      try {
        // Some backend instances may still validate `phone` as required on /auth/bootstrap.
        // Send an empty value when the UI doesn't collect a phone number.
        const normalizedPayload: BootstrapPayload & { phone: string } = {
          ...payload,
          phone: payload.phone ?? '',
        };
        const updated = await apiFetch<User>('/auth/bootstrap', {
          method: 'POST',
          body: JSON.stringify(normalizedPayload),
        });
        setUser(updated);
        await Promise.all([refreshUserData(), refreshPosts()]);
      } finally {
        setAuthBusy(false);
      }
    },
    [refreshPosts, refreshUserData]
  );

  const logout = useCallback(async () => {
    try {
      await signOut(getFirebaseAuth());
    } catch {
      // ignore
    } finally {
      setUser(null);
      setChallenges([]);
      setDailyVibes([]);
      setPosts([]);
      setUserProgress(null);
    }
  }, []);

  const updateProfile = useCallback(
    async (updates: Partial<Omit<User, 'uid'>>) => {
      const updated = await apiFetch<User>('/users/me', {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      setUser(updated);
    },
    []
  );

  const updateBuddy = useCallback(
    async (buddyPersona: BuddyPersona) => {
      await updateProfile({ buddyPersona });
    },
    [updateProfile]
  );

  const contextValue = useMemo<AuthContextType>(
    () => ({
      user,
      loading,
      authBusy,
      challenges,
      setChallenges,
      dailyVibes,
      setDailyVibes,
      posts,
      setPosts,
      userProgress,
      setUserProgress,
      streak: user?.streak || 0,
      login,
      bootstrapProfile,
      logout,
      refreshPosts,
      refreshUserData,
      updateProfile,
      updateBuddy,
    }),
    [
      challenges,
      dailyVibes,
      authBusy,
      loading,
      login,
      logout,
      posts,
      refreshPosts,
      refreshUserData,
      bootstrapProfile,
      updateBuddy,
      updateProfile,
      user,
      userProgress,
    ]
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

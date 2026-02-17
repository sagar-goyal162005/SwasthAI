'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { User, KeyRound, Mail, ArrowLeft, Calendar, Eye, EyeOff, BadgeCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Icons } from '@/components/icons';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { nanoid } from 'nanoid';
import DoshaQuiz from '@/components/dosha-quiz';
import type { DoshaResult } from '@/lib/dosha-quiz';
import { useAuth } from '@/context/auth-context';
import { getFirebaseAuth } from '@/lib/firebase';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';

type SignupStep = 'basic-info' | 'dosha-quiz' | 'completing';

function digitsOnly(input: string): string {
  return (input || '').replace(/\D/g, '');
}

function validatePassword(password: string): string | null {
  if (!/[A-Z]/.test(password)) return 'Password must include at least 1 uppercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must include at least 1 number.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must include at least 1 special character.';
  if (password.length < 8) return 'Password must be at least 8 characters long.';
  return null;
}

function firebaseAuthErrorMessage(err: any): string {
  const code = String(err?.code || '');
  if (code === 'auth/email-already-in-use') return 'This email is already registered. Please sign in instead.';
  if (code === 'auth/invalid-email') return 'Please enter a valid email address.';
  if (code === 'auth/weak-password') return 'Password is too weak. Please use a stronger password.';
  if (code === 'auth/network-request-failed') return 'Network error. Please check your internet connection and try again.';
  if (code === 'auth/too-many-requests') return 'Too many attempts. Please try again later.';
  if (code === 'auth/operation-not-allowed')
    return 'Email/Password sign-in is not enabled. Enable it in Firebase Console → Authentication → Sign-in method.';
  if (code === 'auth/wrong-password' || code === 'auth/invalid-credential')
    return 'Incorrect password for this email. Please try again or use “Sign In”.';
  return err?.message || 'An unexpected error occurred. Please try again.';
}

export default function SignupClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { bootstrapProfile } = useAuth();
  const [currentStep, setCurrentStep] = useState<SignupStep>('basic-info');
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other' | 'Prefer not to say' | ''>('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [doshaResult, setDoshaResult] = useState<DoshaResult | null>(null);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [verificationEmailSent, setVerificationEmailSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);

  const refreshEmailVerified = async (): Promise<boolean | null> => {
    const auth = getFirebaseAuth();
    const user = auth.currentUser;
    if (!user) return null;
    try {
      await user.reload();
    } catch {
      return null;
    }
    const verified = !!user.emailVerified;
    setEmailVerified(verified);
    if (verified) {
      setInfo('Email verified successfully. You can continue.');
    }
    // If not verified yet, force-refresh the ID token once. This can help
    // reduce the time until the updated emailVerified state is visible.
    if (!verified) {
      try {
        await user.getIdToken(true);
      } catch {
        // ignore
      }
    }
    return verified;
  };

  const refreshEmailVerifiedWithRetry = async (maxAttempts = 6): Promise<boolean> => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const verified = await refreshEmailVerified();
      if (verified) return true;
      // Backoff: 0ms, 300ms, 600ms, 900ms, 1200ms, 1500ms
      const delayMs = attempt === 0 ? 0 : attempt * 300;
      if (delayMs) {
        await new Promise((r) => window.setTimeout(r, delayMs));
      }
    }
    return false;
  };

  useEffect(() => {
    const fromVerification = searchParams?.get('verified') === '1';
    if (fromVerification) {
      setVerificationEmailSent(true);
      // Only check verification when the user explicitly returns from the email link.
      // Retry briefly to reduce propagation delay from Firebase Auth.
      void refreshEmailVerifiedWithRetry();
    } else {
      setEmailVerified(false);
      setVerificationEmailSent(false);
      setInfo('');
      setError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-detect verification only when the user returns to this tab/window.
  // This avoids showing "verified" before the email link is clicked.
  useEffect(() => {
    if (!verificationEmailSent || emailVerified) return;

    const onFocus = () => {
      void refreshEmailVerifiedWithRetry(4);
    };

    const onVisibility = () => {
      if (!document.hidden) void refreshEmailVerifiedWithRetry(4);
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [verificationEmailSent, emailVerified]);

  // If the email changes, reset verification UI.
  useEffect(() => {
    setEmailVerified(false);
    setVerificationEmailSent(false);
    setInfo('');
    setError('');

    // Avoid stale auth state from a previously signed-in user when changing email.
    // This keeps the UI consistent with the current email being verified.
    try {
      const auth = getFirebaseAuth();
      if (auth.currentUser) {
        void signOut(auth);
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  const handleBasicInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');

    if (!emailVerified) {
      // Re-check on demand (user may have clicked the email link in another tab).
      const verified = await refreshEmailVerified();
      if (!verified) {
        setError('Please verify your email before continuing.');
        return;
      }
    }

    const passwordIssue = validatePassword(password);
    if (passwordIssue) {
      setError(passwordIssue);
      return;
    }

    if (!email) {
      setError('Email is required.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    // Move to dosha quiz step
    setCurrentStep('dosha-quiz');
  };

  const handleDoshaComplete = (result: DoshaResult) => {
    setDoshaResult(result);
    handleCreateAccount(result);
  };

  const handleCreateAccount = async (dosha: DoshaResult) => {
    setCurrentStep('completing');
    setIsCreatingAccount(true);
    setError('');
    setInfo('');

    try {
      // Ensure the current Firebase user is verified.
      const auth = getFirebaseAuth();
      if (!auth.currentUser) {
        setIsCreatingAccount(false);
        setCurrentStep('basic-info');
        setError('Please verify your email first.');
        return;
      }
      try {
        await auth.currentUser.reload();
      } catch {
        // ignore
      }
      if (!auth.currentUser.emailVerified) {
        setIsCreatingAccount(false);
        setCurrentStep('basic-info');
        setError('Please verify your email first.');
        return;
      }

      const avatarUrl = `https://picsum.photos/seed/${nanoid()}/100/100`;
      await bootstrapProfile({
        name: fullName,
        age: parseInt(age, 10) || 0,
        gender: (gender || 'Prefer not to say') as any,
        avatarUrl,
        dosha: dosha.primary,
        doshaIsBalanced: !!dosha.isBalanced,
      });

      router.push('/dashboard');
    } catch (error: any) {
      setIsCreatingAccount(false);
      setCurrentStep('basic-info');
      setError(error?.message || 'Failed to complete signup. Please try again.');
    }
  };

  const handleSendVerificationEmail = async () => {
    setError('');
    setInfo('');

    const emailTrimmed = (email || '').trim();
    const passwordTrimmed = password || '';
    const confirmTrimmed = confirmPassword || '';

    const passwordIssue = validatePassword(password);
    if (passwordIssue) {
      setError(passwordIssue);
      return;
    }
    if (!emailTrimmed) {
      setError('Email is required.');
      return;
    }
    if (passwordTrimmed !== confirmTrimmed) {
      setError('Passwords do not match.');
      return;
    }

    setIsCreatingAccount(true);
    try {
      const auth = getFirebaseAuth();
      let user = auth.currentUser;

      // If a different user is signed in, sign out before creating/signing in.
      if (user?.email && user.email !== emailTrimmed) {
        await signOut(auth);
        user = null;
      }

      if (!user) {
        try {
          const cred = await createUserWithEmailAndPassword(auth, emailTrimmed, passwordTrimmed);
          user = cred.user;
        } catch (e: any) {
          // If account already exists, sign in and re-send verification.
          if (String(e?.code || '') === 'auth/email-already-in-use') {
            const cred = await signInWithEmailAndPassword(auth, emailTrimmed, passwordTrimmed);
            user = cred.user;
          } else {
            throw e;
          }
        }

        if (user && fullName) {
          try {
            await updateProfile(user, { displayName: fullName });
          } catch {
            // ignore
          }
        }
      } else {
        // Reload to get latest emailVerified state.
        try {
          await user.reload();
        } catch {
          // ignore
        }
      }

      if (!user) throw new Error('Unable to create or sign in user.');

      if (user.emailVerified) {
        setEmailVerified(true);
        setInfo('Email is already verified in Firebase Auth.');
        return;
      }

      // Redirect to our own confirmation page so the user is not stuck on Firebase's default screen.
      const continueUrl = `${window.location.origin}/email-verified`;
      await sendEmailVerification(user, { url: continueUrl });
      setVerificationEmailSent(true);
      setEmailVerified(false);
      setInfo('Verification email sent. Please open your inbox (and spam) and click the link.');
    } catch (e: any) {
      setError(firebaseAuthErrorMessage(e));
    } finally {
      setIsCreatingAccount(false);
    }
  };

  const handleBackToBasicInfo = () => {
    setCurrentStep('basic-info');
  };

  // Render dosha quiz step
  if (currentStep === 'dosha-quiz') {
    return (
      <div className="w-full max-w-4xl space-y-6">
        <div className="flex flex-col items-center space-y-4 text-center mb-6">
          <Icons.logo className="h-8 w-auto" />
          <h1 className="text-2xl font-bold text-gradient">Complete Your Wellness Profile</h1>
        </div>
        <DoshaQuiz onComplete={handleDoshaComplete} onBack={handleBackToBasicInfo} />
      </div>
    );
  }

  // Render completing step
  if (currentStep === 'completing') {
    return (
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center space-y-4 text-center">
          <Icons.logo className="h-8 w-auto" />
          <h2 className="text-xl font-semibold">Creating Your Account...</h2>
          {doshaResult && (
            <div className="text-center gradient-border-card p-6 rounded-xl">
              <div className="gradient-border-card-inner p-4 rounded-2xl bg-card">
                <p className="text-muted-foreground mb-4">
                  Your Dosha: <span className="font-semibold text-gradient">{doshaResult.primary}</span>
                </p>
                <div className="relative w-12 h-12 mx-auto">
                  <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary/30 border-t-primary" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Render basic info step (default)
  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="flex flex-col items-center space-y-4 text-center">
        <Icons.logo className="h-8 w-auto" />
        <h1 className="text-xl font-bold">Create Your SwasthAI Account</h1>
        <p className="text-sm text-muted-foreground">Step 1 of 2: Basic Information</p>
      </div>
      <div className="gradient-border-card">
        <Card className="gradient-border-card-inner rounded-t-3xl bg-card p-8">
          <form
            onSubmit={handleBasicInfoSubmit}
            className="animate-pop-in space-y-4"
            style={{ animationDelay: '0.2s' }}
          >
            <div className="grid gap-2 text-left">
              <Label htmlFor="fullname">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="fullname"
                  type="text"
                  placeholder="Enter full name"
                  required
                  className="pl-10"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2 text-left">
                <Label htmlFor="age">Age</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="age"
                    type="number"
                    placeholder="Enter age"
                    required
                    className="pl-10"
                    value={age}
                    onChange={(e) => setAge(digitsOnly(e.target.value))}
                  />
                </div>
              </div>
              <div className="grid gap-2 text-left">
                <Label htmlFor="gender">Gender</Label>
                <Select required onValueChange={(v) => setGender(v as any)} value={gender}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                    <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2 text-left">
              <Label htmlFor="email">E-mail</Label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter email"
                    required
                    className="pl-10"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isCreatingAccount || !email}
                  onClick={(e) => {
                    e.preventDefault();
                    handleSendVerificationEmail();
                  }}
                >
                  {emailVerified ? 'Verified' : verificationEmailSent ? 'Resend' : 'Verify'}
                </Button>
              </div>

              {/* Intentionally no extra helper text here */}

              <div className="mt-2 space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox id="email-verified" checked={emailVerified} disabled />
                  <Label htmlFor="email-verified" className="text-sm font-normal text-muted-foreground">
                    Email verified
                  </Label>
                </div>
                {error ? (
                  <p className="text-sm text-destructive">{error}</p>
                ) : info ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    {(emailVerified || info.toLowerCase().includes('email verified successfully')) && (
                      <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                    )}
                    <span>{info}</span>
                  </p>
                ) : null}
              </div>
            </div>
            <div className="grid gap-2 text-left">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  required
                  className="pl-10 pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="grid gap-2 text-left">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  required
                  className="pl-10 pr-10"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Checkbox id="terms" required />
              <Label htmlFor="terms" className="text-sm font-normal text-muted-foreground">
                Allow Terms & Conditions
              </Label>
            </div>

            {/* status/errors are shown under the email field */}

            <Button
              variant="gradient"
              size="lg"
              className="w-full text-lg font-bold"
              type="submit"
              disabled={!emailVerified}
            >
              Next: Discover Your Dosha 🕉️
            </Button>
          </form>
        </Card>
      </div>
      <div className="flex justify-between items-center text-sm">
        <Button variant="ghost" asChild>
          <Link href="/login">
            <ArrowLeft className="mr-2 h-4 w-4" />Back
          </Link>
        </Button>
        <p className="text-center text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}

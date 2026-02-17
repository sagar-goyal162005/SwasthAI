
'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent } from './ui/card';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { Icons } from '@/components/icons';

type RobotState = 'idle' | 'peeking' | 'wrong' | 'correct';

export function AnimatedLogin() {
  const router = useRouter();
  const { login, authBusy } = useAuth();
  const [robotState, setRobotState] = useState<RobotState>('idle');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (robotState === 'wrong' || robotState === 'correct') {
      const timer = setTimeout(() => {
        setRobotState(password.length > 0 ? 'peeking' : 'idle');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [robotState, password]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      setBusy(true);
      await login(email, password);
        setRobotState('correct');
      router.push('/dashboard');
    } catch (error: any) {
        setRobotState('wrong');
      setError(error?.message || 'Invalid credentials. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    setError('');
    if (e.target.value.length > 0) {
      if (robotState !== 'peeking') {
        setRobotState('peeking');
      }
    } else {
      setRobotState('idle');
    }
  };

  const handleLoginIdFocus = () => {
    if (password.length === 0) {
      setRobotState('idle');
    }
  }


  return (
    <div className="w-full max-w-sm mx-auto">
        <div className="mx-auto mb-5 flex w-full items-center justify-center">
          <motion.div
            className="h-24 w-24"
            animate={robotState === 'correct' ? { y: [0, -8, 0], scale: [1, 1.04, 1] } : {}}
            transition={robotState === 'correct' ? { duration: 0.6, ease: 'easeInOut' } : {}}
          >
            <Icons.logo className="h-full w-full" />
          </motion.div>
        </div>
        <div className="gradient-border-card">
          <Card className="gradient-border-card-inner rounded-2xl">
              <CardContent className="p-6">
                  <form onSubmit={handleLogin} className="space-y-4">
                       <div className="grid gap-2">
                          <Label htmlFor="email">Email</Label>
                          <Input 
                              variant="gradient"
                            id="email" 
                            type="email" 
                            placeholder="Enter your email" 
                              required 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onFocus={handleLoginIdFocus}
                              onBlur={() => setRobotState(password.length > 0 ? 'peeking' : 'idle')}
                          />
                    </div>
                       <div className="grid gap-2">
                          <Label htmlFor="password">Password</Label>
                          <div className="relative">
                            <Input 
                                variant="gradient"
                                id="password" 
                                type={showPassword ? "text" : "password"}
                                required
                                value={password}
                                onChange={handlePasswordChange}
                                className="pr-10"
                             />
                             <button
                               type="button"
                               onClick={() => setShowPassword(!showPassword)}
                               className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                             >
                               {showPassword ? (
                                 <EyeOff className="h-4 w-4" />
                               ) : (
                                 <Eye className="h-4 w-4" />
                               )}
                             </button>
                           </div>
                      </div>
                      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
                      <div className="flex items-center justify-between pt-2">
                          <div className="flex items-center space-x-2">
                              <Checkbox id="remember-me" />
                              <Label htmlFor="remember-me" className="text-sm font-normal text-muted-foreground">Remember me</Label>
                          </div>
                          <a href="#" className="text-sm font-medium text-primary hover:underline">Forgot password?</a>
                      </div>
                      <Button
                        variant="gradient"
                        type="submit"
                        className="w-full !mt-6"
                        size="lg"
                        disabled={authBusy || busy || robotState === 'correct'}
                      >
                        {robotState === 'correct' ? 'Success!' : 'Sign In'}
                      </Button>
                </form>
                 <div className="mt-4 text-center text-sm text-muted-foreground">
                    Don&apos;t have an account?{' '}
                    <Button variant="link" asChild className="p-0">
                        <Link href="/signup">
                            Sign Up <ArrowRight className="ml-1 h-4 w-4" />
                        </Link>
                    </Button>
                </div>
              </CardContent>
          </Card>
        </div>
    </div>
  );
}

    

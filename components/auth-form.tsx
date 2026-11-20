'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/brand';
import { api, ApiError } from '@/lib/api';
import { useSession, type SessionUser } from '@/lib/use-session';

export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter();
  const { user, setUser } = useSession();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const signup = mode === 'signup';

  useEffect(() => {
    if (user) router.replace('/dashboard');
  }, [user, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});
    try {
      const u = await api<SessionUser>(`/api/auth/${mode}`, {
        method: 'POST',
        json: signup ? { name, email, password } : { email, password },
      });
      setUser(u);
      router.push('/dashboard');
    } catch (err) {
      if (err instanceof ApiError && err.fields) setFields(err.fields);
      else setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  const fieldError = (k: string) =>
    fields[k] ? <p id={`${k}-err`} className="flex items-center gap-1.5 text-xs text-red-300"><AlertCircle className="size-3.5" />{fields[k]}</p> : null;

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col justify-between border-r bg-card p-8 max-lg:hidden">
        <Logo />
        <div>
          <p className="eyebrow mb-3">[Open source · MIT]</p>
          <p className="max-w-md text-3xl font-semibold leading-tight tracking-tight">Write your resume in LaTeX. Own every byte of it.</p>
          <p className="mt-4 max-w-md text-muted-foreground">Live PDF preview, an AI assistant with your own key, and an MCP server — on your infrastructure.</p>
        </div>
        <p className="font-mono text-xs text-muted-foreground">No plans · No billing · No tracking</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <Logo className="mb-8 lg:hidden" />
          <h1 className="text-2xl font-semibold tracking-tight">{signup ? 'Create your account' : 'Welcome back'}</h1>
          <p className="mb-6 mt-1 text-sm text-muted-foreground">{signup ? 'Your data stays in your own database.' : 'Sign in to your resumes.'}</p>
          <form onSubmit={submit} className="space-y-4" noValidate>
            {error && <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200"><AlertCircle className="mt-0.5 size-4 shrink-0" />{error}</p>}
            {signup && (
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!fields.name} aria-describedby={fields.name ? 'name-err' : undefined} required />
                {fieldError('name')}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!fields.email} aria-describedby={fields.email ? 'email-err' : undefined} required />
              {fieldError('email')}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" autoComplete={signup ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!fields.password} aria-describedby={fields.password ? 'password-err' : undefined} required />
              {fieldError('password')}
              {signup && !fields.password && <p className="text-xs text-muted-foreground">At least 8 characters, with an uppercase letter and a number.</p>}
            </div>
            <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Please wait…' : signup ? 'Create account' : 'Sign in'}</Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            {signup ? 'Already have an account? ' : "Don't have an account? "}
            <Link className="text-primary underline underline-offset-4" href={signup ? '/auth/login' : '/auth/signup'}>{signup ? 'Sign in' : 'Sign up'}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

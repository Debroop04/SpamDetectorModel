'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Callout } from '@/components/ui/feedback';

export default function RegisterPage() {
  const { register, user, ready } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && user) router.replace('/dashboard');
  }, [ready, user, router]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await register(name.trim(), email.trim(), password);
      router.replace('/settings?setup=1');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the account');
      setBusy(false);
    }
  }

  return (
    <div className="animate-in">
      <h1 className="mb-8 text-[30px] leading-tight font-semibold tracking-tight text-ink">Create your account</h1>
      <form onSubmit={submit} className="space-y-4">
        {error && <Callout tone="danger">{error}</Callout>}
        <Field label="Full name">
          {(id) => <Input id={id} className="h-11 rounded-xl" autoComplete="name" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label="Email">
          {(id) => <Input id={id} className="h-11 rounded-xl" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
        <Field label="Password" hint="At least 8 characters">
          {(id) => (
            <Input id={id} className="h-11 rounded-xl" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          )}
        </Field>
        <Button type="submit" size="lg" className="h-12 w-full rounded-xl" loading={busy}>
          Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-3">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-accent hover:text-accent-hover">
          Sign in
        </Link>
      </p>
    </div>
  );
}

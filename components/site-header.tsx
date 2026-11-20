'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/brand';
import { useSession } from '@/lib/use-session';
import { REPO_URL } from '@/lib/config';

/** Header for public pages (landing). */
export function SiteHeader() {
  const { user } = useSession();
  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Logo href="/" />
        <nav className="flex items-center gap-1 sm:gap-2">
          {REPO_URL && (
            <Button asChild variant="ghost" size="sm">
              <a href={REPO_URL} target="_blank" rel="noreferrer">GitHub</a>
            </Button>
          )}
          {user ? (
            <Button asChild size="sm"><Link href="/dashboard">Open dashboard</Link></Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm"><Link href="/auth/login">Sign in</Link></Button>
              <Button asChild size="sm"><Link href="/auth/signup">Get started</Link></Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

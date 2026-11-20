'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FilePlus2, FolderOpen, KeyRound, LogOut, Settings } from 'lucide-react';
import { Logo } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/use-session';
import { cn } from '@/lib/utils';
import { REPO_URL } from '@/lib/config';

const NAV = [
  { href: '/dashboard', label: 'Resumes', icon: FolderOpen, match: (p: string) => p === '/dashboard' || p.startsWith('/dashboard/resumes') },
  { href: '/dashboard/new', label: 'New resume', icon: FilePlus2, match: (p: string) => p === '/dashboard/new' },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings, match: (p: string) => p === '/dashboard/settings' },
  { href: '/dashboard/settings#tokens', label: 'MCP & API tokens', icon: KeyRound, match: () => false },
];

/** Authenticated layout: sidebar on desktop, compact top bar on mobile. */
export function AppShell({ children, title, actions }: { children: React.ReactNode; title?: string; actions?: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useSession();
  return (
    <div className="min-h-screen md:grid md:grid-cols-[15rem_1fr]">
      <aside className="hidden flex-col border-r bg-sidebar md:flex">
        <div className="flex h-14 items-center border-b px-4"><Logo href="/dashboard" /></div>
        <nav className="flex-1 space-y-1 p-3" aria-label="Main">
          {NAV.map(({ href, label, icon: Icon, match }) => (
            <Link
              key={label}
              href={href}
              aria-current={match(pathname) ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground',
                match(pathname) && 'bg-sidebar-accent text-foreground',
              )}
            >
              <Icon className="size-4" /> {label}
            </Link>
          ))}
          {REPO_URL && (
            <a href={REPO_URL} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground">
              <span className="grid size-4 place-items-center font-mono text-[10px]">↗</span> Source code
            </a>
          )}
        </nav>
        <div className="border-t p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <span aria-hidden className="grid size-8 place-items-center rounded-full bg-secondary text-sm font-semibold">{user?.name?.[0]?.toUpperCase() ?? '?'}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user?.name}</p>
              <p className="truncate font-mono text-[11px] text-muted-foreground">{user?.email}</p>
            </div>
            <Button variant="ghost" size="icon-sm" aria-label="Log out" onClick={logout}><LogOut className="size-4" /></Button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="flex h-14 items-center justify-between gap-3 border-b px-4 md:px-8">
          <div className="md:hidden"><Logo href="/dashboard" showBadge={false} /></div>
          <h1 className="hidden text-sm font-medium text-muted-foreground md:block">{title}</h1>
          <div className="flex items-center gap-2">
            {actions}
            <div className="flex gap-1 md:hidden">
              <Button asChild variant="ghost" size="icon-sm" aria-label="Settings"><Link href="/dashboard/settings"><Settings className="size-4" /></Link></Button>
              <Button variant="ghost" size="icon-sm" aria-label="Log out" onClick={logout}><LogOut className="size-4" /></Button>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-8">{children}</main>
      </div>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { FilePlus2, Globe, Lock, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AppShell } from '@/components/app-shell';
import { api } from '@/lib/api';
import { useRequireUser } from '@/lib/use-session';

interface ResumeSummary { id: string; title: string; isPublished: boolean; updatedAt: string; preview: string[] }

function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function DashboardPage() {
  const { user, loading } = useRequireUser();
  const [resumes, setResumes] = useState<ResumeSummary[] | null>(null);
  const [toDelete, setToDelete] = useState<ResumeSummary | null>(null);
  const [query, setQuery] = useState('');

  const load = useCallback(() => {
    api<ResumeSummary[]>('/api/resumes').then(setResumes).catch((e) => toast.error(e.message));
  }, []);
  useEffect(() => { if (user) load(); }, [user, load]);

  async function remove() {
    if (!toDelete) return;
    try {
      await api(`/api/resumes/${toDelete.id}`, { method: 'DELETE' });
      toast.success('Resume deleted');
      setToDelete(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  if (loading || !user) return <div className="p-8 text-muted-foreground">Loading…</div>;
  const shown = resumes?.filter((r) => r.title.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <AppShell title="Resumes">
      <p className="eyebrow mb-2">Workspace</p>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">Your resumes</h2>
          <p className="mt-1 text-muted-foreground">Edit, compile and publish your LaTeX resumes.</p>
        </div>
        <div className="flex items-center gap-2">
          {resumes && resumes.length > 3 && (
            <input
              type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by title…" aria-label="Filter resumes"
              className="h-9 w-44 rounded-lg border border-input bg-transparent px-3 text-sm placeholder:text-muted-foreground"
            />
          )}
          <Button asChild><Link href="/dashboard/new"><Plus className="size-4" /> New resume</Link></Button>
        </div>
      </div>

      {shown === undefined ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-52" />)}</div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((r) => (
            <li key={r.id}>
              <article className="surface-card group flex h-full flex-col p-5 transition-colors hover:border-ring/60">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/dashboard/resumes/${r.id}`} className="flex min-w-0 items-center gap-3 after:absolute after:inset-0 focus-visible:outline-none">
                    <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary font-mono text-[11px] font-bold">TeX</span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold tracking-tight">{r.title}</span>
                      <span className="block font-mono text-xs text-muted-foreground">resume.tex</span>
                    </span>
                  </Link>
                  <span className={`relative z-10 flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[11px] ${r.isPublished ? 'border-success/40 text-success' : 'text-muted-foreground'}`}>
                    {r.isPublished ? <Globe className="size-3" /> : <Lock className="size-3" />}{r.isPublished ? 'Public' : 'Private'}
                  </span>
                </div>
                <pre className="mt-4 flex-1 overflow-hidden rounded-lg border bg-surface-lowest p-3 font-mono text-xs leading-5 text-muted-foreground" aria-hidden>
                  {r.preview.length ? r.preview.map((l, i) => <div key={i} className="truncate">{l}</div>) : '(empty)'}
                </pre>
                <div className="relative z-10 mt-4 flex items-center justify-between">
                  <span className="font-mono text-xs text-muted-foreground">Updated {timeAgo(r.updatedAt)}</span>
                  <Button variant="ghost" size="icon-sm" aria-label={`Delete ${r.title}`} onClick={() => setToDelete(r)}><Trash2 className="size-4" /></Button>
                </div>
              </article>
            </li>
          ))}
          <li className={resumes?.length ? undefined : 'sm:col-span-2 xl:col-span-3'}>
            <Link href="/dashboard/new" className="flex h-full min-h-52 flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-center text-muted-foreground transition-colors hover:border-ring hover:text-foreground">
              <span className="grid size-10 place-items-center rounded-full bg-secondary"><FilePlus2 className="size-5" /></span>
              <span className="font-medium text-foreground">{resumes?.length ? 'Create a new resume' : 'Create your first resume'}</span>
              <span className="text-sm">Start from a template or a blank document.</span>
            </Link>
          </li>
        </ul>
      )}
      {shown && shown.length === 0 && query && <p className="mt-6 text-sm text-muted-foreground">No resumes match “{query}”.</p>}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{toDelete?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes the resume, its PDF and its chat history. This can’t be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={remove}>Delete resume</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

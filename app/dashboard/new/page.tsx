'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AppShell } from '@/components/app-shell';
import { api } from '@/lib/api';
import { useRequireUser } from '@/lib/use-session';
import { cn } from '@/lib/utils';

interface TemplateInfo { id: string; name: string; description: string; tags: string[] }

export default function NewResumePage() {
  const { user, loading } = useRequireUser();
  const router = useRouter();
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [templateId, setTemplateId] = useState('classic');
  const [title, setTitle] = useState('My Resume');
  const [busy, setBusy] = useState(false);

  useEffect(() => { api<TemplateInfo[]>('/api/templates').then(setTemplates).catch(() => {}); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api<{ id: string }>('/api/resumes', { method: 'POST', json: { title, templateId } });
      router.push(`/dashboard/resumes/${r.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create resume');
      setBusy(false);
    }
  }

  if (loading || !user) return <div className="p-8 text-muted-foreground">Loading…</div>;

  return (
    <AppShell title="New resume">
      <p className="eyebrow mb-2">Quick scaffolding</p>
      <h2 className="text-3xl font-semibold tracking-tight">Create a resume</h2>
      <p className="mb-8 mt-1 text-muted-foreground">Pick a starting template. You can edit every line of LaTeX afterwards.</p>
      <form onSubmit={create} className="space-y-8">
        <div className="max-w-md space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required />
        </div>
        <fieldset>
          <legend className="mb-3 text-sm font-medium">Template</legend>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {templates.map((t) => {
              const selected = templateId === t.id;
              return (
                <label key={t.id} className={cn('surface-card relative cursor-pointer p-5 transition-colors hover:border-ring/60 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring', selected && 'border-ring bg-surface ring-1 ring-ring')}>
                  <input type="radio" name="template" value={t.id} checked={selected} onChange={() => setTemplateId(t.id)} className="sr-only" />
                  {selected && <span className="absolute right-3 top-3 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="size-3" /></span>}
                  <div className="mb-3 space-y-1 rounded-md border bg-surface-lowest p-3" aria-hidden>
                    <div className="mx-auto h-1.5 w-1/2 rounded bg-muted-foreground/60" />
                    {[70, 90, 60, 80].map((w, i) => <div key={i} className="h-1 rounded bg-border" style={{ width: `${w}%` }} />)}
                  </div>
                  <div className="font-semibold tracking-tight">{t.name}</div>
                  <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">{t.tags.map((g) => <span key={g} className="code-chip">{g}</span>)}</div>
                </label>
              );
            })}
          </div>
        </fieldset>
        <Button type="submit" size="lg" disabled={busy || !title.trim()}>{busy ? 'Creating…' : 'Create resume'}</Button>
      </form>
    </AppShell>
  );
}

'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { ResumeEditor, type ResumeData } from '@/components/resume-editor';
import { api } from '@/lib/api';
import { useRequireUser } from '@/lib/use-session';

export default function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading } = useRequireUser();
  const [resume, setResume] = useState<ResumeData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api<ResumeData & { publicPath?: string }>(`/api/resumes/${id}`).then(setResume).catch((e) => setError(e.message));
  }, [user, id]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <p className="text-lg font-semibold">{error}</p>
        <Link className="underline" href="/dashboard">Back to dashboard</Link>
      </div>
    );
  }
  if (loading || !user || !resume) return <div className="p-8 text-muted-foreground">Loading…</div>;
  return <ResumeEditor initial={resume} />;
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Download } from 'lucide-react';
import { getPublished } from '@/lib/resumes';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = await getPublished((await params).slug);
  return { title: r ? `${r.title}${r.author ? ` — ${r.author}` : ''}` : 'Not found' };
}

export default async function PublicResume({ params }: Props) {
  const { slug } = await params;
  const r = await getPublished(slug);
  if (!r) notFound();
  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b bg-card px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" aria-label="LaTeXResume home" className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary font-mono text-[11px] font-bold text-primary-foreground">TeX</Link>
          <p className="truncate text-sm font-medium">{r.title}{r.author && <span className="font-normal text-muted-foreground"> · {r.author}</span>}</p>
        </div>
        <div className="flex shrink-0 items-center gap-4 text-sm">
          {r.hasPdf && (
            <a className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 hover:bg-accent" href={`/api/public/${slug}/pdf`} download="resume.pdf"><Download className="size-4" /> Download PDF</a>
          )}
          <Link className="hidden font-mono text-xs text-muted-foreground underline-offset-4 hover:underline sm:inline" href="/">Made with LaTeXResume</Link>
        </div>
      </header>
      {r.hasPdf ? (
        <iframe src={`/api/public/${slug}/pdf`} title={r.title} className="min-h-0 flex-1 border-0 bg-white" />
      ) : (
        <p className="m-auto text-muted-foreground">This resume has not been compiled yet.</p>
      )}
    </div>
  );
}

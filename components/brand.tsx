import Link from 'next/link';
import { cn } from '@/lib/utils';

export function Logo({ href = '/', className, showBadge = true }: { href?: string; className?: string; showBadge?: boolean }) {
  return (
    <Link href={href} className={cn('flex items-center gap-2.5 font-semibold tracking-tight', className)}>
      <span aria-hidden className="grid size-7 place-items-center rounded-lg bg-primary font-mono text-[11px] font-bold text-primary-foreground">
        TeX
      </span>
      <span>LaTeXResume</span>
      {showBadge && <span className="rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">MIT</span>}
    </Link>
  );
}

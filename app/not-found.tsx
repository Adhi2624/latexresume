import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/brand';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <Logo />
      <p className="eyebrow">Error 404</p>
      <h1 className="text-3xl font-semibold tracking-tight">This page could not be found</h1>
      <p className="max-w-md text-muted-foreground">The link may be wrong, or the resume was unpublished or deleted.</p>
      <Button asChild><Link href="/">Back to home</Link></Button>
    </div>
  );
}

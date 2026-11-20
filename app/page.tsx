import Link from 'next/link';
import { ArrowRight, Bot, Cloud, FileCode2, Lock, Plug, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SiteHeader } from '@/components/site-header';
import { REPO_URL } from '@/lib/config';
import { Logo } from '@/components/brand';

const features = [
  { icon: FileCode2, title: 'Real LaTeX, live PDF', body: 'A Monaco editor with one-click compilation by a real TeX Live compiler. Your resume is a plain .tex file you can take anywhere.', tag: 'pdflatex · TeX Live' },
  { icon: Bot, title: 'Bring your own AI', body: 'Chat with OpenAI, Anthropic, or any OpenAI-compatible endpoint such as Ollama or OpenRouter. Keys are stored AES-GCM encrypted.', tag: 'Ollama · Claude · GPT' },
  { icon: Plug, title: 'Built-in MCP server', body: 'Let Claude, Cursor or any MCP client list, edit, compile and publish your resumes through a single endpoint.', tag: 'POST /mcp' },
  { icon: Share2, title: 'Publish a public link', body: 'Share a read-only page with your compiled PDF at /r/<slug>, and unpublish it with one click.', tag: '/r/your-slug' },
  { icon: Cloud, title: 'Runs on Cloudflare Workers', body: 'Deploy the app to Workers with MongoDB Atlas, or run everything locally with Docker and MongoDB Community.', tag: 'wrangler deploy' },
  { icon: Lock, title: 'Self-hosted & private', body: 'MIT licensed. No telemetry, no plans, no paywalls. Close registration once your own account exists.', tag: 'ALLOW_SIGNUP=false' },
];

const sampleTex = [
  [`\\documentclass`, `[11pt]{article}`],
  [`\\usepackage`, `[margin=0.8in]{geometry}`],
  [``, ``],
  [`\\begin`, `{document}`],
  [`  \\section*`, `{Jane Doe}`],
  [`  \\textbf`, `{Senior Software Engineer}`],
  [`  \\hfill 2022 -- Present`, ``],
  [`  \\begin`, `{itemize}`],
  [`    \\item `, `Led a team of five engineers…`],
  [`  \\end`, `{itemize}`],
  [`\\end`, `{document}`],
];

export default function Home() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main>
        <section className="mx-auto max-w-6xl px-4 pb-12 pt-16 sm:pt-24">
          <p className="eyebrow mb-4">[01 / Open-source LaTeX resume builder]</p>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.03em] sm:text-6xl">Your resume, written in LaTeX.</h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            Edit, compile and publish professional resumes with an AI assistant and an MCP server — all MIT licensed.
            Self-host it in minutes, or deploy it globally to Cloudflare Workers with MongoDB.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg"><Link href="/auth/signup">Create an account <ArrowRight className="size-4" /></Link></Button>
            {REPO_URL && <Button asChild size="lg" variant="outline"><a href={REPO_URL} target="_blank" rel="noreferrer">View on GitHub</a></Button>}
          </div>
          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 font-mono text-xs text-muted-foreground">
            {['Free forever', 'No plans', 'No billing', 'No tracking'].map((t) => (
              <li key={t} className="flex items-center gap-2"><span aria-hidden className="size-1.5 rounded-full bg-success" />{t}</li>
            ))}
          </ul>
        </section>

        <section aria-label="Editor preview" className="mx-auto max-w-6xl px-4 pb-20">
          <div className="overflow-hidden rounded-xl border bg-surface-lowest">
            <div className="flex items-center gap-3 border-b bg-card px-4 py-2.5">
              <span className="flex gap-1.5" aria-hidden><i className="size-2.5 rounded-full bg-border" /><i className="size-2.5 rounded-full bg-border" /><i className="size-2.5 rounded-full bg-border" /></span>
              <span className="rounded-md border bg-background px-2.5 py-1 font-mono text-xs">resume.tex</span>
              <span className="ml-auto font-mono text-xs text-muted-foreground">pdflatex</span>
            </div>
            <div className="grid md:grid-cols-2">
              <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-6" aria-hidden>
                {sampleTex.map(([cmd, rest], i) => (
                  <div key={i}><span className="text-primary">{cmd}</span><span className="text-tertiary">{rest}</span>{!cmd && !rest && ' '}</div>
                ))}
              </pre>
              <div className="border-t bg-[#d9d9de] p-6 md:border-l md:border-t-0" aria-hidden>
                <div className="mx-auto max-w-sm rounded-sm bg-white p-6 text-[11px] leading-snug text-neutral-800 shadow-xl">
                  <p className="text-center font-serif text-xl font-bold tracking-tight text-neutral-900">Jane Doe</p>
                  <p className="mt-1 text-center text-neutral-500">jane@example.com · github.com/janedoe</p>
                  <p className="mt-4 border-b border-neutral-300 pb-0.5 font-bold uppercase tracking-wide text-neutral-900">Experience</p>
                  <p className="mt-2 flex justify-between"><b>Senior Software Engineer</b><span>2022 – Present</span></p>
                  <p className="italic text-neutral-600">Acme Corp, San Francisco</p>
                  <ul className="mt-1 list-disc pl-4 text-neutral-700">
                    <li>Led a team of five engineers to rebuild the billing platform.</li>
                    <li>Raised test coverage from 45% to 90%.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">Illustration. The real editor compiles your document with TeX Live.</p>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20">
          <p className="eyebrow mb-3">[02 / Capabilities]</p>
          <h2 className="max-w-xl text-3xl font-semibold tracking-tight">Everything you need to ship a great resume.</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, body, tag }) => (
              <article key={title} className="surface-card flex flex-col p-6 transition-colors hover:border-ring/60">
                <span className="mb-4 grid size-10 place-items-center rounded-lg border bg-background"><Icon className="size-5 text-primary" /></span>
                <h3 className="font-semibold tracking-tight">{title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
                <p className="mt-4 font-mono text-xs text-primary">{tag}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-24">
          <div className="surface-card grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center md:p-8">
            <div>
              <p className="eyebrow mb-2">[03 / Quick start]</p>
              <h2 className="text-xl font-semibold tracking-tight">Run it locally in a minute</h2>
              <p className="mt-1 text-sm text-muted-foreground">Needs Node 20+, pnpm and Docker (MongoDB Community + the LaTeX compiler).</p>
            </div>
            <pre className="overflow-x-auto rounded-lg border bg-surface-lowest p-4 font-mono text-xs leading-6 text-muted-foreground">
{`pnpm install
docker compose up -d
pnpm dev`}
            </pre>
          </div>
        </section>
      </main>
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-sm text-muted-foreground">
          <Logo showBadge={false} />
          <p className="font-mono text-xs">MIT licensed{REPO_URL && <> · <a className="underline underline-offset-4" href={REPO_URL} target="_blank" rel="noreferrer">Source on GitHub</a></>}</p>
        </div>
      </footer>
    </div>
  );
}

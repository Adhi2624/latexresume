'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { OnMount, BeforeMount } from '@monaco-editor/react';
import { AlertTriangle, ArrowLeft, Check, Copy, Download, Globe, Loader2, Play, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AiChat } from '@/components/ai-chat';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => <div className="p-4 text-sm text-muted-foreground">Loading editor…</div>,
});

export interface ResumeData {
  id: string; title: string; latexSource: string; isPublished: boolean; publicPath?: string;
}

interface CompileIssue { message: string; line?: number; detail?: string; transient?: boolean }

/** Pulls the TeX error line number (`l.42 …`) and the most relevant log excerpt out of a pdflatex log. */
function parseTexError(message: string, log?: string): CompileIssue {
  const line = log?.match(/^l\.(\d+)/m)?.[1];
  const idx = log?.search(/^!/m) ?? -1;
  const detail = log ? (idx >= 0 ? log.slice(idx) : log).trim().slice(0, 1800) : undefined;
  return { message, line: line ? Number(line) : undefined, detail };
}

const beforeMount: BeforeMount = (monaco) => {
  if (!monaco.languages.getLanguages().some((l: { id: string }) => l.id === 'latex')) {
    monaco.languages.register({ id: 'latex' });
    monaco.languages.setMonarchTokensProvider('latex', {
      tokenizer: {
        root: [
          [/%.*$/, 'comment'],
          [/\\(begin|end)\b/, 'keyword'],
          [/\\[a-zA-Z@]+\*?/, 'type'],
          [/\\./, 'type'],
          [/\$\$?/, { token: 'string', next: '@math' }],
          [/[{}[\]]/, 'delimiter.bracket'],
        ],
        math: [[/\$\$?/, { token: 'string', next: '@pop' }], [/[^$]+/, 'string']],
      },
    });
  }
  monaco.editor.defineTheme('latexresume', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'type', foreground: 'c0c1ff' },
      { token: 'keyword', foreground: 'ffb783', fontStyle: 'bold' },
      { token: 'comment', foreground: '6f6e80', fontStyle: 'italic' },
      { token: 'string', foreground: '86e1a8' },
      { token: 'delimiter.bracket', foreground: 'ffb783' },
    ],
    colors: {
      'editor.background': '#0e0e10',
      'editor.lineHighlightBackground': '#1c1b1d',
      'editorLineNumber.foreground': '#4d4c5a',
      'editorLineNumber.activeForeground': '#c7c4d7',
      'editorGutter.background': '#0e0e10',
    },
  });
};

export function ResumeEditor({ initial }: { initial: ResumeData }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [source, setSource] = useState(initial.latexSource);
  const [savedSource, setSavedSource] = useState(initial.latexSource);
  const [savedTitle, setSavedTitle] = useState(initial.title);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [issue, setIssue] = useState<CompileIssue | null>(null);
  const [pub, setPub] = useState({ isPublished: initial.isPublished, publicPath: initial.publicPath });
  const [copied, setCopied] = useState(false);
  const [cursor, setCursor] = useState({ ln: 1, col: 1 });
  const [leaveOpen, setLeaveOpen] = useState(false);
  const urlRef = useRef<string | null>(null);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);

  const dirty = source !== savedSource || title !== savedTitle;

  const setMarker = useCallback((line?: number, message?: string) => {
    const monaco = monacoRef.current;
    const model = editorRef.current?.getModel();
    if (!monaco || !model) return;
    monaco.editor.setModelMarkers(model, 'tex', line && message ? [{
      severity: monaco.MarkerSeverity.Error, message, startLineNumber: line, endLineNumber: line,
      startColumn: 1, endColumn: model.getLineMaxColumn(Math.min(line, model.getLineCount())),
    }] : []);
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await api(`/api/resumes/${initial.id}`, { method: 'PUT', json: { title: title.trim() || 'Untitled', latexSource: source } });
      setSavedSource(source);
      setSavedTitle(title.trim() || 'Untitled');
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
      return false;
    } finally {
      setSaving(false);
    }
  }, [initial.id, source, title]);

  const compile = useCallback(async () => {
    if (compiling) return;
    setCompiling(true);
    setIssue(null);
    setMarker();
    try {
      if (dirty && !(await save())) return;
      const res = await fetch(`/api/resumes/${initial.id}/compile`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const transient = res.status === 503 || res.status === 429;
        const parsed = parseTexError(body.error ?? 'Compilation failed', body.log);
        setIssue({ ...parsed, transient });
        if (!transient) setMarker(parsed.line, parsed.message);
        return;
      }
      const url = URL.createObjectURL(await res.blob());
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = url;
      setPdfUrl(url);
    } catch {
      setIssue({ message: 'Compilation failed. Check your connection and try again.', transient: true });
    } finally {
      setCompiling(false);
    }
  }, [compiling, dirty, save, initial.id, setMarker]);

  // Load the last compiled PDF (if any) on open.
  useEffect(() => {
    fetch(`/api/resumes/${initial.id}/pdf`).then(async (r) => {
      if (r.ok) {
        const url = URL.createObjectURL(await r.blob());
        urlRef.current = url;
        setPdfUrl(url);
      }
    }).catch(() => {});
    return () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); };
  }, [initial.id]);

  // Ctrl/Cmd+S saves, Ctrl/Cmd+Enter compiles.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); void save(); }
      if (mod && e.key === 'Enter') { e.preventDefault(); void compile(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save, compile]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  async function togglePublish() {
    try {
      const r = await api<{ isPublished: boolean; publicPath?: string }>(`/api/resumes/${initial.id}/publish`, { method: pub.isPublished ? 'DELETE' : 'POST' });
      setPub({ isPublished: r.isPublished, publicPath: r.publicPath });
      toast.success(r.isPublished ? 'Published' : 'Unpublished');
      if (r.isPublished && !pdfUrl) toast.info('Compile the resume so the public page has a PDF to show.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  }

  async function copyLink() {
    if (!pub.publicPath) return;
    await navigator.clipboard.writeText(`${location.origin}${pub.publicPath}`).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // Monaco swallows Ctrl/Cmd+S and Ctrl/Cmd+Enter while focused, so register them as editor commands too.
  const actions = useRef({ save, compile });
  actions.current = { save, compile };

  const onMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => void actions.current.save());
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => void actions.current.compile());
    editor.onDidChangeCursorPosition((e) => setCursor({ ln: e.position.lineNumber, col: e.position.column }));
  };

  function goToLine(line: number) {
    editorRef.current?.revealLineInCenter(line);
    editorRef.current?.setPosition({ lineNumber: line, column: 1 });
    editorRef.current?.focus();
  }

  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b bg-card px-3 py-2">
        <Button
          variant="ghost" size="icon-sm" aria-label="Back to dashboard"
          onClick={() => (dirty ? setLeaveOpen(true) : router.push('/dashboard'))}
        ><ArrowLeft className="size-4" /></Button>
        <Input aria-label="Resume title" className="h-8 w-44 font-medium sm:w-60" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
        <span className={cn('flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px]', dirty ? 'border-tertiary/50 text-tertiary' : 'text-muted-foreground')} role="status">
          <span aria-hidden className={cn('size-1.5 rounded-full', saving ? 'animate-pulse bg-primary' : dirty ? 'bg-tertiary' : 'bg-success')} />
          {saving ? 'Saving…' : dirty ? 'Unsaved changes' : 'Saved'}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => void save()} disabled={!dirty || saving}><Save className="size-4" /> Save</Button>
          <Button size="sm" onClick={() => void compile()} disabled={compiling} title="Compile (Ctrl+Enter)">
            {compiling ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} {compiling ? 'Compiling…' : 'Compile'}
          </Button>
          {pdfUrl && <Button asChild size="sm" variant="outline"><a href={pdfUrl} download={`${title || 'resume'}.pdf`}><Download className="size-4" /> PDF</a></Button>}
          <Button size="sm" variant={pub.isPublished ? 'secondary' : 'outline'} onClick={togglePublish}>
            <Globe className="size-4" /> {pub.isPublished ? 'Unpublish' : 'Publish'}
          </Button>
          {pub.isPublished && pub.publicPath && (
            <>
              <a className="hidden font-mono text-xs text-primary underline-offset-4 hover:underline sm:inline" href={pub.publicPath} target="_blank" rel="noreferrer">{pub.publicPath}</a>
              <Button size="icon-sm" variant="ghost" aria-label="Copy public link" onClick={copyLink}>{copied ? <Check className="size-4" /> : <Copy className="size-4" />}</Button>
            </>
          )}
        </div>
      </div>

      <div className="relative grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-cols-2 lg:grid-rows-1">
        {/* Error banner: overlays the panes so the layout never shifts. */}
        {issue && (
          <div role="alert" className={cn('absolute inset-x-0 top-0 z-20 border-b px-4 py-2.5 shadow-lg backdrop-blur', issue.transient ? 'border-tertiary/40 bg-[#3a2410]/95 text-tertiary' : 'border-red-400/40 bg-[#3d0b0f]/95 text-red-100')}>
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium">
                  {issue.transient ? 'Compiler unavailable' : 'Compilation failed'}
                  <span className="ml-2 font-normal opacity-90">{issue.message}</span>
                </p>
                {issue.line && (
                  <button className="mt-0.5 font-mono text-xs underline underline-offset-4" onClick={() => goToLine(issue.line!)}>Go to line {issue.line}</button>
                )}
                {issue.detail && (
                  <details className="mt-1"><summary className="cursor-pointer font-mono text-xs opacity-80">Show TeX log</summary>
                    <pre className="mt-1 max-h-40 overflow-auto rounded bg-black/40 p-2 font-mono text-[11px] leading-4">{issue.detail}</pre>
                  </details>
                )}
              </div>
              <Button variant="ghost" size="icon-sm" aria-label="Dismiss" onClick={() => { setIssue(null); setMarker(); }}><X className="size-4" /></Button>
            </div>
          </div>
        )}

        <div className="flex min-h-0 flex-col border-b lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-2 border-b bg-card px-3 py-1.5">
            <span className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-1 font-mono text-xs">resume.tex{dirty && <span aria-label="unsaved" className="size-1.5 rounded-full bg-tertiary" />}</span>
          </div>
          <div className="min-h-0 flex-1">
            <MonacoEditor
              height="100%"
              language="latex"
              theme="latexresume"
              value={source}
              beforeMount={beforeMount}
              onMount={onMount}
              onChange={(v) => setSource(v ?? '')}
              options={{ minimap: { enabled: false }, fontSize: 13, fontFamily: 'var(--font-jetbrains), ui-monospace, monospace', wordWrap: 'on', scrollBeyondLastLine: false, padding: { top: 12 }, renderLineHighlight: 'line' }}
            />
          </div>
          <div className="flex items-center gap-4 border-t bg-card px-3 py-1 font-mono text-[11px] text-muted-foreground">
            <span>Ln {cursor.ln}, Col {cursor.col}</span><span>UTF-8</span><span>LaTeX</span>
            <span className="ml-auto">{source.split('\n').length} lines</span>
          </div>
        </div>

        <Tabs defaultValue="preview" className="flex min-h-0 flex-col gap-0">
          <TabsList className="m-2 self-start">
            <TabsTrigger value="preview">PDF preview</TabsTrigger>
            <TabsTrigger value="ai">AI assistant</TabsTrigger>
          </TabsList>
          <TabsContent value="preview" className="min-h-0 flex-1">
            {pdfUrl ? (
              <iframe src={pdfUrl} title="PDF preview" className="h-full w-full border-0 bg-white" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
                {compiling ? <><Loader2 className="size-5 animate-spin" /> Compiling…</> : <><p>No preview yet.</p><Button size="sm" onClick={() => void compile()}><Play className="size-4" /> Compile now</Button></>}
              </div>
            )}
          </TabsContent>
          <TabsContent value="ai" className="min-h-0 flex-1">
            <AiChat resumeId={initial.id} onApply={setSource} />
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>You have unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>Save them before leaving, or discard them.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <Button variant="outline" onClick={() => router.push('/dashboard')}>Discard</Button>
            <Button onClick={async () => { if (await save()) router.push('/dashboard'); }}>Save &amp; leave</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

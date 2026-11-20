'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Loader2, Send, Trash2, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';

interface Msg { id: string; role: 'user' | 'assistant'; content: string }

const LATEX_BLOCK = /```(?:latex|tex)\s*\n([\s\S]*?)```/;

export function AiChat({ resumeId, onApply }: { resumeId: string; onApply: (latex: string) => void }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<Msg[]>(`/api/resumes/${resumeId}/chat`).then(setMessages).catch(() => {});
  }, [resumeId]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [messages, busy]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    setMessages((m) => [...m, { id: `tmp-${Date.now()}`, role: 'user', content: text }]);
    setInput('');
    try {
      const reply = await api<Msg>(`/api/resumes/${resumeId}/chat`, { method: 'POST', json: { message: text } });
      setMessages((m) => [...m, reply]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chat failed');
      setMessages((m) => m.slice(0, -1));
      setInput(text);
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    await api(`/api/resumes/${resumeId}/chat`, { method: 'DELETE' }).catch(() => {});
    setMessages([]);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-3" aria-live="polite">
        {messages.length === 0 && !busy && (
          <p className="text-sm text-muted-foreground">
            Ask for help: “Tighten my experience bullets”, “Tailor this for a backend role”, “Add a projects section”.
          </p>
        )}
        {messages.map((m) => {
          const block = m.role === 'assistant' ? m.content.match(LATEX_BLOCK)?.[1] : undefined;
          return (
            <div key={m.id} className={m.role === 'user' ? 'ml-6 rounded-xl bg-primary p-3 text-sm text-primary-foreground' : 'mr-2 rounded-xl border bg-card p-3 text-sm'}>
              <p className="whitespace-pre-wrap break-words">{m.content}</p>
              {block && (
                <Button size="sm" variant="secondary" className="mt-2" onClick={() => { onApply(block); toast.success('Applied to editor — review, then Compile'); }}>
                  <Wand2 className="size-4" /> Apply LaTeX to editor
                </Button>
              )}
            </div>
          );
        })}
        {busy && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Thinking…</div>}
        <div ref={endRef} />
      </div>
      {error && (
        <p role="alert" className="mx-3 mb-2 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error} <Link href="/dashboard/settings" className="underline">Open settings</Link>
        </p>
      )}
      <div className="border-t p-3">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); } }}
          placeholder="Ask the AI assistant… (Ctrl+Enter to send)"
          rows={3}
          aria-label="Message to AI assistant"
        />
        <div className="mt-2 flex justify-between">
          <Button variant="ghost" size="sm" onClick={clear} disabled={!messages.length}><Trash2 className="size-4" /> Clear</Button>
          <Button size="sm" onClick={send} disabled={busy || !input.trim()}><Send className="size-4" /> Send</Button>
        </div>
      </div>
    </div>
  );
}

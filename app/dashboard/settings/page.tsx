'use client';

import { useCallback, useEffect, useState } from 'react';
import { Copy, KeyRound, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AppShell } from '@/components/app-shell';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { api } from '@/lib/api';
import { useRequireUser } from '@/lib/use-session';

interface SettingsData {
  email: string; name: string;
  ai: { provider: 'openai' | 'anthropic'; model: string; baseURL: string; hasApiKey: boolean; serverKeyAvailable: boolean; defaultModels: Record<string, string> };
}
interface TokenInfo { id: string; name: string; prefix: string; createdAt: string; lastUsedAt?: string }

const selectClass = 'h-9 w-full rounded-lg border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';

export default function SettingsPage() {
  const { user, loading } = useRequireUser();
  const [s, setS] = useState<SettingsData | null>(null);
  const [name, setName] = useState('');
  const [provider, setProvider] = useState<'openai' | 'anthropic'>('openai');
  const [model, setModel] = useState('');
  const [baseURL, setBaseURL] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [tokenName, setTokenName] = useState('');
  const [newToken, setNewToken] = useState<string | null>(null);
  const [toRevoke, setToRevoke] = useState<TokenInfo | null>(null);

  const apply = (d: SettingsData) => {
    setS(d); setName(d.name); setProvider(d.ai.provider); setModel(d.ai.model); setBaseURL(d.ai.baseURL); setApiKey('');
  };
  const loadTokens = useCallback(() => { api<TokenInfo[]>('/api/tokens').then(setTokens).catch(() => {}); }, []);

  useEffect(() => {
    if (!user) return;
    api<SettingsData>('/api/settings').then(apply).catch((e) => toast.error(e.message));
    loadTokens();
  }, [user, loadTokens]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    try { apply(await api<SettingsData>('/api/settings', { method: 'PUT', json: { name } })); toast.success('Profile saved'); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Failed'); }
  }
  async function saveAi(e: React.FormEvent, clearKey = false) {
    e.preventDefault();
    try {
      apply(await api<SettingsData>('/api/settings', { method: 'PUT', json: { ai: { provider, model, baseURL, apiKey: apiKey || undefined, clearKey } } }));
      toast.success(clearKey ? 'API key removed' : 'AI settings saved');
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed'); }
  }
  async function createToken(e: React.FormEvent) {
    e.preventDefault();
    try {
      const t = await api<{ token: string }>('/api/tokens', { method: 'POST', json: { name: tokenName } });
      setNewToken(t.token); setTokenName(''); loadTokens();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed'); }
  }
  async function revoke() {
    if (!toRevoke) return;
    await api(`/api/tokens/${toRevoke.id}`, { method: 'DELETE' })
      .then(() => { toast.success('Token revoked'); setToRevoke(null); loadTokens(); })
      .catch((e) => toast.error(e.message));
  }

  if (loading || !user || !s) return <div className="p-8 text-muted-foreground">Loading…</div>;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <AppShell title="Settings">
      <p className="eyebrow mb-2">Configuration</p>
      <h2 className="mb-8 text-3xl font-semibold tracking-tight">Settings</h2>
      <div className="max-w-2xl space-y-6">

        <Card>
          <CardHeader><CardTitle>Profile</CardTitle><CardDescription>{s.email}</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={saveProfile} className="flex items-end gap-3">
              <div className="flex-1 space-y-2"><Label htmlFor="name">Name</Label><Input id="name" value={name} onChange={(e) => setName(e.target.value)} required /></div>
              <Button type="submit">Save</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI assistant</CardTitle>
            <CardDescription>
              Bring your own key. Use a custom base URL for any OpenAI-compatible server (Ollama, OpenRouter, vLLM…).
              {s.ai.serverKeyAvailable && ' This server also has a default OpenAI key configured.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => saveAi(e)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="provider">Provider</Label>
                <select id="provider" className={selectClass} value={provider} onChange={(e) => setProvider(e.target.value as 'openai' | 'anthropic')}>
                  <option value="openai">OpenAI / OpenAI-compatible</option>
                  <option value="anthropic">Anthropic</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Input id="model" value={model} onChange={(e) => setModel(e.target.value)} placeholder={s.ai.defaultModels[provider]} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="baseurl">Base URL (optional)</Label>
                <Input id="baseurl" value={baseURL} onChange={(e) => setBaseURL(e.target.value)} placeholder="https://api.openai.com/v1" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apikey">API key {s.ai.hasApiKey && <span className="text-xs text-muted-foreground">(saved — leave blank to keep)</span>}</Label>
                <Input id="apikey" type="password" autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={s.ai.hasApiKey ? '••••••••••••' : 'sk-…'} />
              </div>
              <div className="flex gap-2">
                <Button type="submit">Save AI settings</Button>
                {s.ai.hasApiKey && <Button type="button" variant="outline" onClick={(e) => saveAi(e, true)}>Remove key</Button>}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card id="tokens" className="scroll-mt-20">
          <CardHeader>
            <CardTitle>API tokens &amp; MCP</CardTitle>
            <CardDescription>
              Tokens authenticate the REST API and the MCP server at <code className="code-chip">{origin}/mcp</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={createToken} className="flex items-end gap-3">
              <div className="flex-1 space-y-2"><Label htmlFor="tname">New token name</Label><Input id="tname" value={tokenName} onChange={(e) => setTokenName(e.target.value)} placeholder="e.g. Claude Desktop" required maxLength={60} /></div>
              <Button type="submit"><KeyRound className="size-4" /> Create</Button>
            </form>
            {newToken && (
              <div role="status" className="rounded-lg border border-tertiary/40 bg-tertiary/10 p-3 text-sm">
                <p className="mb-2 font-medium">Copy this token now — it won’t be shown again.</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 select-all break-all rounded bg-surface-lowest p-2 font-mono text-xs">{newToken}</code>
                  <Button type="button" size="icon" variant="outline" aria-label="Copy token" onClick={() => { navigator.clipboard.writeText(newToken).catch(() => {}); toast.success('Copied'); }}><Copy className="size-4" /></Button>
                </div>
              </div>
            )}
            <ul className="divide-y rounded-lg border">
              {tokens.length === 0 && <li className="p-3 text-sm text-muted-foreground">No tokens yet.</li>}
              {tokens.map((t) => (
                <li key={t.id} className="flex items-center justify-between p-3 text-sm">
                  <div><span className="font-medium">{t.name}</span> <code className="text-xs text-muted-foreground">{t.prefix}…</code>
                    <div className="text-xs text-muted-foreground">Created {new Date(t.createdAt).toLocaleDateString()}{t.lastUsedAt && ` · last used ${new Date(t.lastUsedAt).toLocaleDateString()}`}</div></div>
                  <Button variant="ghost" size="icon" aria-label={`Revoke ${t.name}`} onClick={() => setToRevoke(t)}><Trash2 className="size-4" /></Button>
                </li>
              ))}
            </ul>
            <details className="text-sm">
              <summary className="cursor-pointer font-medium">Connect an MCP client</summary>
              <pre className="mt-2 overflow-auto rounded-lg border bg-surface-lowest p-3 font-mono text-xs leading-5">{`{
  "mcpServers": {
    "latexresume": {
      "type": "http",
      "url": "${origin}/mcp",
      "headers": { "Authorization": "Bearer lrp_YOUR_TOKEN" }
    }
  }
}`}</pre>
            </details>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!toRevoke} onOpenChange={(o) => !o && setToRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke “{toRevoke?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>Any client using this token (including MCP connections) will stop working immediately.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={revoke}>Revoke token</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

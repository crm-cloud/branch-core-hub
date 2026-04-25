import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, CheckCircle2, XCircle, Zap, Server, Brain, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const PROVIDER_DEFAULTS: Record<string, { base_url: string; secret_name: string; default_model: string; help: string }> = {
  lovable: {
    base_url: 'https://ai.gateway.lovable.dev/v1/chat/completions',
    secret_name: 'LOVABLE_API_KEY',
    default_model: 'google/gemini-2.5-flash',
    help: 'Built-in Lovable AI Gateway. LOVABLE_API_KEY is auto-provisioned — no setup needed. Models: google/gemini-2.5-flash, google/gemini-2.5-pro, openai/gpt-5, openai/gpt-5-mini.',
  },
  openrouter: {
    base_url: 'https://openrouter.ai/api/v1/chat/completions',
    secret_name: 'OPENROUTER_API_KEY',
    default_model: 'meta-llama/llama-3.1-8b-instruct:free',
    help: 'Free tier: many models marked :free. Get key at openrouter.ai/keys.',
  },
  ollama: {
    base_url: 'https://your-vps.example.com/v1/chat/completions',
    secret_name: 'OLLAMA_API_KEY',
    default_model: 'llama3.1:8b',
    help: 'Self-hosted on your VPS. API key optional.',
  },
  deepseek: {
    base_url: 'https://api.deepseek.com/v1/chat/completions',
    secret_name: 'DEEPSEEK_API_KEY',
    default_model: 'deepseek-chat',
    help: 'Very cheap. Get key at platform.deepseek.com.',
  },
  google: {
    base_url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    secret_name: 'GOOGLE_AI_API_KEY',
    default_model: 'gemini-2.0-flash',
    help: 'Google Gemini direct API (OpenAI-compatible). Free tier available. Get key at aistudio.google.com/apikey. Models: gemini-2.0-flash, gemini-2.5-flash, gemini-2.5-pro.',
  },
  groq: {
    base_url: 'https://api.groq.com/openai/v1/chat/completions',
    secret_name: 'GROQ_API_KEY',
    default_model: 'llama-3.3-70b-versatile',
    help: 'Ultra-fast inference, generous free tier. Get key at console.groq.com/keys.',
  },
  together: {
    base_url: 'https://api.together.xyz/v1/chat/completions',
    secret_name: 'TOGETHER_API_KEY',
    default_model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free',
    help: 'Free Llama models available. Get key at api.together.xyz/settings/api-keys.',
  },
  mistral: {
    base_url: 'https://api.mistral.ai/v1/chat/completions',
    secret_name: 'MISTRAL_API_KEY',
    default_model: 'mistral-small-latest',
    help: 'Mistral AI. Get key at console.mistral.ai/api-keys.',
  },
  openai_compatible: {
    base_url: '',
    secret_name: 'CUSTOM_AI_API_KEY',
    default_model: '',
    help: 'Any OpenAI-compatible endpoint (Anthropic-proxy, vLLM, LM Studio, etc.).',
  },
};

const SCOPES = [
  { value: 'all', label: 'All AI calls (global default)' },
  { value: 'whatsapp_ai', label: 'WhatsApp AI Agent' },
  { value: 'lead_scoring', label: 'Lead Scoring' },
  { value: 'fitness_plans', label: 'Fitness Plan Generation' },
  { value: 'dashboard_insights', label: 'Dashboard Insights' },
  { value: 'lead_nurture', label: 'Lead Nurture Follow-ups' },
];

interface ProviderRow {
  id: string;
  provider: string;
  display_name: string;
  base_url: string | null;
  api_key_secret_name: string | null;
  default_model: string;
  scope: string;
  is_active: boolean;
  is_default: boolean;
  enable_fallback: boolean;
}

export function AIProvidersSettings() {
  const qc = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<ProviderRow | null>(null);

  const { data: providers = [], isLoading } = useQuery({
    queryKey: ['ai-provider-configs'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('ai_provider_configs')
        .select('*')
        .order('scope')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data as ProviderRow[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('ai_provider_configs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Provider removed');
      qc.invalidateQueries({ queryKey: ['ai-provider-configs'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-violet-600" />
              AI Providers
            </CardTitle>
            <CardDescription>
              Route AI calls to Lovable AI (default), free providers like OpenRouter,
              your self-hosted Ollama VPS, DeepSeek, or any OpenAI-compatible endpoint.
              Set per use-case routing for cost control.
            </CardDescription>
          </div>
          <Button onClick={() => { setEditing(null); setDrawerOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Add Provider
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {providers.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-medium">{p.display_name}</div>
                    <div className="text-xs text-muted-foreground capitalize">{p.provider}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">{p.scope.replace('_', ' ')}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{p.default_model}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {p.is_active ? (
                        <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 w-fit">Active</Badge>
                      ) : (
                        <Badge variant="secondary" className="w-fit">Disabled</Badge>
                      )}
                      {p.is_default && <Badge className="bg-violet-100 text-violet-700 border border-violet-200 w-fit text-[10px]">Default for scope</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => { setEditing(p); setDrawerOpen(true); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {p.provider !== 'lovable' && (
                      <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate(p.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <ProviderDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        editing={editing}
        onSaved={() => qc.invalidateQueries({ queryKey: ['ai-provider-configs'] })}
      />
    </Card>
  );
}

function ProviderDrawer({
  open, onOpenChange, editing, onSaved,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; editing: ProviderRow | null; onSaved: () => void;
}) {
  const isEdit = !!editing;
  const [provider, setProvider] = useState<string>(editing?.provider || 'openrouter');
  const [displayName, setDisplayName] = useState(editing?.display_name || '');
  const [baseUrl, setBaseUrl] = useState(editing?.base_url || '');
  const [secretName, setSecretName] = useState(editing?.api_key_secret_name || '');
  const [model, setModel] = useState(editing?.default_model || '');
  const [scope, setScope] = useState(editing?.scope || 'all');
  const [isActive, setIsActive] = useState(editing?.is_active ?? true);
  const [isDefault, setIsDefault] = useState(editing?.is_default ?? false);
  const [enableFallback, setEnableFallback] = useState(editing?.enable_fallback ?? true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  // Sync defaults when provider type changes
  const applyDefaults = (p: string) => {
    setProvider(p);
    const d = PROVIDER_DEFAULTS[p];
    if (d) {
      if (!isEdit) {
        setBaseUrl(d.base_url);
        setSecretName(d.secret_name);
        setModel(d.default_model);
        setDisplayName(p === 'lovable' ? 'Lovable AI' : p.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()));
      }
    }
  };

  const save = async () => {
    if (!displayName || !model) {
      toast.error('Display name and default model are required');
      return;
    }
    const payload = {
      provider, display_name: displayName, base_url: baseUrl || null,
      api_key_secret_name: secretName || null, default_model: model, scope,
      is_active: isActive, is_default: isDefault, enable_fallback: enableFallback,
    };
    const op = isEdit
      ? (supabase as any).from('ai_provider_configs').update(payload).eq('id', editing!.id)
      : (supabase as any).from('ai_provider_configs').insert(payload);
    const { error } = await op;
    if (error) { toast.error(error.message); return; }
    toast.success(isEdit ? 'Provider updated' : 'Provider added');
    onSaved();
    onOpenChange(false);
  };

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('test-ai-provider', {
        body: { provider, base_url: baseUrl, api_key_secret_name: secretName, default_model: model },
      });
      if (error) throw error;
      setTestResult(data);
      if (data.success) toast.success(`Reachable (${data.latency_ms}ms)`);
      else toast.error(data.error || 'Test failed');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setTesting(false);
    }
  };

  const help = PROVIDER_DEFAULTS[provider]?.help;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-600" />
            {isEdit ? 'Edit AI Provider' : 'Add AI Provider'}
          </SheetTitle>
          <SheetDescription>
            Configure where Lovable should send AI calls for this scope.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div>
            <Label>Provider Type</Label>
            <Select value={provider} onValueChange={applyDefaults} disabled={isEdit}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="lovable">Lovable AI (built-in)</SelectItem>
                <SelectItem value="google">Google Gemini (direct API, free tier)</SelectItem>
                <SelectItem value="openrouter">OpenRouter (free tier available)</SelectItem>
                <SelectItem value="groq">Groq (ultra-fast, free tier)</SelectItem>
                <SelectItem value="together">Together AI (free Llama models)</SelectItem>
                <SelectItem value="deepseek">DeepSeek (very cheap)</SelectItem>
                <SelectItem value="mistral">Mistral AI</SelectItem>
                <SelectItem value="ollama">Ollama (self-hosted on your VPS)</SelectItem>
                <SelectItem value="openai_compatible">Custom OpenAI-compatible endpoint</SelectItem>
              </SelectContent>
            </Select>
            {help && <p className="text-xs text-muted-foreground mt-1.5">{help}</p>}
          </div>

          <div>
            <Label>Display Name</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. OpenRouter Free Llama" />
          </div>

          <div>
            <Label>Endpoint URL</Label>
            <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://..." />
          </div>

          <div>
            <Label>Default Model</Label>
            <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="provider/model-name" />
          </div>

          <div>
            <Label>API Key Secret Name</Label>
            <Input
              value={secretName}
              onChange={(e) => setSecretName(e.target.value)}
              placeholder="e.g. OPENROUTER_API_KEY"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              <strong>Enter the secret NAME, not the key value.</strong> Add the actual key in
              Cloud → Settings → Secrets using this exact name. Leave blank for Lovable AI
              (auto-provisioned) or unauthenticated Ollama.
            </p>
          </div>

          <div>
            <Label>Use For (Scope)</Label>
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SCOPES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center justify-between">
              <div>
                <Label>Active</Label>
                <p className="text-xs text-muted-foreground">Enable this provider</p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Default for this scope</Label>
                <p className="text-xs text-muted-foreground">Use this provider for all calls in scope</p>
              </div>
              <Switch checked={isDefault} onCheckedChange={setIsDefault} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Auto-fallback to Lovable AI</Label>
                <p className="text-xs text-muted-foreground">If this provider fails, retry on Lovable AI</p>
              </div>
              <Switch checked={enableFallback} onCheckedChange={setEnableFallback} disabled={provider === 'lovable'} />
            </div>
          </div>

          {testResult && (
            <div className={`rounded-lg border p-3 text-sm ${testResult.success ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
              {testResult.success ? (
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-medium text-emerald-900">Connection OK ({testResult.latency_ms}ms)</div>
                    <div className="text-xs text-emerald-700 mt-1">Sample reply: "{testResult.sample_reply}"</div>
                    {testResult.pasted_raw_key && (
                      <div className="text-xs text-amber-700 mt-2 bg-amber-50 border border-amber-200 rounded p-2">
                        ⚠️ You pasted the raw API key in the Secret Name field. This worked for testing,
                        but for production you must store the key as a Cloud secret and put only the
                        secret name (e.g. <code>GOOGLE_AI_API_KEY</code>) in this field.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <XCircle className="h-4 w-4 text-red-600 mt-0.5" />
                  <div>
                    <div className="font-medium text-red-900">Test failed</div>
                    <div className="text-xs text-red-700 mt-1 break-all">{testResult.error}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <SheetFooter className="mt-6 gap-2">
          <Button variant="outline" onClick={test} disabled={testing}>
            <Zap className="h-4 w-4 mr-2" /> {testing ? 'Testing...' : 'Test Connection'}
          </Button>
          <Button onClick={save}>
            <Server className="h-4 w-4 mr-2" /> {isEdit ? 'Save Changes' : 'Add Provider'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

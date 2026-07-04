'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import {
  Settings,
  Save,
  TestTube2,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Info,
  Mail,
  Globe,
  Lock,
  Eye,
  EyeOff,
  Cpu,
  RefreshCw,
  FolderSync,
  Database,
  ArrowDownToLine,
  ArrowUpFromLine
} from 'lucide-react';

interface ConfigData {
  smtp_host: string;
  smtp_port: string;
  smtp_email: string;
  smtp_password: string;
  smtp_from_name: string;
  smtp_secure: string;
  imap_host: string;
  imap_port: string;
  imap_email: string;
  imap_password: string;
  imap_secure: string;
  ai_enabled: string;
  ai_provider: string;
  ai_endpoint: string;
  ai_model: string;
  ai_api_key: string;
  auto_reply_enabled: string;
}

const DEFAULT_CONFIG: ConfigData = {
  smtp_host: '',
  smtp_port: '587',
  smtp_email: '',
  smtp_password: '',
  smtp_from_name: '',
  smtp_secure: 'false',
  imap_host: '',
  imap_port: '993',
  imap_email: '',
  imap_password: '',
  imap_secure: 'true',
  ai_enabled: 'false',
  ai_provider: 'ollama',
  ai_endpoint: 'http://localhost:11434',
  ai_model: 'llama3',
  ai_api_key: '',
  auto_reply_enabled: 'false',
};

const SMTP_PRESETS = [
  { name: 'Gmail', host: 'smtp.gmail.com', port: 587, secure: false },
  { name: 'Outlook', host: 'smtp.office365.com', port: 587, secure: false },
  { name: 'Yahoo', host: 'smtp.mail.yahoo.com', port: 587, secure: false },
];

const IMAP_PRESETS = [
  { name: 'Gmail', host: 'imap.gmail.com', port: 993, secure: true },
  { name: 'Outlook', host: 'outlook.office365.com', port: 993, secure: true },
  { name: 'Yahoo', host: 'imap.mail.yahoo.com', port: 993, secure: true },
];

const AI_PRESETS = [
  { name: 'Ollama', provider: 'ollama', endpoint: 'http://localhost:11434', model: 'llama3' },
  { name: 'LM Studio', provider: 'lm_studio', endpoint: 'http://localhost:1234', model: 'meta-llama-3-8b-instruct' },
  { name: 'OpenAI', provider: 'openai', endpoint: 'https://api.openai.com', model: 'gpt-4o-mini' },
  { name: 'Gemini', provider: 'gemini', endpoint: 'https://generativelanguage.googleapis.com', model: 'gemini-1.5-flash' },
  { name: 'NVIDIA NIM', provider: 'nvidia_nim', endpoint: 'https://integrate.api.nvidia.com', model: 'z-ai/glm-5.2' },
];

export function SettingsTab() {
  const [config, setConfig] = useState<ConfigData>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  
  // States
  const [saving, setSaving] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [testSmtpResult, setTestSmtpResult] = useState<{ success: boolean; message: string } | null>(null);
  
  // Startup config
  const [startupEnabled, setStartupEnabled] = useState(false);
  const [startupSupported, setStartupSupported] = useState(false);

  // Masks
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [showImapPassword, setShowImapPassword] = useState(false);
  const [showAiKey, setShowAiKey] = useState(false);

  const { toast } = useToast();

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      
      setConfig({
        smtp_host: data.smtp_host || '',
        smtp_port: data.smtp_port || '587',
        smtp_email: data.smtp_email || '',
        smtp_password: data.smtp_password || '',
        smtp_from_name: data.smtp_from_name || '',
        smtp_secure: data.smtp_secure || 'false',
        imap_host: data.imap_host || '',
        imap_port: data.imap_port || '993',
        imap_email: data.imap_email || '',
        imap_password: data.imap_password || '',
        imap_secure: data.imap_secure || 'true',
        ai_enabled: data.ai_enabled || 'false',
        ai_provider: data.ai_provider || 'ollama',
        ai_endpoint: data.ai_endpoint || 'http://localhost:11434',
        ai_model: data.ai_model || 'llama3',
        ai_api_key: data.ai_api_key || '',
        auto_reply_enabled: data.auto_reply_enabled || 'false',
      });

      // Fetch Startup Settings
      const startupRes = await fetch('/api/config/startup');
      const startupData = await startupRes.json();
      setStartupEnabled(startupData.enabled);
      setStartupSupported(startupData.supported);
    } catch {
      // stay on defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSave = async () => {
    setSaving(true);
    setTestSmtpResult(null);

    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configs: config }),
      });

      if (res.ok) {
        toast({ title: 'Configuration Saved', description: 'Local settings updated successfully.' });
      } else {
        const err = await res.json();
        toast({ title: 'Error', description: err.error || 'Failed to save configuration.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to save configuration.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleTestSmtp = async () => {
    if (!config.smtp_host.trim() || !config.smtp_email.trim() || !config.smtp_password.trim()) {
      toast({ title: 'Validation Warning', description: 'Enter SMTP server, email, and password to test.', variant: 'destructive' });
      return;
    }

    // Save first
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ configs: config }),
    });

    setTestingSmtp(true);
    setTestSmtpResult(null);

    try {
      const res = await fetch('/api/config/test', { method: 'POST' });
      const data = await res.json();
      setTestSmtpResult({ success: data.success, message: data.message || data.error || 'Test connection completed' });
    } catch {
      setTestSmtpResult({ success: false, message: 'Could not connect to localhost test API.' });
    } finally {
      setTestingSmtp(false);
    }
  };

  const handleToggleStartup = async (checked: boolean) => {
    try {
      const res = await fetch('/api/config/startup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enable: checked }),
      });
      const data = await res.json();
      if (res.ok) {
        setStartupEnabled(data.enabled);
        toast({
          title: data.enabled ? 'Startup Enabled' : 'Startup Disabled',
          description: data.enabled
            ? 'MailAgent AI will now launch automatically when Windows starts.'
            : 'Removed from Windows Startup folder.',
        });
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      toast({ title: 'Startup Config Error', description: err.message || 'Failed to toggle startup task.', variant: 'destructive' });
    }
  };

  const triggerDbSnapshot = async () => {
    try {
      const res = await fetch('/api/backup?action=snapshot');
      const data = await res.json();
      if (res.ok) {
        toast({ title: 'Snapshot Backup Created', description: `Saved snapshot file: ${data.file}` });
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      toast({ title: 'Backup Failure', description: err.message || 'Failed to copy SQLite database snapshot.', variant: 'destructive' });
    }
  };

  const exportBackupJson = async () => {
    try {
      const res = await fetch('/api/backup');
      const data = await res.json();
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `mailagent_backup_${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({ title: 'Export Success', description: 'JSON backup downloaded.' });
    } catch {
      toast({ title: 'Export Failed', description: 'Unable to compile config JSON.', variant: 'destructive' });
    }
  };

  const importBackupJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const payload = JSON.parse(event.target?.result as string);
        const res = await fetch('/api/backup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (res.ok) {
          toast({ title: 'Restore Complete', description: `Restored: ${data.restoredContacts} contacts, ${data.restoredTemplates} templates, ${data.restoredRules} rules.` });
          fetchConfig();
        } else {
          throw new Error(data.error);
        }
      } catch (err: any) {
        toast({ title: 'Restore Failed', description: err.message || 'Error processing backup file.', variant: 'destructive' });
      }
    };
    reader.readAsText(file);
  };

  const applySmtpPreset = (preset: typeof SMTP_PRESETS[0]) => {
    setConfig((prev) => ({
      ...prev,
      smtp_host: preset.host,
      smtp_port: String(preset.port),
      smtp_secure: String(preset.secure),
    }));
    toast({ title: 'SMTP Preset Loaded', description: `${preset.name} SMTP settings applied.` });
  };

  const applyImapPreset = (preset: typeof IMAP_PRESETS[0]) => {
    setConfig((prev) => ({
      ...prev,
      imap_host: preset.host,
      imap_port: String(preset.port),
      imap_secure: String(preset.secure),
    }));
    toast({ title: 'IMAP Preset Loaded', description: `${preset.name} IMAP settings applied.` });
  };

  const applyAiPreset = (preset: typeof AI_PRESETS[0]) => {
    setConfig((prev) => ({
      ...prev,
      ai_provider: preset.provider,
      ai_endpoint: preset.endpoint,
      ai_model: preset.model,
    }));
    toast({ title: 'AI Preset Loaded', description: `${preset.name} configuration loaded.` });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Card><CardContent className="p-6"><div className="h-60 bg-muted rounded animate-pulse" /></CardContent></Card>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Settings inputs */}
      <div className="lg:col-span-2 space-y-6">
        {/* SMTP Config */}
        <Card>
          <CardHeader className="pb-3 border-b bg-muted/10">
            <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
              <Mail className="w-4 h-4" /> SMTP Send Settings
            </CardTitle>
            <CardDescription className="text-xs">Configure outgoing email delivery servers</CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-xs text-muted-foreground font-bold mr-1 uppercase">Presets:</span>
              {SMTP_PRESETS.map((p) => (
                <Button key={p.name} variant="outline" size="sm" onClick={() => applySmtpPreset(p)} className="text-xs h-7 px-2">
                  {p.name}
                </Button>
              ))}
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="smtp_host" className="text-xs font-semibold">SMTP Host *</Label>
                <Input id="smtp_host" placeholder="smtp.gmail.com" value={config.smtp_host} onChange={(e) => setConfig({ ...config, smtp_host: e.target.value })} className="text-xs" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="smtp_port" className="text-xs font-semibold">SMTP Port *</Label>
                <Input id="smtp_port" type="number" placeholder="587" value={config.smtp_port} onChange={(e) => setConfig({ ...config, smtp_port: e.target.value })} className="text-xs" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="smtp_email" className="text-xs font-semibold">Sender Email *</Label>
                <Input id="smtp_email" type="email" placeholder="you@gmail.com" value={config.smtp_email} onChange={(e) => setConfig({ ...config, smtp_email: e.target.value })} className="text-xs" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="smtp_password" className="text-xs font-semibold">Sender Password / App Password *</Label>
                <div className="relative">
                  <Input
                    id="smtp_password"
                    type={showSmtpPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={config.smtp_password}
                    onChange={(e) => setConfig({ ...config, smtp_password: e.target.value })}
                    className="text-xs pr-9 h-9"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                  >
                    {showSmtpPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <div className="sm:col-span-2 grid gap-2">
                <Label htmlFor="smtp_from_name" className="text-xs font-semibold">Display Sender Name</Label>
                <Input id="smtp_from_name" placeholder="John Doe" value={config.smtp_from_name} onChange={(e) => setConfig({ ...config, smtp_from_name: e.target.value })} className="text-xs" />
              </div>
              <div className="sm:col-span-2 flex items-center gap-3">
                <Switch
                  id="smtp_secure"
                  checked={config.smtp_secure === 'true'}
                  onCheckedChange={(checked) => setConfig({ ...config, smtp_secure: String(checked) })}
                />
                <div>
                  <Label htmlFor="smtp_secure" className="cursor-pointer text-xs font-semibold">Use SSL/TLS (Port 465)</Label>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Recommended for 465; keep disabled for 587/STARTTLS.</p>
                </div>
              </div>
            </div>

            {testSmtpResult && (
              <div className={`flex items-start gap-3 p-3.5 rounded-lg border text-xs ${
                testSmtpResult.success ? 'bg-emerald-50 border-emerald-200/50 text-emerald-800' : 'bg-red-50 border-red-200/50 text-red-800'
              }`}>
                {testSmtpResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                <div>
                  <p className="font-bold">{testSmtpResult.success ? 'Success' : 'Failure'}</p>
                  <p className="mt-0.5">{testSmtpResult.message}</p>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving} size="sm">
                <Save className="w-3.5 h-3.5 mr-1.5" /> Save Outgoing
              </Button>
              <Button variant="outline" onClick={handleTestSmtp} disabled={testingSmtp} size="sm">
                {testingSmtp ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <TestTube2 className="w-3.5 h-3.5 mr-1.5" />}
                Test SMTP Outgoing
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* IMAP Config */}
        <Card>
          <CardHeader className="pb-3 border-b bg-muted/10">
            <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> IMAP Receive Settings
            </CardTitle>
            <CardDescription className="text-xs">Configure incoming email servers to monitor real-time inbox events</CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-xs text-muted-foreground font-bold mr-1 uppercase">Presets:</span>
              {IMAP_PRESETS.map((p) => (
                <Button key={p.name} variant="outline" size="sm" onClick={() => applyImapPreset(p)} className="text-xs h-7 px-2">
                  {p.name}
                </Button>
              ))}
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="imap_host" className="text-xs font-semibold">IMAP Host *</Label>
                <Input id="imap_host" placeholder="imap.gmail.com" value={config.imap_host} onChange={(e) => setConfig({ ...config, imap_host: e.target.value })} className="text-xs" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="imap_port" className="text-xs font-semibold">IMAP Port *</Label>
                <Input id="imap_port" type="number" placeholder="993" value={config.imap_port} onChange={(e) => setConfig({ ...config, imap_port: e.target.value })} className="text-xs" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="imap_email" className="text-xs font-semibold">IMAP Email *</Label>
                <Input id="imap_email" type="email" placeholder="you@gmail.com" value={config.imap_email} onChange={(e) => setConfig({ ...config, imap_email: e.target.value })} className="text-xs" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="imap_password" className="text-xs font-semibold">IMAP Password / App Password *</Label>
                <div className="relative">
                  <Input
                    id="imap_password"
                    type={showImapPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={config.imap_password}
                    onChange={(e) => setConfig({ ...config, imap_password: e.target.value })}
                    className="text-xs pr-9 h-9"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowImapPassword(!showImapPassword)}
                  >
                    {showImapPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <div className="sm:col-span-2 flex items-center gap-3">
                <Switch
                  id="imap_secure"
                  checked={config.imap_secure === 'true'}
                  onCheckedChange={(checked) => setConfig({ ...config, imap_secure: String(checked) })}
                />
                <div>
                  <Label htmlFor="imap_secure" className="cursor-pointer text-xs font-semibold">Use SSL/TLS (Default active)</Label>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Encrypts the incoming IMAP connection.</p>
                </div>
              </div>
            </div>
            <Button onClick={handleSave} disabled={saving} size="sm">
              <Save className="w-3.5 h-3.5 mr-1.5" /> Save Incoming
            </Button>
          </CardContent>
        </Card>

        {/* Local & Cloud AI Configuration */}
        <Card>
          <CardHeader className="pb-3 border-b bg-muted/10">
            <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
              <Cpu className="w-4 h-4" /> AI Engine Configuration
            </CardTitle>
            <CardDescription className="text-xs">Connect to local LLMs (Ollama / LM Studio) or cloud LLM endpoints</CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-3">
              <Switch
                id="ai_enabled"
                checked={config.ai_enabled === 'true'}
                onCheckedChange={async (checked) => {
                  const newConfig = { ...config, ai_enabled: String(checked) };
                  setConfig(newConfig);
                  try {
                    await fetch('/api/config', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ configs: newConfig }),
                    });
                  } catch (e) {
                    console.error(e);
                  }
                }}
              />
              <div>
                <Label htmlFor="ai_enabled" className="cursor-pointer text-xs font-bold uppercase">Enable AI Integration</Label>
                <p className="text-[10px] text-muted-foreground mt-0.5">Enables AI writing assistants and incoming email classification.</p>
              </div>
            </div>

            {config.ai_enabled === 'true' && (
              <>
                <div className="flex flex-wrap gap-1.5 items-center">
                  <span className="text-xs text-muted-foreground font-bold mr-1 uppercase">Presets:</span>
                  {AI_PRESETS.map((p) => (
                    <Button key={p.name} variant="outline" size="sm" onClick={() => applyAiPreset(p)} className="text-xs h-7 px-2">
                      {p.name}
                    </Button>
                  ))}
                </div>

                <Separator />

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="ai_provider" className="text-xs font-semibold">AI Provider *</Label>
                    <select
                      id="ai_provider"
                      value={config.ai_provider}
                      onChange={(e) => {
                        const val = e.target.value;
                        const p = AI_PRESETS.find(x => x.provider === val);
                        setConfig({
                          ...config,
                          ai_provider: val,
                          ai_endpoint: p?.endpoint || '',
                          ai_model: p?.model || '',
                        });
                      }}
                      className="bg-background border rounded-md p-1.5 text-xs outline-none cursor-pointer h-9 font-medium"
                    >
                      <option value="ollama">Ollama (Local)</option>
                      <option value="lm_studio">LM Studio (Local)</option>
                      <option value="openai">OpenAI (Cloud)</option>
                      <option value="gemini">Gemini (Cloud)</option>
                      <option value="nvidia_nim">NVIDIA NIM (Local/Cloud)</option>
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="ai_model" className="text-xs font-semibold">Model Name *</Label>
                    <Input id="ai_model" placeholder="llama3" value={config.ai_model} onChange={(e) => setConfig({ ...config, ai_model: e.target.value })} className="text-xs" />
                  </div>
                  <div className="sm:col-span-2 grid gap-2">
                    <Label htmlFor="ai_endpoint" className="text-xs font-semibold">API Endpoint Endpoint URL *</Label>
                    <Input id="ai_endpoint" placeholder="http://localhost:11434" value={config.ai_endpoint} onChange={(e) => setConfig({ ...config, ai_endpoint: e.target.value })} className="text-xs" />
                  </div>
                  <div className="sm:col-span-2 grid gap-2">
                    <Label htmlFor="ai_api_key" className="text-xs font-semibold">API Secret Key (Not required for local models)</Label>
                    <div className="relative">
                      <Input
                        id="ai_api_key"
                        type={showAiKey ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={config.ai_api_key}
                        onChange={(e) => setConfig({ ...config, ai_api_key: e.target.value })}
                        className="text-xs pr-9 h-9"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowAiKey(!showAiKey)}
                      >
                        {showAiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            )}
            <Button onClick={handleSave} disabled={saving} size="sm">
              <Save className="w-3.5 h-3.5 mr-1.5" /> Save Engine Settings
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Side tools (Startup, Backups, Presets details) */}
      <div className="space-y-6">
        {/* Startup Integrator */}
        <Card>
          <CardHeader className="pb-3 bg-muted/10">
            <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
              <FolderSync className="w-4 h-4" /> Desktop Integrator
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold uppercase">Launch on Startup</Label>
                <p className="text-[10px] text-muted-foreground">Start dashboard server when laptop boots</p>
              </div>
              <Switch
                checked={startupEnabled}
                onCheckedChange={handleToggleStartup}
                disabled={!startupSupported}
              />
            </div>
            {!startupSupported && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 text-[10px] text-amber-800 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>Startup configuration is currently supported natively on Windows systems.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* SQLite Database Snapshot & Recovery */}
        <Card>
          <CardHeader className="pb-3 bg-muted/10">
            <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
              <Database className="w-4 h-4" /> Snapshot & Backups
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4 text-xs">
            <div className="space-y-3">
              <div>
                <Label className="font-bold text-[11px] uppercase text-muted-foreground block mb-1">SQLite snapshot</Label>
                <Button variant="outline" size="sm" onClick={triggerDbSnapshot} className="w-full justify-start text-xs h-8">
                  <Database className="w-3.5 h-3.5 mr-2 text-blue-500" /> Create Database Snapshot
                </Button>
                <p className="text-[10px] text-muted-foreground mt-1">Saves a backup copy of the active database file.</p>
              </div>

              <Separator />

              <div>
                <Label className="font-bold text-[11px] uppercase text-muted-foreground block mb-2">Import / Export configs</Label>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={exportBackupJson} className="flex-1 text-xs h-8">
                    <ArrowDownToLine className="w-3.5 h-3.5 mr-1.5" /> Export Data
                  </Button>
                  <label htmlFor="restore-file" className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-center border rounded-lg h-8 bg-muted/30 hover:bg-muted/60 text-xs font-medium transition-colors">
                      <ArrowUpFromLine className="w-3.5 h-3.5 mr-1.5" /> Restore Data
                    </div>
                  </label>
                  <input
                    id="restore-file"
                    type="file"
                    accept=".json"
                    onChange={importBackupJson}
                    className="hidden"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">Export or restore templates, rules, and contacts as JSON.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
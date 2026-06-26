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
import { Settings, Save, TestTube2, CheckCircle2, XCircle, Loader2, AlertTriangle, Info, Mail, Globe, Lock, Eye, EyeOff } from 'lucide-react';

interface ConfigData {
  smtp_host: string;
  smtp_port: string;
  smtp_email: string;
  smtp_password: string;
  smtp_from_name: string;
  smtp_secure: string;
}

const DEFAULT_CONFIG: ConfigData = {
  smtp_host: '',
  smtp_port: '587',
  smtp_email: '',
  smtp_password: '',
  smtp_from_name: '',
  smtp_secure: 'false',
};

const PRESETS: { name: string; host: string; port: number; secure: boolean; note: string }[] = [
  { name: 'Gmail', host: 'smtp.gmail.com', port: 587, secure: false, note: 'Use App Password, not your regular password' },
  { name: 'Outlook / Office 365', host: 'smtp.office365.com', port: 587, secure: false, note: 'StartTLS required' },
  { name: 'Yahoo Mail', host: 'smtp.mail.yahoo.com', port: 587, secure: false, note: 'Use App Password' },
  { name: 'SendGrid', host: 'smtp.sendgrid.net', port: 587, secure: false, note: 'Use your SendGrid API key as password' },
  { name: 'Amazon SES', host: 'email-smtp.us-east-1.amazonaws.com', port: 587, secure: false, note: 'Requires SES SMTP credentials' },
];

export function SettingsTab() {
  const [config, setConfig] = useState<ConfigData>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
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
      });
    } catch {
      // stay on defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const handleSave = async () => {
    if (!config.smtp_host.trim() || !config.smtp_email.trim()) {
      toast({ title: 'Required Fields Missing', description: 'SMTP Host and Email are required.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configs: config }),
      });

      if (res.ok) {
        toast({ title: 'Settings Saved', description: 'SMTP configuration has been saved.' });
      } else {
        const err = await res.json();
        toast({ title: 'Error', description: err.error || 'Failed to save.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to save settings.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    // Save first, then test
    if (!config.smtp_host.trim() || !config.smtp_email.trim() || !config.smtp_password.trim()) {
      toast({
        title: 'Cannot Test',
        description: 'Fill in SMTP Host, Email, and Password first.',
        variant: 'destructive',
      });
      return;
    }

    // Save before testing
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ configs: config }),
    });

    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/config/test', { method: 'POST' });
      const data = await res.json();
      setTestResult({ success: data.success, message: data.message || data.error || 'Unknown result' });
    } catch {
      setTestResult({ success: false, message: 'Failed to reach test endpoint.' });
    } finally {
      setTesting(false);
    }
  };

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setConfig((prev) => ({
      ...prev,
      smtp_host: preset.host,
      smtp_port: String(preset.port),
      smtp_secure: String(preset.secure),
    }));
    setTestResult(null);
    toast({ title: 'Preset Applied', description: `${preset.name} SMTP settings loaded. Fill in your email & password.` });
  };

  const isConfigured = config.smtp_host.trim() !== '' && config.smtp_email.trim() !== '' && config.smtp_password.trim() !== '';

  if (loading) {
    return (
      <div className="space-y-4">
        <Card><CardContent className="p-6"><div className="h-60 bg-muted rounded" /></CardContent></Card>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* SMTP Configuration */}
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  SMTP Configuration
                </CardTitle>
                <CardDescription>Configure your email server to send real emails</CardDescription>
              </div>
              {isConfigured ? (
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Configured
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <XCircle className="w-3 h-3 mr-1" /> Not Configured
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Quick Presets */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Quick Presets</Label>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((preset) => (
                  <Button
                    key={preset.name}
                    variant="outline"
                    size="sm"
                    onClick={() => applyPreset(preset)}
                  >
                    <Globe className="w-3.5 h-3.5 mr-1.5" />
                    {preset.name}
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Form Fields */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="smtp_host">SMTP Host *</Label>
                <Input
                  id="smtp_host"
                  placeholder="smtp.gmail.com"
                  value={config.smtp_host}
                  onChange={(e) => { setConfig({ ...config, smtp_host: e.target.value }); setTestResult(null); }}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="smtp_port">Port</Label>
                <Input
                  id="smtp_port"
                  type="number"
                  placeholder="587"
                  value={config.smtp_port}
                  onChange={(e) => { setConfig({ ...config, smtp_port: e.target.value }); setTestResult(null); }}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="smtp_email">Your Email *</Label>
                <Input
                  id="smtp_email"
                  type="email"
                  placeholder="you@gmail.com"
                  value={config.smtp_email}
                  onChange={(e) => { setConfig({ ...config, smtp_email: e.target.value }); setTestResult(null); }}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="smtp_password">Password / App Password *</Label>
                <div className="relative">
                  <Input
                    id="smtp_password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={config.smtp_password}
                    onChange={(e) => { setConfig({ ...config, smtp_password: e.target.value }); setTestResult(null); }}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <div className="sm:col-span-2 grid gap-2">
                <Label htmlFor="smtp_from_name">From Name (optional)</Label>
                <Input
                  id="smtp_from_name"
                  placeholder="My Company"
                  value={config.smtp_from_name}
                  onChange={(e) => { setConfig({ ...config, smtp_from_name: e.target.value }); setTestResult(null); }}
                />
              </div>
              <div className="sm:col-span-2 flex items-center gap-3">
                <Switch
                  id="smtp_secure"
                  checked={config.smtp_secure === 'true'}
                  onCheckedChange={(checked) => {
                    setConfig({ ...config, smtp_secure: String(checked) });
                    setTestResult(null);
                  }}
                />
                <div>
                  <Label htmlFor="smtp_secure" className="cursor-pointer">Use SSL/TLS (Port 465)</Label>
                  <p className="text-xs text-muted-foreground">Enable for port 465. For port 587, keep this off (uses STARTTLS).</p>
                </div>
              </div>
            </div>

            {/* Test Result */}
            {testResult && (
              <div className={`flex items-start gap-3 p-3 rounded-lg border ${
                testResult.success
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-red-50 border-red-200'
              }`}>
                {testResult.success
                  ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  : <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                }
                <div>
                  <p className={`text-sm font-medium ${testResult.success ? 'text-emerald-800' : 'text-red-800'}`}>
                    {testResult.success ? 'Connection Successful' : 'Connection Failed'}
                  </p>
                  <p className={`text-xs mt-0.5 ${testResult.success ? 'text-emerald-700' : 'text-red-700'}`}>
                    {testResult.message}
                  </p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
                Save Settings
              </Button>
              <Button variant="outline" onClick={handleTest} disabled={testing}>
                {testing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <TestTube2 className="w-4 h-4 mr-1.5" />}
                Test Connection
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Help Panel */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="w-4 h-4" />
              How to Set Up
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">1</div>
                <div>
                  <p className="text-sm font-medium">Choose your provider</p>
                  <p className="text-xs text-muted-foreground">Click a preset button above to auto-fill host & port.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">2</div>
                <div>
                  <p className="text-sm font-medium">Enter your email & password</p>
                  <p className="text-xs text-muted-foreground">For Gmail, you need an <strong>App Password</strong> (not your regular password).</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">3</div>
                <div>
                  <p className="text-sm font-medium">Test the connection</p>
                  <p className="text-xs text-muted-foreground">Click &quot;Test Connection&quot; to verify SMTP works before sending.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">4</div>
                <div>
                  <p className="text-sm font-medium">Save & start sending</p>
                  <p className="text-xs text-muted-foreground">Save settings, then go to Compose to send real emails.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Gmail App Password
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-muted-foreground">
            <p>Gmail requires an <strong>App Password</strong> instead of your regular password:</p>
            <ol className="list-decimal list-inside space-y-1.5 ml-1">
              <li>Go to your Google Account → Security</li>
              <li>Enable 2-Step Verification</li>
              <li>Go to App Passwords</li>
              <li>Create a new app password (select &quot;Mail&quot;)</li>
              <li>Copy the 16-character password</li>
              <li>Paste it in the Password field above</li>
            </ol>
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-amber-800">Your password is stored locally in the database. It never leaves your machine.</p>
            </div>
          </CardContent>
        </Card>

        {!isConfigured && (
          <Card className="border-amber-200 bg-amber-50/50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-900">SMTP Not Configured</p>
                  <p className="text-xs text-amber-800 mt-1">
                    Emails won&apos;t be delivered until you configure SMTP settings. Fill in the form and test the connection.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Send, Mail, FileText, Users, Zap, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

interface Contact {
  id: string;
  name: string;
  email: string;
  company: string | null;
}

interface Template {
  id: string;
  name: string;
  subject: string;
  body: string;
}

export function ComposeTab() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [sendResult, setSendResult] = useState<{ total: number; success: number; failed: number } | null>(null);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [customSubject, setCustomSubject] = useState('');
  const [customBody, setCustomBody] = useState('');
  const [mode, setMode] = useState<'template' | 'custom'>('template');
  const { toast } = useToast();

  useEffect(() => {
    Promise.all([
      fetch('/api/contacts').then((r) => r.json()),
      fetch('/api/templates').then((r) => r.json()),
      fetch('/api/config').then((r) => r.json()),
    ])
      .then(([c, t, cfg]) => {
        setContacts(c);
        setTemplates(t);
        setSmtpConfigured(!!(cfg.smtp_host && cfg.smtp_email && cfg.smtp_password && cfg.smtp_password !== '********' && cfg.smtp_password !== ''));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const toggleContact = (id: string) => {
    setSelectedContacts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedContacts.size === contacts.length) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(contacts.map((c) => c.id)));
    }
  };

  const handleBulkSend = async () => {
    if (selectedContacts.size === 0) {
      toast({ title: 'No Recipients', description: 'Select at least one contact.', variant: 'destructive' });
      return;
    }

    if (mode === 'template' && !selectedTemplate) {
      toast({ title: 'No Template', description: 'Select a template.', variant: 'destructive' });
      return;
    }

    if (mode === 'custom' && (!customSubject.trim() || !customBody.trim())) {
      toast({ title: 'Incomplete', description: 'Subject and body are required.', variant: 'destructive' });
      return;
    }

    setSending(true);
    setSendProgress(0);
    setSendResult(null);

    try {
      const payload: Record<string, unknown> = {
        mode: 'bulk',
        contactIds: Array.from(selectedContacts),
      };

      if (mode === 'template') {
        payload.templateId = selectedTemplate;
      } else {
        payload.subject = customSubject;
        payload.body = customBody;
      }

      // Simulate progress
      const progressInterval = setInterval(() => {
        setSendProgress((prev) => Math.min(prev + Math.random() * 20, 90));
      }, 300);

      const res = await fetch('/api/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      clearInterval(progressInterval);
      setSendProgress(100);

      const data = await res.json();
      setSendResult({ total: data.total, success: data.success, failed: data.failed });

      if (data.failed === 0) {
        toast({ title: 'All Emails Sent!', description: `Successfully sent ${data.success} emails via SMTP.` });
      } else {
        const errorMsg = data.errors?.length > 0 ? data.errors[0] : `${data.failed} failed`;
        toast({ title: data.success > 0 ? 'Partial Success' : 'Send Failed', description: errorMsg, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to send emails.', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}><CardContent className="p-6"><div className="h-40 bg-muted rounded" /></CardContent></Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Contact Selection */}
      <Card className="lg:col-span-1">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" />
              Recipients
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs">
              {selectedContacts.size === contacts.length ? 'Deselect All' : 'Select All'}
            </Button>
          </div>
          <CardDescription>
            {selectedContacts.size} of {contacts.length} selected
          </CardDescription>
        </CardHeader>
        <CardContent>
          {contacts.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">No contacts. Add some first.</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {contacts.map((contact) => (
                <label
                  key={contact.id}
                  className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                    selectedContacts.has(contact.id) ? 'bg-primary/5 border border-primary/20' : 'hover:bg-muted/50'
                  }`}
                >
                  <Checkbox
                    checked={selectedContacts.has(contact.id)}
                    onCheckedChange={() => toggleContact(contact.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{contact.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{contact.email}</p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Compose Area */}
      <div className="lg:col-span-2 space-y-4">
        {/* Mode Selector */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Label className="text-sm font-medium shrink-0">Compose using:</Label>
              <div className="flex items-center gap-2">
                <Button
                  variant={mode === 'template' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setMode('template')}
                >
                  <FileText className="w-4 h-4 mr-1.5" /> Template
                </Button>
                <Button
                  variant={mode === 'custom' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setMode('custom')}
                >
                  <Mail className="w-4 h-4 mr-1.5" /> Custom
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Template Mode */}
        {mode === 'template' && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Select Template</CardTitle>
              <CardDescription>Choose a template for bulk sending</CardDescription>
            </CardHeader>
            <CardContent>
              {templates.filter((t) => t.isActive).length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">No active templates. Create one first.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {templates.filter((t) => t.isActive).map((template) => (
                    <label
                      key={template.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedTemplate === template.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                      }`}
                      onClick={() => setSelectedTemplate(template.id)}
                    >
                      <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-violet-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{template.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{template.subject}</p>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        selectedTemplate === template.id ? 'border-primary' : 'border-muted-foreground/30'
                      }`}>
                        {selectedTemplate === template.id && <div className="w-2 h-2 rounded-full bg-primary" />}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Custom Mode */}
        {mode === 'custom' && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Custom Email</CardTitle>
              <CardDescription>Write your email content. Use {'{{name}}'}, {'{{email}}'}, {'{{company}}'} for personalization.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>Subject Line *</Label>
                <Input
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                  placeholder="Hello {{name}}, special offer for {{company}}!"
                />
              </div>
              <div className="grid gap-2">
                <Label>Email Body *</Label>
                <Textarea
                  value={customBody}
                  onChange={(e) => setCustomBody(e.target.value)}
                  placeholder="Dear {{name}},..."
                  rows={8}
                  className="font-mono text-sm"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* SMTP Warning */}
        {!smtpConfigured && (
          <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-200 bg-amber-50">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-900">SMTP not configured</p>
              <p className="text-xs text-amber-800 mt-0.5">
                Emails cannot be delivered. Go to <strong>Settings</strong> tab to configure your SMTP credentials (Gmail, Outlook, etc.) first.
              </p>
            </div>
          </div>
        )}

        {/* Send Action */}
        <Card>
          <CardContent className="p-4">
            {sendResult ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <span className="font-medium">Send Complete</span>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold">{sendResult.total}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                  <div className="text-center p-3 bg-emerald-50 rounded-lg">
                    <p className="text-2xl font-bold text-emerald-600">{sendResult.success}</p>
                    <p className="text-xs text-muted-foreground">Sent</p>
                  </div>
                  <div className="text-center p-3 bg-red-50 rounded-lg">
                    <p className="text-2xl font-bold text-red-600">{sendResult.failed}</p>
                    <p className="text-xs text-muted-foreground">Failed</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setSendResult(null)} className="w-full">
                  Send Another Batch
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {sending && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Sending emails...</span>
                      <span className="font-medium">{Math.round(sendProgress)}%</span>
                    </div>
                    <Progress value={sendProgress} className="h-2" />
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {selectedContacts.size} recipient{selectedContacts.size !== 1 ? 's' : ''} selected
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {mode === 'template' ? `Using: ${templates.find((t) => t.id === selectedTemplate)?.name || 'No template'}` : 'Custom email'}
                    </p>
                  </div>
                  <Button
                    onClick={handleBulkSend}
                    disabled={sending || selectedContacts.size === 0}
                    size="lg"
                  >
                    {sending ? (
                      <>Sending...</>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 mr-2" />
                        Bulk Send
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
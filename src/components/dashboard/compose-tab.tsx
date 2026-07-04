'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Send, Mail, FileText, Users, Zap, CheckCircle2, AlertTriangle, Sparkles, Paperclip, X, Upload } from 'lucide-react';

interface Contact {
  id: string;
  name: string;
  email: string;
  company: string | null;
  groupName: string | null;
}

interface Template {
  id: string;
  name: string;
  subject: string;
  body: string;
}

interface AttachmentFile {
  filename: string;
  content: string; // Base64 representation
}

export function ComposeTab() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [sendResult, setSendResult] = useState<{ total: number; success: number; failed: number } | null>(null);
  
  // Selection
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [customSubject, setCustomSubject] = useState('');
  const [customBody, setCustomBody] = useState('');
  const [mode, setMode] = useState<'template' | 'custom'>('template');

  // Contact Filter
  const [contactSearch, setContactSearch] = useState('');
  const [contactFilterGroup, setContactFilterGroup] = useState('all');

  // AI Assistant State
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiTone, setAiTone] = useState('professional');
  const [generatingAI, setGeneratingAI] = useState(false);
  const [aiResult, setAiResult] = useState('');

  // Attachments State
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);

  // Safety Confirmation Modal
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [dryRun, setDryRun] = useState(false);
  const [sendDelay, setSendDelay] = useState(1.5); // 1.5s delay

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
    const visibleContacts = getFilteredContacts();
    const allSelected = visibleContacts.every(c => selectedContacts.has(c.id));
    
    setSelectedContacts(prev => {
      const next = new Set(prev);
      if (allSelected) {
        visibleContacts.forEach(c => next.delete(c.id));
      } else {
        visibleContacts.forEach(c => next.add(c.id));
      }
      return next;
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Data = (event.target?.result as string).split(',')[1];
        setAttachments(prev => [...prev, { filename: file.name, content: base64Data }]);
        toast({ title: 'Attachment Added', description: `${file.name} is ready to send.` });
      };
      reader.readAsDataURL(file);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleGenerateAI = async () => {
    if (!aiPrompt.trim()) {
      toast({ title: 'AI Assistant', description: 'Enter instructions first.', variant: 'destructive' });
      return;
    }

    setGeneratingAI(true);
    try {
      const res = await fetch('/api/ai/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt, tone: aiTone }),
      });
      const data = await res.json();
      if (res.ok) {
        setAiResult(data.text);
      } else {
        toast({ title: 'AI Error', description: data.error || 'Failed to generate email.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to reach AI service.', variant: 'destructive' });
    } finally {
      setGeneratingAI(false);
    }
  };

  const applyAIText = () => {
    setMode('custom');
    setCustomBody(aiResult);
    setAiResult('');
    setAiPrompt('');
  };

  const initiateSend = () => {
    if (selectedContacts.size === 0) {
      toast({ title: 'Campaign Error', description: 'Select at least one recipient.', variant: 'destructive' });
      return;
    }
    if (mode === 'template' && !selectedTemplate) {
      toast({ title: 'Campaign Error', description: 'Select a template.', variant: 'destructive' });
      return;
    }
    if (mode === 'custom' && (!customSubject.trim() || !customBody.trim())) {
      toast({ title: 'Campaign Error', description: 'Enter email subject and body.', variant: 'destructive' });
      return;
    }
    setSafetyOpen(true);
  };

  const handleBulkSend = async () => {
    setSafetyOpen(false);
    setSending(true);
    setSendProgress(0);
    setSendResult(null);

    const contactIds = Array.from(selectedContacts);
    const total = contactIds.length;
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    // Auto-detect matching attachments if template contains matching keywords
    let campaignAttachments = [...attachments];

    for (let i = 0; i < total; i++) {
      const contactId = contactIds[i];
      const contact = contacts.find(c => c.id === contactId);
      if (!contact) continue;

      try {
        const payload: any = {
          contactId,
          attachments: campaignAttachments,
        };

        if (mode === 'template') {
          payload.templateId = selectedTemplate;
        } else {
          payload.subject = customSubject;
          payload.body = customBody;
        }

        if (dryRun) {
          // Dry Run Mode: Simulate delay only
          await new Promise(resolve => setTimeout(resolve, sendDelay * 1000));
          success++;
        } else {
          // Real Send Mode
          const res = await fetch('/api/emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          if (res.ok) {
            success++;
          } else {
            failed++;
            if (data.error && !errors.includes(data.error)) errors.push(data.error);
          }
          // Delay spacing to prevent spam triggers
          if (i < total - 1) {
            await new Promise(resolve => setTimeout(resolve, sendDelay * 1000));
          }
        }
      } catch (err: any) {
        failed++;
        const msg = err.message || 'SMTP timeout';
        if (!errors.includes(msg)) errors.push(msg);
      }

      setSendProgress(((i + 1) / total) * 100);
    }

    setSendResult({ total, success, failed });
    setSending(false);

    if (failed === 0) {
      toast({ title: 'Campaign Completed!', description: `Successfully dispatched ${success} emails.` });
      setSelectedContacts(new Set());
    } else {
      toast({ title: 'Campaign Partial Failure', description: `Sent: ${success}, Failed: ${failed}. Error: ${errors[0] || 'Unknown'}`, variant: 'destructive' });
    }
  };

  const getFilteredContacts = () => {
    return contacts.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(contactSearch.toLowerCase()) || c.email.toLowerCase().includes(contactSearch.toLowerCase());
      const matchesGroup = contactFilterGroup === 'all' || c.groupName === contactFilterGroup;
      return matchesSearch && matchesGroup;
    });
  };

  const getPreviewEmail = () => {
    const contactId = Array.from(selectedContacts)[0];
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return { subject: '', body: '' };

    let subject = '';
    let body = '';

    if (mode === 'template') {
      const t = templates.find(temp => temp.id === selectedTemplate);
      if (t) {
        subject = t.subject;
        body = t.body;
      }
    } else {
      subject = customSubject;
      body = customBody;
    }

    const dict = { name: contact.name, email: contact.email, company: contact.company || 'your company' };
    
    // Fill placeholders
    let parsedSubject = subject;
    let parsedBody = body;
    for (const [k, v] of Object.entries(dict)) {
      parsedSubject = parsedSubject.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'gi'), v);
      parsedBody = parsedBody.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'gi'), v);
    }

    return { subject: parsedSubject, body: parsedBody, recipient: contact.name };
  };

  const groups = Array.from(new Set(contacts.map(c => c.groupName).filter(Boolean))) as string[];

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}><CardContent className="p-6"><div className="h-40 bg-muted rounded animate-pulse" /></CardContent></Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Contact Picker Sidebar */}
      <Card className="lg:col-span-1 h-fit">
        <CardHeader className="pb-3 border-b bg-muted/10">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4" /> Recipients
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs font-semibold px-2">
              {getFilteredContacts().every(c => selectedContacts.has(c.id)) ? 'Deselect All' : 'Select All'}
            </Button>
          </div>
          <CardDescription className="text-xs mt-1">
            {selectedContacts.size} of {contacts.length} contacts selected
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {/* Quick Filters */}
          <div className="space-y-2">
            <Input
              placeholder="Search segment..."
              value={contactSearch}
              onChange={(e) => setContactSearch(e.target.value)}
              className="text-xs h-8"
            />
            <select
              value={contactFilterGroup}
              onChange={(e) => setContactFilterGroup(e.target.value)}
              className="w-full bg-background border rounded-md p-1.5 text-xs outline-none cursor-pointer"
            >
              <option value="all">All Groups</option>
              {groups.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
            {getFilteredContacts().map((contact) => (
              <label
                key={contact.id}
                className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer border transition-all ${
                  selectedContacts.has(contact.id) ? 'bg-primary/5 border-primary/30' : 'hover:bg-muted/40 border-transparent'
                }`}
              >
                <Checkbox
                  checked={selectedContacts.has(contact.id)}
                  onCheckedChange={() => toggleContact(contact.id)}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate text-foreground">{contact.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{contact.email}</p>
                </div>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Campaign Content and Assistant Area */}
      <div className="lg:col-span-2 space-y-4">
        {/* Mode Toggles */}
        <Card>
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Mode:</Label>
              <div className="flex items-center gap-1.5">
                <Button variant={mode === 'template' ? 'default' : 'outline'} size="sm" onClick={() => setMode('template')} className="text-xs h-8">
                  <FileText className="w-3.5 h-3.5 mr-1" /> Template
                </Button>
                <Button variant={mode === 'custom' ? 'default' : 'outline'} size="sm" onClick={() => setMode('custom')} className="text-xs h-8">
                  <Mail className="w-3.5 h-3.5 mr-1" /> Custom
                </Button>
              </div>
            </div>
            {mode === 'custom' && (
              <Button variant="outline" size="sm" onClick={() => setCustomBody('')} className="text-xs h-8 text-destructive">
                Clear
              </Button>
            )}
          </CardContent>
        </Card>

        {/* AI Writer Assistant */}
        <Card className="border-violet-500/20 bg-violet-500/[0.01]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-violet-600 dark:text-violet-400 flex items-center gap-2 uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-violet-500 animate-pulse" /> AI Email Writer Assistant
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Enter AI guidelines (e.g. Recruiter introduction follow-up for Senior Software Engineer)..."
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                className="text-xs h-9"
              />
              <select
                value={aiTone}
                onChange={(e) => setAiTone(e.target.value)}
                className="bg-background border rounded-md px-2 text-xs outline-none cursor-pointer h-9 font-medium"
              >
                <option value="professional">Professional</option>
                <option value="friendly">Friendly</option>
                <option value="urgent">Urgent</option>
                <option value="cold email">Cold Email</option>
              </select>
              <Button
                onClick={handleGenerateAI}
                disabled={generatingAI}
                className="bg-violet-600 hover:bg-violet-500 text-white shrink-0 shadow shadow-violet-600/10 h-9"
                size="sm"
              >
                {generatingAI ? 'Writing...' : 'Write'}
              </Button>
            </div>

            {aiResult && (
              <div className="border rounded-lg p-4 bg-muted/20 space-y-3">
                <p className="text-xs text-muted-foreground font-semibold">Generated Copy Preview:</p>
                <pre className="text-xs whitespace-pre-wrap font-sans leading-relaxed text-foreground/80">{aiResult}</pre>
                <Button size="sm" onClick={applyAIText} className="bg-violet-600 hover:bg-violet-500 text-white">
                  Apply to Body
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Content Details */}
        {mode === 'template' ? (
          <Card>
            <CardHeader className="pb-3 border-b bg-muted/5">
              <CardTitle className="text-sm font-bold uppercase tracking-wider">Select Template</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {templates.filter(t => t.isActive).length === 0 ? (
                <p className="text-xs text-muted-foreground py-6 text-center">No active templates available.</p>
              ) : (
                <div className="grid gap-2 max-h-64 overflow-y-auto">
                  {templates.filter(t => t.isActive).map((t) => (
                    <label
                      key={t.id}
                      onClick={() => setSelectedTemplate(t.id)}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedTemplate === t.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/30 border-muted'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-950/30 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-foreground">{t.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{t.subject}</p>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        selectedTemplate === t.id ? 'border-primary' : 'border-muted-foreground/30'
                      }`}>
                        {selectedTemplate === t.id && <div className="w-2 h-2 rounded-full bg-primary" />}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-3 border-b bg-muted/5">
              <CardTitle className="text-sm font-bold uppercase tracking-wider">Custom Composer</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="customSubject" className="text-xs font-bold">Subject Line *</Label>
                <Input
                  id="customSubject"
                  placeholder="Hello {{name}}, welcome to {{company}}!"
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                  className="text-xs h-9"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="customBody" className="text-xs font-bold">Email Body *</Label>
                <Textarea
                  id="customBody"
                  placeholder="Dear {{name}},..."
                  value={customBody}
                  onChange={(e) => setCustomBody(e.target.value)}
                  rows={8}
                  className="font-mono text-xs leading-relaxed"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Attachments Section */}
        <Card>
          <CardHeader className="pb-2 bg-muted/5">
            <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Paperclip className="w-4 h-4" /> Attachments
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <label htmlFor="attachment-upload" className="cursor-pointer">
                <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 bg-muted/40 hover:bg-muted/70 text-xs font-bold transition-colors">
                  <Upload className="w-3.5 h-3.5" /> Select Files
                </div>
              </label>
              <input
                id="attachment-upload"
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
              <span className="text-[10px] text-muted-foreground">Select multiple attachments (Resume, Portfolio, etc.)</span>
            </div>

            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attachments.map((att, index) => (
                  <div key={index} className="flex items-center gap-1.5 px-3 py-1 rounded-lg border bg-muted/50 text-xs">
                    <span className="font-semibold">{att.filename}</span>
                    <button onClick={() => removeAttachment(index)} className="text-destructive font-bold hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dispatch Action */}
        <Card>
          <CardContent className="p-4">
            {sendResult ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <span className="font-bold text-sm">Campaign Complete</span>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-extrabold">{sendResult.total}</p>
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase">Total</p>
                  </div>
                  <div className="text-center p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg">
                    <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">{sendResult.success}</p>
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase">Sent</p>
                  </div>
                  <div className="text-center p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                    <p className="text-2xl font-extrabold text-red-600 dark:text-red-400">{sendResult.failed}</p>
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase">Failed</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setSendResult(null)} className="w-full text-xs">
                  New Campaign
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {sending && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-muted-foreground">Sending campaign...</span>
                      <span>{Math.round(sendProgress)}%</span>
                    </div>
                    <Progress value={sendProgress} className="h-2" />
                  </div>
                )}
                
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold">
                      {selectedContacts.size} recipient{selectedContacts.size !== 1 ? 's' : ''} target
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">
                      {mode === 'template' ? 'Using Template' : 'Using Custom email'}
                    </p>
                  </div>

                  <Button
                    onClick={initiateSend}
                    disabled={sending || selectedContacts.size === 0}
                    className="bg-primary hover:bg-primary/95 text-primary-foreground shadow shadow-primary/20 px-6"
                    size="lg"
                  >
                    {sending ? (
                      'Sending...'
                    ) : (
                      <>
                        <Zap className="w-4 h-4 mr-1.5" /> Bulk Send
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Safety campaign preview dialog */}
      <Dialog open={safetyOpen} onOpenChange={setSafetyOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
              <AlertTriangle className="w-5 h-5" /> Campaign Review
            </DialogTitle>
            <DialogDescription>Verify campaign parameters to protect your email reputation.</DialogDescription>
          </DialogHeader>

          {selectedContacts.size > 0 && (
            <div className="space-y-4 py-2 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-muted/40 rounded-lg">
                <div>
                  <span className="font-semibold text-muted-foreground">Recipients:</span>
                  <p className="font-bold text-foreground mt-0.5">{selectedContacts.size} contacts</p>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground">Provider Mode:</span>
                  <p className="font-bold text-foreground mt-0.5">{dryRun ? 'Dry-Run simulation' : 'SMTP Live Send'}</p>
                </div>
              </div>

              {/* Sample Variable Interpolation Preview */}
              <div className="border rounded-lg p-3 bg-muted/20">
                <span className="font-bold text-muted-foreground block border-b pb-1.5 uppercase text-[9px] tracking-wider mb-2">
                  Campaign Sample Preview ({getPreviewEmail().recipient}):
                </span>
                <p className="font-bold mb-2">Subject: {getPreviewEmail().subject}</p>
                <pre className="whitespace-pre-wrap font-sans text-muted-foreground leading-normal text-[11px] max-h-40 overflow-y-auto">
                  {getPreviewEmail().body}
                </pre>
              </div>

              {/* Adjust sending rate */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold">Spacing Delay: {sendDelay} seconds</Label>
                  <input
                    type="range"
                    min={0.5}
                    max={5.0}
                    step={0.5}
                    value={sendDelay}
                    onChange={(e) => setSendDelay(parseFloat(e.target.value))}
                    className="w-32 accent-primary cursor-pointer"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="dryRun" checked={dryRun} onCheckedChange={(c) => setDryRun(!!c)} />
                  <Label htmlFor="dryRun" className="cursor-pointer font-bold">Simulate (Dry-Run without sending)</Label>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSafetyOpen(false)}>Cancel</Button>
            <Button variant="default" size="sm" onClick={handleBulkSend} className="bg-emerald-600 hover:bg-emerald-500 text-white">
              Confirm & Launch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
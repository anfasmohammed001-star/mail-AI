'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { FileText, Pencil, Trash2, Plus, Eye, Sparkles, RefreshCw } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function TemplatesTab() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [previewData, setPreviewData] = useState({ name: 'Alice Johnson', email: 'alice@example.com', company: 'TechCorp' });
  const { toast } = useToast();

  const [form, setForm] = useState({ name: '', subject: '', body: '', category: 'general' });

  const fetchTemplates = useCallback(() => {
    fetch('/api/templates')
      .then(r => { if (!r.ok) throw new Error('Network error'); return r.json(); })
      .then((d) => { setTemplates(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  // AI Generation States
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiTone, setAiTone] = useState('formal');
  const [generating, setGenerating] = useState(false);

  const resetForm = () => {
    setForm({ name: '', subject: '', body: '', category: 'general' });
    setEditingTemplate(null);
    setAiPrompt('');
    setAiTone('formal');
  };

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/ai/template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiPrompt,
          tone: aiTone,
          category: form.category,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setForm({
          name: data.name || form.name,
          subject: data.subject || form.subject,
          body: data.body || form.body,
          category: form.category,
        });
        toast({ title: 'Template Generated', description: 'AI has populated the template fields below.' });
      } else {
        toast({ title: 'AI Error', description: data.error || 'Failed to generate template.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to contact AI service.', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const openCreate = () => { resetForm(); setDialogOpen(true); };

  const openEdit = (template: Template) => {
    setEditingTemplate(template);
    setForm({ name: template.name, subject: template.subject, body: template.body, category: template.category });
    setDialogOpen(true);
  };

  const openPreview = (template: Template) => {
    setPreviewTemplate(template);
    setPreviewOpen(true);
  };

  const fillPlaceholders = (text: string) => {
    let result = text;
    result = result.replace(/\{\{name\}\}/g, previewData.name);
    result = result.replace(/\{\{email\}\}/g, previewData.email);
    result = result.replace(/\{\{company\}\}/g, previewData.company);
    return result;
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.subject.trim() || !form.body.trim()) {
      toast({ title: 'Validation Error', description: 'Name, subject, and body are required.', variant: 'destructive' });
      return;
    }

    try {
      if (editingTemplate) {
        await fetch('/api/templates', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingTemplate.id, ...form }),
        });
        toast({ title: 'Template Updated', description: `"${form.name}" has been updated.` });
      } else {
        await fetch('/api/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        toast({ title: 'Template Created', description: `"${form.name}" has been created.` });
      }
      setDialogOpen(false);
      resetForm();
      fetchTemplates();
    } catch {
      toast({ title: 'Error', description: 'Failed to save template.', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/templates?id=${id}`, { method: 'DELETE' });
    toast({ title: 'Deleted', description: 'Template removed.' });
    fetchTemplates();
  };

  const handleToggleActive = async (template: Template) => {
    await fetch('/api/templates', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: template.id, isActive: !template.isActive }),
    });
    fetchTemplates();
  };

  const handleLoadSample = () => {
    resetForm();
    setForm({
      name: 'Welcome Email',
      subject: 'Welcome aboard, {{name}}!',
      body: `Dear {{name}},

Welcome to our platform! We're thrilled to have you on board.

Here's what you can do next:
- Explore your dashboard
- Set up your profile
- Connect with your team

If you have any questions, don't hesitate to reach out at support@example.com.

Best regards,
The Team`,
      category: 'notification',
    });
    setDialogOpen(true);
  };

  const categoryColors: Record<string, string> = {
    general: 'bg-slate-100 text-slate-700',
    marketing: 'bg-violet-100 text-violet-700',
    notification: 'bg-amber-100 text-amber-700',
    followup: 'bg-emerald-100 text-emerald-700',
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Email Templates
              </CardTitle>
              <CardDescription>
                {templates.length} templates &bull; {templates.filter((t) => t.isActive).length} active
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {templates.length === 0 && (
                <Button variant="outline" size="sm" onClick={handleLoadSample}>
                  <FileText className="w-4 h-4 mr-1.5" /> Load Sample
                </Button>
              )}
              <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
                <DialogTrigger asChild>
                  <Button size="sm" onClick={openCreate}>
                    <Plus className="w-4 h-4 mr-1.5" /> New Template
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingTemplate ? 'Edit Template' : 'Create Template'}</DialogTitle>
                    <DialogDescription>
                      Use {'{{name}}'}, {'{{email}}'}, {'{{company}}'} as placeholders.
                    </DialogDescription>
                  </DialogHeader>

                  {!editingTemplate && (
                    <div className="border rounded-xl p-4 bg-violet-500/5 border-violet-500/20 space-y-3 mt-2">
                      <h4 className="text-xs font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 animate-pulse" /> AI Template Generator
                      </h4>
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <Input
                            placeholder="Describe what you want the email to say (e.g. invite candidate to interview for developer role)..."
                            value={aiPrompt}
                            onChange={(e) => setAiPrompt(e.target.value)}
                            className="text-xs h-9 flex-1"
                            disabled={generating}
                          />
                          <Select value={aiTone} onValueChange={setAiTone} disabled={generating}>
                            <SelectTrigger className="w-28 text-xs h-9 capitalize"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="formal">Formal</SelectItem>
                              <SelectItem value="casual">Casual</SelectItem>
                              <SelectItem value="friendly">Friendly</SelectItem>
                              <SelectItem value="sales">Sales</SelectItem>
                              <SelectItem value="direct">Direct</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            onClick={handleAIGenerate}
                            disabled={generating || !aiPrompt.trim()}
                            size="sm"
                            className="bg-violet-600 hover:bg-violet-500 text-white shrink-0 h-9"
                          >
                            {generating ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Generating...
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Generate
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid gap-4 py-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Template Name *</Label>
                        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Welcome Email" />
                      </div>
                      <div className="grid gap-2">
                        <Label>Category</Label>
                        <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="general">General</SelectItem>
                            <SelectItem value="marketing">Marketing</SelectItem>
                            <SelectItem value="notification">Notification</SelectItem>
                            <SelectItem value="followup">Follow-up</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label>Subject Line *</Label>
                      <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Hello {{name}}, welcome!" />
                    </div>
                    <div className="grid gap-2">
                      <Label>Email Body *</Label>
                      <Textarea
                        value={form.body}
                        onChange={(e) => setForm({ ...form, body: e.target.value })}
                        placeholder="Dear {{name}},..."
                        rows={10}
                        className="font-mono text-sm max-h-[350px] overflow-y-auto"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
                    <Button onClick={handleSave}>{editingTemplate ? 'Update' : 'Create'}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-muted rounded" />)}</div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground font-medium">No templates yet</p>
              <p className="text-sm text-muted-foreground/70 mt-1">Create email templates with placeholders for personalized bulk sending.</p>
            </div>
          ) : (
            <div className="grid gap-3 max-h-[500px] overflow-y-auto">
              {templates.map((template) => (
                <div key={template.id} className="border rounded-lg p-4 hover:shadow-sm transition-shadow">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-sm">{template.name}</h4>
                        <Badge variant="outline" className={`text-[10px] ${categoryColors[template.category] || categoryColors.general}`}>
                          {template.category}
                        </Badge>
                        {!template.isActive && (
                          <Badge variant="secondary" className="text-[10px]">inactive</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{template.subject}</p>
                      <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-2">{template.body.substring(0, 120)}...</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openPreview(template)}>
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(template)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Switch
                        checked={template.isActive}
                        onCheckedChange={() => handleToggleActive(template)}
                        className="scale-75"
                      />
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(template.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Template Preview</DialogTitle>
            <DialogDescription>Preview how the template looks with sample data.</DialogDescription>
          </DialogHeader>
          {previewTemplate && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="grid gap-1.5">
                  <Label className="text-xs">Name</Label>
                  <Input size={1} value={previewData.name} onChange={(e) => setPreviewData({ ...previewData, name: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Email</Label>
                  <Input size={1} value={previewData.email} onChange={(e) => setPreviewData({ ...previewData, email: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Company</Label>
                  <Input size={1} value={previewData.company} onChange={(e) => setPreviewData({ ...previewData, company: e.target.value })} />
                </div>
              </div>
              <div className="border rounded-lg p-4 bg-muted/30">
                <p className="text-xs text-muted-foreground mb-2 font-medium">Subject:</p>
                <p className="text-sm font-medium mb-4">{fillPlaceholders(previewTemplate.subject)}</p>
                <p className="text-xs text-muted-foreground mb-2 font-medium">Body:</p>
                <pre className="text-sm whitespace-pre-wrap font-sans">{fillPlaceholders(previewTemplate.body)}</pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Shield, Plus, Pencil, Trash2, Zap, Info } from 'lucide-react';

interface Rule {
  id: string;
  name: string;
  description: string | null;
  conditions: string;
  replyTemplate: string;
  isActive: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

interface Condition {
  field: string;
  operator: string;
  value: string;
}

export function RulesTab() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const { toast } = useToast();

  const [form, setForm] = useState({
    name: '',
    description: '',
    conditions: [{ field: 'subject', operator: 'contains', value: '' }] as Condition[],
    replyTemplate: '',
    priority: 0,
  });

  const fetchRules = useCallback(() => {
    fetch('/api/rules')
      .then(r => { if (!r.ok) throw new Error('Network error'); return r.json(); })
      .then((d) => { setRules(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const resetForm = () => {
    setForm({
      name: '',
      description: '',
      conditions: [{ field: 'subject', operator: 'contains', value: '' }],
      replyTemplate: '',
      priority: 0,
    });
    setEditingRule(null);
  };

  const openCreate = () => { resetForm(); setDialogOpen(true); };

  const openEdit = (rule: Rule) => {
    setEditingRule(rule);
    setForm({
      name: rule.name,
      description: rule.description || '',
      conditions: JSON.parse(rule.conditions),
      replyTemplate: rule.replyTemplate,
      priority: rule.priority,
    });
    setDialogOpen(true);
  };

  const addCondition = () => {
    setForm({
      ...form,
      conditions: [...form.conditions, { field: 'subject', operator: 'contains', value: '' }],
    });
  };

  const updateCondition = (index: number, key: keyof Condition, value: string) => {
    const updated = [...form.conditions];
    updated[index] = { ...updated[index], [key]: value };
    setForm({ ...form, conditions: updated });
  };

  const removeCondition = (index: number) => {
    setForm({
      ...form,
      conditions: form.conditions.filter((_, i) => i !== index),
    });
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.replyTemplate.trim()) {
      toast({ title: 'Validation Error', description: 'Name and reply template are required.', variant: 'destructive' });
      return;
    }

    const hasEmptyCondition = form.conditions.some((c) => !c.value.trim());
    if (hasEmptyCondition) {
      toast({ title: 'Validation Error', description: 'All condition values must be filled.', variant: 'destructive' });
      return;
    }

    try {
      const payload = {
        ...form,
        conditions: form.conditions,
        priority: Number(form.priority),
      };

      if (editingRule) {
        await fetch('/api/rules', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingRule.id, ...payload }),
        });
        toast({ title: 'Rule Updated', description: `"${form.name}" has been updated.` });
      } else {
        await fetch('/api/rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        toast({ title: 'Rule Created', description: `"${form.name}" is now active.` });
      }
      setDialogOpen(false);
      resetForm();
      fetchRules();
    } catch {
      toast({ title: 'Error', description: 'Failed to save rule.', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/rules?id=${id}`, { method: 'DELETE' });
    toast({ title: 'Deleted', description: 'Rule removed.' });
    fetchRules();
  };

  const handleToggleActive = async (rule: Rule) => {
    await fetch('/api/rules', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: rule.id, isActive: !rule.isActive }),
    });
    fetchRules();
  };

  const handleLoadSample = () => {
    resetForm();
    setForm({
      name: 'Unsubscribe Handler',
      description: 'Automatically replies when someone asks to unsubscribe',
      conditions: [{ field: 'subject', operator: 'contains', value: 'unsubscribe' }],
      replyTemplate: `Dear {{name}},

We have received your request to unsubscribe from our mailing list. You have been successfully removed and will no longer receive emails from us.

If this was a mistake, you can re-subscribe at any time through our website.

Best regards,
The Team`,
      priority: 5,
    });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Auto-Response Rules
              </CardTitle>
              <CardDescription>
                {rules.length} rules &bull; {rules.filter((r) => r.isActive).length} active
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {rules.length === 0 && (
                <Button variant="outline" size="sm" onClick={handleLoadSample}>
                  <Zap className="w-4 h-4 mr-1.5" /> Load Sample Rule
                </Button>
              )}
              <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
                <DialogTrigger asChild>
                  <Button size="sm" onClick={openCreate}>
                    <Plus className="w-4 h-4 mr-1.5" /> New Rule
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingRule ? 'Edit Rule' : 'Create Auto-Response Rule'}</DialogTitle>
                    <DialogDescription>
                      Define conditions to match incoming emails and automatic reply templates.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Rule Name *</Label>
                        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Unsubscribe Handler" />
                      </div>
                      <div className="grid gap-2">
                        <Label>Priority (0-10)</Label>
                        <Input type="number" min={0} max={10} value={form.priority} onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 0 })} />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label>Description</Label>
                      <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What this rule does" />
                    </div>

                    {/* Conditions */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Conditions</Label>
                        <Button variant="outline" size="sm" onClick={addCondition}>
                          <Plus className="w-3.5 h-3.5 mr-1" /> Add Condition
                        </Button>
                      </div>
                      {form.conditions.map((cond, index) => (
                        <div key={index} className="flex flex-col sm:flex-row sm:items-end gap-2 bg-muted/10 p-3 rounded-lg border sm:bg-transparent sm:p-0 sm:border-0">
                          <div className="flex-1">
                            <Label className="text-xs">Field</Label>
                            <Select value={cond.field} onValueChange={(v) => updateCondition(index, 'field', v)}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="subject">Subject</SelectItem>
                                <SelectItem value="from">From</SelectItem>
                                <SelectItem value="body">Body</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex-1">
                            <Label className="text-xs">Operator</Label>
                            <Select value={cond.operator} onValueChange={(v) => updateCondition(index, 'operator', v)}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="contains">Contains</SelectItem>
                                <SelectItem value="equals">Equals</SelectItem>
                                <SelectItem value="startsWith">Starts with</SelectItem>
                                <SelectItem value="regex">Matches regex</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex-[2]">
                            <Label className="text-xs">Value</Label>
                            <Input value={cond.value} onChange={(e) => updateCondition(index, 'value', e.target.value)} placeholder="unsubscribe" />
                          </div>
                          {form.conditions.length > 1 && (
                            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => removeCondition(index)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="grid gap-2">
                      <Label>Reply Template *</Label>
                      <Textarea
                        value={form.replyTemplate}
                        onChange={(e) => setForm({ ...form, replyTemplate: e.target.value })}
                        placeholder={`Dear {{name}},\n\nThank you for your email...\n\nBest regards`}
                        rows={6}
                        className="font-mono text-sm max-h-[250px] overflow-y-auto"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
                    <Button onClick={handleSave}>{editingRule ? 'Update' : 'Create Rule'}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-muted rounded" />)}</div>
          ) : rules.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground font-medium">No rules configured</p>
              <p className="text-sm text-muted-foreground/70 mt-1">Create auto-response rules to handle incoming emails automatically.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => {
                const conditions: Condition[] = JSON.parse(rule.conditions);
                return (
                  <div key={rule.id} className="border rounded-lg p-4 hover:shadow-sm transition-shadow">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-sm">{rule.name}</h4>
                          <Badge variant={rule.isActive ? 'default' : 'secondary'} className="text-[10px]">
                            {rule.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            Priority: {rule.priority}
                          </Badge>
                        </div>
                        {rule.description && (
                          <p className="text-xs text-muted-foreground mb-2">{rule.description}</p>
                        )}
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {conditions.map((cond, i) => (
                            <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted text-xs">
                              <span className="font-medium">{cond.field}</span>
                              <span className="text-muted-foreground">{cond.operator}</span>
                              <span className="font-mono">&quot;{cond.value}&quot;</span>
                            </span>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground/70 line-clamp-2">
                          Reply: {rule.replyTemplate.substring(0, 100)}...
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(rule)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Switch
                          checked={rule.isActive}
                          onCheckedChange={() => handleToggleActive(rule)}
                          className="scale-75"
                        />
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(rule.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Pencil, Trash2, Upload, Users } from 'lucide-react';

interface Contact {
  id: string;
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  customFields: string | null;
  createdAt: string;
}

export function ContactsTab() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const [form, setForm] = useState({ name: '', email: '', company: '', phone: '' });

  const fetchContacts = useCallback(() => {
    fetch('/api/contacts')
      .then((r) => r.json())
      .then((d) => { setContacts(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const resetForm = () => {
    setForm({ name: '', email: '', company: '', phone: '' });
    setEditingContact(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (contact: Contact) => {
    setEditingContact(contact);
    setForm({
      name: contact.name,
      email: contact.email,
      company: contact.company || '',
      phone: contact.phone || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      toast({ title: 'Validation Error', description: 'Name and email are required.', variant: 'destructive' });
      return;
    }

    try {
      if (editingContact) {
        await fetch('/api/contacts', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingContact.id, ...form }),
        });
        toast({ title: 'Contact Updated', description: `${form.name} has been updated.` });
      } else {
        const res = await fetch('/api/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        if (!res.ok) {
          const err = await res.json();
          toast({ title: 'Error', description: err.error || 'Failed to add contact.', variant: 'destructive' });
          return;
        }
        toast({ title: 'Contact Added', description: `${form.name} has been added.` });
      }
      setDialogOpen(false);
      resetForm();
      fetchContacts();
    } catch {
      toast({ title: 'Error', description: 'Failed to save contact.', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/contacts?id=${id}`, { method: 'DELETE' });
    toast({ title: 'Deleted', description: 'Contact removed.' });
    fetchContacts();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    for (const id of selectedIds) {
      await fetch(`/api/contacts?id=${id}`, { method: 'DELETE' });
    }
    toast({ title: 'Bulk Deleted', description: `${selectedIds.size} contacts removed.` });
    setSelectedIds(new Set());
    fetchContacts();
  };

  const handleImportSample = async () => {
    const sampleContacts = [
      { name: 'Alice Johnson', email: 'alice@techcorp.com', company: 'TechCorp', phone: '+1-555-0101' },
      { name: 'Bob Smith', email: 'bob@innovate.io', company: 'Innovate.io', phone: '+1-555-0102' },
      { name: 'Carol Davis', email: 'carol@designlab.co', company: 'DesignLab', phone: '+1-555-0103' },
      { name: 'David Chen', email: 'david@dataflow.dev', company: 'DataFlow', phone: '+1-555-0104' },
      { name: 'Eva Martinez', email: 'eva@cloudnine.net', company: 'CloudNine', phone: '+1-555-0105' },
      { name: 'Frank Wilson', email: 'frank@startupxyz.com', company: 'StartupXYZ', phone: '+1-555-0106' },
      { name: 'Grace Lee', email: 'grace@fintech.co', company: 'FinTech Co', phone: '+1-555-0107' },
      { name: 'Henry Brown', email: 'henry@mediapro.org', company: 'MediaPro', phone: '+1-555-0108' },
    ];

    let added = 0;
    for (const c of sampleContacts) {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(c),
      });
      if (res.ok) added++;
    }

    toast({ title: 'Sample Data Imported', description: `${added} sample contacts added.` });
    fetchContacts();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4" />
                Contacts
              </CardTitle>
              <CardDescription>
                {contacts.length}/100 contacts &bull; {selectedIds.size > 0 && `${selectedIds.size} selected`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {contacts.length === 0 && (
                <Button variant="outline" size="sm" onClick={handleImportSample}>
                  <Upload className="w-4 h-4 mr-1.5" /> Import Samples
                </Button>
              )}
              {selectedIds.size > 0 && (
                <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                  <Trash2 className="w-4 h-4 mr-1.5" /> Delete ({selectedIds.size})
                </Button>
              )}
              <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
                <DialogTrigger asChild>
                  <Button size="sm" onClick={openCreate}>
                    <UserPlus className="w-4 h-4 mr-1.5" /> Add Contact
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingContact ? 'Edit Contact' : 'Add New Contact'}</DialogTitle>
                    <DialogDescription>
                      {editingContact ? 'Update contact information.' : 'Add a new email contact to your list.'}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-2">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Name *</Label>
                      <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="John Doe" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="john@example.com" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="company">Company</Label>
                        <Input id="company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Acme Inc." />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="phone">Phone</Label>
                        <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1-555-0100" />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
                    <Button onClick={handleSave}>{editingContact ? 'Update' : 'Add Contact'}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-muted rounded" />
              ))}
            </div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground font-medium">No contacts yet</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Add contacts manually or import sample data to get started.
              </p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={contacts.length > 0 && selectedIds.size === contacts.length}
                          onCheckedChange={(checked) => {
                            if (checked) setSelectedIds(new Set(contacts.map((c) => c.id)));
                            else setSelectedIds(new Set());
                          }}
                        />
                      </TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="hidden sm:table-cell">Email</TableHead>
                      <TableHead className="hidden md:table-cell">Company</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contacts.map((contact) => (
                      <TableRow key={contact.id} className={selectedIds.has(contact.id) ? 'bg-muted/50' : ''}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(contact.id)}
                            onCheckedChange={() => toggleSelect(contact.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                              {contact.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{contact.name}</p>
                              <p className="text-xs text-muted-foreground sm:hidden">{contact.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm">{contact.email}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          {contact.company ? (
                            <Badge variant="secondary" className="text-xs">{contact.company}</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(contact)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(contact.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
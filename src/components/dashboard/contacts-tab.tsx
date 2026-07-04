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
import { UserPlus, Pencil, Trash2, Upload, Users, Search, Star, Filter, FileSpreadsheet, Globe, History, MailCheck, MailWarning, Clock } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface Contact {
  id: string;
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  tags: string | null;
  groupName: string | null;
  isFavorite: boolean;
  customFields: string | null;
  createdAt: string;
  sentEmails?: Array<{
    id: string;
    subject: string;
    sentAt: string | null;
    status: string;
  }>;
}

interface ParsedContact {
  tempId: string;
  name: string;
  email: string;
  company: string;
  phone: string;
  tags: string;
  groupName: string;
  isValid: boolean;
}

const validateEmail = (email: string) => {
  const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return re.test(email.trim());
};

const parseFileContent = (text: string, method: 'name_email' | 'email_only'): ParsedContact[] => {
  const lines = text.split(/\r?\n/);
  if (lines.length === 0) return [];

  const parsedList: ParsedContact[] = [];
  
  // Try to parse headers if any
  let headers: string[] = [];
  let nameIndex = -1;
  let emailIndex = -1;
  let companyIndex = -1;
  let phoneIndex = -1;
  let tagsIndex = -1;
  let groupIndex = -1;

  const firstLine = lines[0].trim();
  if (firstLine) {
    const rawHeaders = firstLine.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((h) => h.trim().toLowerCase().replace(/^["']|["']$/g, ''));
    const hasEmailHeader = rawHeaders.some(h => h.includes('email') || h.includes('mail'));
    if (hasEmailHeader) {
      headers = rawHeaders;
      nameIndex = headers.findIndex(h => h === 'name' || h === 'fullname' || h === 'full name' || h === 'username' || h === 'contact name');
      emailIndex = headers.findIndex(h => h.includes('email') || h.includes('mail') || h === 'address');
      companyIndex = headers.findIndex(h => h.includes('company') || h.includes('organization') || h.includes('work'));
      phoneIndex = headers.findIndex(h => h.includes('phone') || h.includes('mobile') || h.includes('tel'));
      tagsIndex = headers.findIndex(h => h === 'tags' || h === 'tag' || h === 'labels');
      groupIndex = headers.findIndex(h => h.includes('group'));
    }
  }

  const startRow = headers.length > 0 ? 1 : 0;

  for (let i = startRow; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    let values: string[] = [];
    try {
      values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((v) => v.trim().replace(/^["']|["']$/g, ''));
    } catch {
      values = line.split(',').map((v) => v.trim().replace(/^["']|["']$/g, ''));
    }
    
    let name = '';
    let email = '';
    let company = '';
    let phone = '';
    let tags = '';
    let groupName = '';

    if (method === 'email_only') {
      const emailMatch = line.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      if (emailMatch) {
        email = emailMatch[0];
        name = email.split('@')[0];
      } else {
        email = values[0] || '';
        name = email ? email.split('@')[0] : '';
      }
    } else {
      if (headers.length > 0) {
        email = emailIndex !== -1 ? values[emailIndex] || '' : '';
        name = nameIndex !== -1 ? values[nameIndex] || '' : '';
        company = companyIndex !== -1 ? values[companyIndex] || '' : '';
        phone = phoneIndex !== -1 ? values[phoneIndex] || '' : '';
        tags = tagsIndex !== -1 ? values[tagsIndex] || '' : '';
        groupName = groupIndex !== -1 ? values[groupIndex] || '' : '';
      } else {
        const emailColIdx = values.findIndex(v => /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(v));
        if (emailColIdx !== -1) {
          email = values[emailColIdx];
          const nameColIdx = values.findIndex((v, idx) => idx !== emailColIdx && v.length > 0);
          name = nameColIdx !== -1 ? values[nameColIdx] : email.split('@')[0];
        } else {
          email = values[0] || '';
          name = values[1] || (email ? email.split('@')[0] : '');
        }
      }
    }

    if (!name && email) {
      name = email.split('@')[0];
    }

    email = email.trim();
    name = name.trim();

    if (email || name) {
      parsedList.push({
        tempId: `${i}-${email}-${name}`,
        name,
        email,
        company: company.trim(),
        phone: phone.trim(),
        tags: tags.trim(),
        groupName: groupName.trim(),
        isValid: validateEmail(email)
      });
    }
  }

  return parsedList;
};

export function ContactsTab() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGroup, setFilterGroup] = useState<string>('all');
  const [filterFavorite, setFilterFavorite] = useState<boolean>(false);

  // Import State
  const [googleSheetUrl, setGoogleSheetUrl] = useState('');
  const [importing, setImporting] = useState(false);

  // Extraction & Preview State
  const [extractionMethod, setExtractionMethod] = useState<'name_email' | 'email_only'>('name_email');
  const [parsedContacts, setParsedContacts] = useState<ParsedContact[]>([]);
  const [selectedParsedIds, setSelectedParsedIds] = useState<Set<string>>(new Set());
  const [showPreview, setShowPreview] = useState(false);

  const { toast } = useToast();

  const [form, setForm] = useState({
    name: '',
    email: '',
    company: '',
    phone: '',
    tags: '',
    groupName: '',
    isFavorite: false,
  });

  const fetchContacts = useCallback(() => {
    fetch('/api/contacts')
      .then(r => { if (!r.ok) throw new Error('Network error'); return r.json(); })
      .then((d) => {
        setContacts(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const resetForm = () => {
    setForm({
      name: '',
      email: '',
      company: '',
      phone: '',
      tags: '',
      groupName: '',
      isFavorite: false,
    });
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
      tags: contact.tags || '',
      groupName: contact.groupName || '',
      isFavorite: contact.isFavorite,
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

  const toggleFavorite = async (contact: Contact) => {
    await fetch('/api/contacts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: contact.id, isFavorite: !contact.isFavorite }),
    });
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

  // Client-side CSV parser
  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseFileContent(text, extractionMethod);
        if (parsed.length === 0) {
          throw new Error('No contacts found in the file.');
        }
        setParsedContacts(parsed);
        const validIds = new Set(parsed.filter(c => c.isValid).map(c => c.tempId));
        setSelectedParsedIds(validIds);
        setShowPreview(true);
      } catch (err: any) {
        toast({ title: 'Import Failed', description: err.message || 'Error parsing CSV file.', variant: 'destructive' });
      } finally {
        setImporting(false);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Google Sheets Fetch Parser
  const handleGoogleSheetsImport = async () => {
    if (!googleSheetUrl.trim()) {
      toast({ title: 'Error', description: 'Enter a valid spreadsheet URL.', variant: 'destructive' });
      return;
    }

    setImporting(true);
    try {
      let exportUrl = googleSheetUrl;
      const sheetIdMatch = googleSheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (sheetIdMatch) {
        exportUrl = `https://docs.google.com/spreadsheets/d/${sheetIdMatch[1]}/export?format=csv`;
      }

      const res = await fetch(exportUrl);
      if (!res.ok) throw new Error('Failed to fetch spreadsheet. Make sure link sharing is enabled.');

      const text = await res.text();
      const parsed = parseFileContent(text, extractionMethod);
      if (parsed.length === 0) {
        throw new Error('No contacts found in the spreadsheet.');
      }
      setParsedContacts(parsed);
      const validIds = new Set(parsed.filter(c => c.isValid).map(c => c.tempId));
      setSelectedParsedIds(validIds);
      setShowPreview(true);
    } catch (err: any) {
      toast({ title: 'Google Sheets Import Failed', description: err.message || 'Ensure the sheet is public or link-shared.', variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  const handleConfirmImport = async () => {
    const selectedContacts = parsedContacts.filter(c => selectedParsedIds.has(c.tempId));
    if (selectedContacts.length === 0) {
      toast({ title: 'Warning', description: 'No contacts selected for import.', variant: 'destructive' });
      return;
    }

    setImporting(true);
    try {
      const res = await fetch('/api/contacts/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contacts: selectedContacts.map(c => ({
            name: c.name,
            email: c.email,
            company: c.company || null,
            phone: c.phone || null,
            tags: c.tags || null,
            groupName: c.groupName || null
          }))
        }),
      });

      const result = await res.json();
      if (res.ok) {
        toast({ title: 'Import Complete', description: `Successfully imported ${result.imported} contacts (${result.skipped} skipped).` });
        fetchContacts();
        setImportDialogOpen(false);
        setShowPreview(false);
        setParsedContacts([]);
        setSelectedParsedIds(new Set());
      } else {
        throw new Error(result.error);
      }
    } catch (err: any) {
      toast({ title: 'Import Failed', description: err.message || 'Failed to import contacts.', variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  const handleImportSample = async () => {
    const sampleContacts = [
      { name: 'Alice Johnson', email: 'alice@techcorp.com', company: 'TechCorp', phone: '+1-555-0101', tags: 'developer,lead', groupName: 'Tech Vendors' },
      { name: 'Bob Smith', email: 'bob@innovate.io', company: 'Innovate.io', phone: '+1-555-0102', tags: 'designer', groupName: 'Design Agencies' },
      { name: 'Carol Davis', email: 'carol@designlab.co', company: 'DesignLab', phone: '+1-555-0103', tags: 'marketing', groupName: 'Marketing Partners', isFavorite: true },
      { name: 'David Chen', email: 'david@dataflow.dev', company: 'DataFlow', phone: '+1-555-0104', tags: 'engineer', groupName: 'Tech Vendors' },
      { name: 'Grace Lee', email: 'grace@fintech.co', company: 'FinTech Co', phone: '+1-555-0107', tags: 'finance,partner', groupName: 'Investment' },
    ];

    const res = await fetch('/api/contacts/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contacts: sampleContacts }),
    });

    if (res.ok) {
      const data = await res.json();
      toast({ title: 'Sample Contacts Imported', description: `${data.imported} samples added successfully.` });
      fetchContacts();
    }
  };

  // Get distinct group names for filtering
  const groups = Array.from(new Set(contacts.map((c) => c.groupName).filter(Boolean))) as string[];

  // Filtered Contacts List
  const filteredContacts = contacts.filter((contact) => {
    const matchesSearch =
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (contact.company || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (contact.tags || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesGroup = filterGroup === 'all' || contact.groupName === filterGroup;
    const matchesFav = !filterFavorite || contact.isFavorite;

    return matchesSearch && matchesGroup && matchesFav;
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4" />
                Contact Directory
              </CardTitle>
              <CardDescription>
                {filteredContacts.length} of {contacts.length} contacts listed
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
                <Upload className="w-4 h-4 mr-1.5" /> Import
              </Button>
              {contacts.length === 0 && (
                <Button variant="outline" size="sm" onClick={handleImportSample}>
                  Import Samples
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
                    <DialogDescription>Input recipient profile parameters.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-2">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Full Name *</Label>
                      <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="John Doe" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="email">Email Address *</Label>
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
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="groupName">Group</Label>
                        <Input id="groupName" value={form.groupName} onChange={(e) => setForm({ ...form, groupName: e.target.value })} placeholder="Partners" />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="tags">Tags (comma-separated)</Label>
                        <Input id="tags" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="developer,lead" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1.5">
                      <Checkbox
                        id="isFavorite"
                        checked={form.isFavorite}
                        onCheckedChange={(checked) => setForm({ ...form, isFavorite: !!checked })}
                      />
                      <Label htmlFor="isFavorite" className="cursor-pointer text-xs font-semibold">Mark as Favorite</Label>
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

        {/* Search and Advanced Filters */}
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search contacts by name, email, tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              <div className="flex items-center gap-1 text-xs text-muted-foreground border rounded-lg p-1.5 bg-muted/50">
                <Filter className="w-3.5 h-3.5" />
                <span className="font-semibold mr-1">Group:</span>
                <select
                  value={filterGroup}
                  onChange={(e) => setFilterGroup(e.target.value)}
                  className="bg-transparent border-0 outline-0 text-foreground cursor-pointer font-bold capitalize text-xs"
                >
                  <option value="all">All Groups</option>
                  {groups.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              <Button
                variant={filterFavorite ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setFilterFavorite(!filterFavorite)}
                className="h-9 gap-1.5 text-xs font-semibold"
              >
                <Star className={`w-3.5 h-3.5 ${filterFavorite ? 'text-amber-500 fill-amber-500' : ''}`} />
                Favorites Only
              </Button>
            </div>
          </div>

          {/* Table Directory */}
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="text-center py-16 space-y-2">
              <Users className="w-12 h-12 mx-auto text-muted-foreground/30" />
              <p className="font-bold text-sm text-muted-foreground">No contacts found</p>
              <p className="text-xs text-muted-foreground/60">Import spreadsheet contacts or add manually to start.</p>
            </div>
          ) : (
            <div className="border rounded-xl overflow-hidden shadow-inner bg-muted/5">
              <div className="max-h-[500px] overflow-y-auto">
                <Table>
                  <TableHeader className="bg-muted/20">
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={filteredContacts.length > 0 && selectedIds.size === filteredContacts.length}
                          onCheckedChange={(checked) => {
                            if (checked) setSelectedIds(new Set(filteredContacts.map((c) => c.id)));
                            else setSelectedIds(new Set());
                          }}
                        />
                      </TableHead>
                      <TableHead>Recipient</TableHead>
                      <TableHead className="hidden sm:table-cell">Email</TableHead>
                      <TableHead className="hidden md:table-cell">Company / Group</TableHead>
                      <TableHead className="hidden lg:table-cell">Tags</TableHead>
                      <TableHead className="hidden sm:table-cell">Sent History</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredContacts.map((contact) => (
                      <TableRow key={contact.id} className={selectedIds.has(contact.id) ? 'bg-primary/5' : ''}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(contact.id)}
                            onCheckedChange={() => toggleSelect(contact.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                              {contact.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-sm">{contact.name}</span>
                                <button onClick={() => toggleFavorite(contact)} className="focus:outline-none">
                                  <Star className={`w-3.5 h-3.5 ${contact.isFavorite ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground/30 hover:text-amber-500'}`} />
                                </button>
                              </div>
                              <span className="text-[10px] text-muted-foreground sm:hidden">{contact.email}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-xs font-semibold text-muted-foreground">{contact.email}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex flex-col gap-0.5">
                            {contact.company && <span className="text-xs font-bold text-foreground">{contact.company}</span>}
                            {contact.groupName && <span className="text-[10px] text-muted-foreground font-semibold uppercase">{contact.groupName}</span>}
                            {!contact.company && !contact.groupName && <span className="text-xs text-muted-foreground">—</span>}
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="flex flex-wrap gap-1 max-w-[150px]">
                            {contact.tags ? (
                              contact.tags.split(',').map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-[9px] px-1.5 py-0 font-medium">
                                  {tag.trim()}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {(() => {
                            const sentList = contact.sentEmails || [];
                            const sentCount = sentList.length;
                            
                            if (sentCount === 0) {
                              return (
                                <Badge variant="outline" className="opacity-50 text-[10px] font-medium border-dashed bg-muted/20 text-muted-foreground select-none">
                                  0 Sent
                                </Badge>
                              );
                            }

                            return (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-7 text-[11px] font-semibold border-emerald-200/60 bg-emerald-50/30 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-950/40 dark:bg-emerald-950/10 dark:text-emerald-400 dark:hover:bg-emerald-950/20 px-2 py-1 gap-1 cursor-pointer transition-all duration-200 hover:shadow-xs animate-in fade-in zoom-in-95 duration-150"
                                  >
                                    <History className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                    {sentCount} {sentCount === 1 ? 'Email' : 'Emails'}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-80 p-3 shadow-md" align="start">
                                  <div className="space-y-3">
                                    <div className="flex items-center justify-between pb-2 border-b">
                                      <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                        <History className="w-3.5 h-3.5 text-primary" />
                                        Sent History
                                      </span>
                                      <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-bold uppercase max-w-[150px] truncate">
                                        {contact.name}
                                      </Badge>
                                    </div>
                                    <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                      {sentList.map((email) => (
                                        <div key={email.id} className="p-2 rounded-lg bg-muted/30 border border-muted/50 text-xs space-y-1 hover:bg-muted/50 transition-colors">
                                          <div className="font-semibold text-foreground truncate" title={email.subject}>
                                            {email.subject || '(No Subject)'}
                                          </div>
                                          <div className="flex items-center justify-between text-[10px] text-muted-foreground font-medium">
                                            <span className="flex items-center gap-1">
                                              <Clock className="w-3 h-3" />
                                              {email.sentAt ? new Date(email.sentAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : 'Pending'}
                                            </span>
                                            {email.status === 'sent' && (
                                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
                                                <MailCheck className="w-3 h-3" /> Sent
                                              </span>
                                            )}
                                            {email.status === 'failed' && (
                                              <span className="text-destructive font-semibold flex items-center gap-0.5">
                                                <MailWarning className="w-3 h-3" /> Failed
                                              </span>
                                            )}
                                            {email.status === 'pending' && (
                                              <span className="text-amber-600 font-semibold flex items-center gap-0.5">
                                                <Clock className="w-3 h-3" /> Pending
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-0.5">
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

      {/* Advanced Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={(open) => {
        setImportDialogOpen(open);
        if (!open) {
          setShowPreview(false);
          setParsedContacts([]);
          setSelectedParsedIds(new Set());
        }
      }}>
        <DialogContent className={showPreview ? "max-w-3xl" : "max-w-md"}>
          <DialogHeader>
            <DialogTitle>{showPreview ? 'Verify & Import Contacts' : 'Import Contacts'}</DialogTitle>
            <DialogDescription>
              {showPreview 
                ? 'Review extracted contact lists and validate emails before adding to directory.' 
                : 'Import your contacts list from CSV sheets or Google Sheets links.'}
            </DialogDescription>
          </DialogHeader>

          {showPreview ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-muted/20 p-3 rounded-lg border">
                <div className="text-xs space-y-1">
                  <div className="font-bold text-foreground">Import Summary</div>
                  <div className="text-muted-foreground flex gap-3">
                    <span>Total: <strong>{parsedContacts.length}</strong></span>
                    <span className="text-emerald-600 dark:text-emerald-400">Valid: <strong>{parsedContacts.filter(c => c.isValid).length}</strong></span>
                    <span className="text-destructive">Invalid: <strong>{parsedContacts.filter(c => !c.isValid).length}</strong></span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Selected: <strong>{selectedParsedIds.size}</strong>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden bg-card max-h-[300px] overflow-y-auto">
                <Table>
                  <TableHeader className="bg-muted/10">
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={parsedContacts.length > 0 && selectedParsedIds.size === parsedContacts.length}
                          onCheckedChange={(checked) => {
                            if (checked) setSelectedParsedIds(new Set(parsedContacts.map(c => c.tempId)));
                            else setSelectedParsedIds(new Set());
                          }}
                        />
                      </TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedContacts.map((contact) => (
                      <TableRow key={contact.tempId}>
                        <TableCell>
                          <Checkbox
                            checked={selectedParsedIds.has(contact.tempId)}
                            onCheckedChange={() => {
                              setSelectedParsedIds(prev => {
                                const next = new Set(prev);
                                if (next.has(contact.tempId)) next.delete(contact.tempId);
                                else next.add(contact.tempId);
                                return next;
                              });
                            }}
                          />
                        </TableCell>
                        <TableCell className="text-xs font-medium">{contact.name}</TableCell>
                        <TableCell className="text-xs font-mono">{contact.email}</TableCell>
                        <TableCell>
                          {contact.isValid ? (
                            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 text-[10px] py-0 px-1.5 font-semibold">
                              Valid
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400 border border-red-200 text-[10px] py-0 px-1.5 font-semibold">
                              Invalid
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-between gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowPreview(false);
                    setParsedContacts([]);
                    setSelectedParsedIds(new Set());
                  }}
                  disabled={importing}
                >
                  Back
                </Button>
                <Button
                  onClick={handleConfirmImport}
                  disabled={importing || selectedParsedIds.size === 0}
                  size="sm"
                  className="bg-primary text-primary-foreground font-semibold"
                >
                  {importing ? 'Importing...' : `Import Selected (${selectedParsedIds.size})`}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-5 py-2">
              {/* Extraction Method Selector */}
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Extraction Method</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={extractionMethod === 'name_email' ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() => setExtractionMethod('name_email')}
                    className="text-xs font-semibold justify-start gap-2 h-9"
                  >
                    <Users className="w-3.5 h-3.5 text-primary" />
                    Name & Email
                  </Button>
                  <Button
                    type="button"
                    variant={extractionMethod === 'email_only' ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() => setExtractionMethod('email_only')}
                    className="text-xs font-semibold justify-start gap-2 h-9"
                  >
                    <Globe className="w-3.5 h-3.5 text-violet-500" />
                    Email Only
                  </Button>
                </div>
              </div>

              {/* CSV File Upload */}
              <div className="space-y-2 border-2 border-dashed rounded-xl p-6 text-center hover:bg-muted/10 transition-colors">
                <FileSpreadsheet className="w-8 h-8 text-muted-foreground/60 mx-auto" />
                <div className="text-xs">
                  <label htmlFor="csv-file" className="cursor-pointer text-primary font-bold hover:underline">
                    Upload CSV File
                  </label>
                  <input
                    id="csv-file"
                    type="file"
                    accept=".csv"
                    onChange={handleCsvUpload}
                    disabled={importing}
                    className="hidden"
                  />
                  <p className="text-muted-foreground mt-1">Accepts headers: name, email, company, phone, tags, group</p>
                </div>
              </div>

              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t"></div></div>
                <span className="relative bg-card px-2.5 text-[10px] text-muted-foreground font-bold uppercase">or</span>
              </div>

              {/* Google Sheets Import */}
              <div className="space-y-3">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Import from Google Sheets</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Paste shared Google Sheets URL..."
                    value={googleSheetUrl}
                    onChange={(e) => setGoogleSheetUrl(e.target.value)}
                    className="text-xs h-9"
                    disabled={importing}
                  />
                  <Button
                    onClick={handleGoogleSheetsImport}
                    disabled={importing || !googleSheetUrl.trim()}
                    className="bg-primary text-primary-foreground h-9"
                    size="sm"
                  >
                    {importing ? 'Importing...' : 'Fetch'}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground leading-normal">
                  Make sure link sharing is enabled in Google Sheets (set to &quot;Anyone with the link can view&quot;) so the agent can parse it.
                </p>
              </div>
            </div>
          )}
          {!showPreview && (
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(false)}>Close</Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Floating Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-background/95 backdrop-blur border shadow-lg rounded-xl px-5 py-3.5 flex items-center gap-6 animate-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
              {selectedIds.size}
            </span>
            <span className="text-xs font-semibold text-muted-foreground">contacts selected</span>
          </div>

          <div className="h-4 w-px bg-border" />

          <div className="flex items-center gap-2">
            {selectedIds.size < filteredContacts.length ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs font-semibold h-8"
                onClick={() => setSelectedIds(new Set(filteredContacts.map((c) => c.id)))}
              >
                Select All ({filteredContacts.length})
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs font-semibold h-8"
                onClick={() => setSelectedIds(new Set())}
              >
                Deselect All
              </Button>
            )}

            <Button
              variant="destructive"
              size="sm"
              className="text-xs font-bold h-8 gap-1.5"
              onClick={handleBulkDelete}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Selected
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Inbox,
  RefreshCw,
  Flag,
  Trash2,
  Shield,
  Search,
  Sparkles,
  Check,
  Send,
  CornerUpLeft,
  X,
  AlertCircle,
  FileText
} from 'lucide-react';

interface ReceivedEmail {
  id: string;
  fromEmail: string;
  fromName: string | null;
  subject: string;
  body: string | null;
  isRead: boolean;
  isFlagged: boolean;
  flagReason: string | null;
  autoReplied: boolean;
  receivedAt: string;
  category: string | null;
  summary: string | null;
  extractedInfo: string | null;
  aiReplyDraft: string | null;
  aiReplyStatus: string;
  contact?: { id: string; name: string } | null;
}

export function InboxTab() {
  const [emails, setEmails] = useState<ReceivedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<ReceivedEmail | null>(null);
  
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterRead, setFilterRead] = useState<'all' | 'unread' | 'read'>('all');

  // AI Reply Editor
  const [isEditingDraft, setIsEditingDraft] = useState(false);
  const [draftContent, setDraftContent] = useState('');
  const [customGuidance, setCustomGuidance] = useState('');
  const [generatingReply, setGeneratingReply] = useState(false);

  const { toast } = useToast();

  const fetchEmails = useCallback(() => {
    fetch('/api/emails?type=received')
      .then((r) => r.json())
      .then((d) => {
        setEmails(d);
        setLoading(false);
        // Refresh selected email reference if open
        setSelectedEmail((prev) => {
          if (!prev) return null;
          const updated = d.find((e: ReceivedEmail) => e.id === prev.id);
          return updated || prev;
        });
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  // Sync / Simulate Email Fetch
  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/simulate/inbox', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        toast({ title: 'Inbox Synced', description: `${data.received} new messages downloaded.` });
        fetchEmails();
      } else {
        toast({ title: 'Sync Error', description: data.error || 'Failed to sync.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to sync inbox.', variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  const handleMarkRead = async (id: string, isRead: boolean) => {
    await fetch('/api/emails', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, type: 'received', isRead }),
    });
    fetchEmails();
  };

  const handleToggleFlag = async (email: ReceivedEmail) => {
    await fetch('/api/emails', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: email.id,
        type: 'received',
        isFlagged: !email.isFlagged,
        flagReason: !email.isFlagged ? 'Flagged by user' : null,
      }),
    });
    fetchEmails();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/emails?id=${id}&type=received`, { method: 'DELETE' });
    toast({ title: 'Deleted', description: 'Email has been deleted.' });
    setSelectedEmail(null);
    fetchEmails();
  };

  // AI Reply Actions
  const handleGenerateReply = async () => {
    if (!selectedEmail) return;
    setGeneratingReply(true);
    try {
      const res = await fetch('/api/ai/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailId: selectedEmail.id, instruction: customGuidance }),
      });
      const data = await res.json();
      if (res.ok) {
        setDraftContent(data.replyDraft);
        toast({ title: 'Draft Generated', description: 'AI has drafted a reply.' });
        fetchEmails();
      } else {
        toast({ title: 'AI Error', description: data.error || 'Failed to draft reply.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to call AI service.', variant: 'destructive' });
    } finally {
      setGeneratingReply(false);
    }
  };

  const handleSendReply = async () => {
    if (!selectedEmail || !draftContent.trim()) return;
    setGeneratingReply(true);
    try {
      // SMTP single send using /api/emails
      const res = await fetch('/api/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toEmail: selectedEmail.fromEmail,
          toName: selectedEmail.fromName,
          subject: `Re: ${selectedEmail.subject}`,
          body: draftContent,
          contactId: selectedEmail.contactId,
        }),
      });

      if (res.ok) {
        // Update ReceivedEmail reply state
        await fetch('/api/emails', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: selectedEmail.id,
            type: 'received',
            autoReplied: true,
            aiReplyStatus: 'sent',
          }),
        });

        toast({ title: 'Reply Dispatched', description: `Email sent to ${selectedEmail.fromEmail}` });
        setIsEditingDraft(false);
        setCustomGuidance('');
        fetchEmails();
      } else {
        const err = await res.json();
        toast({ title: 'Failed to Send', description: err.error || 'SMTP delivery failure.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to dispatch email.', variant: 'destructive' });
    } finally {
      setGeneratingReply(false);
    }
  };

  // Filtering Logic
  const filteredEmails = emails.filter((email) => {
    const matchesSearch =
      email.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (email.fromName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.fromEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (email.body || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = filterCategory === 'all' || email.category === filterCategory;

    const matchesRead =
      filterRead === 'all' ||
      (filterRead === 'unread' && !email.isRead) ||
      (filterRead === 'read' && email.isRead);

    return matchesSearch && matchesCategory && matchesRead;
  });

  const getCategoryBadge = (category: string | null) => {
    switch (category) {
      case 'interview':
        return <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border border-purple-200">Interview</Badge>;
      case 'recruiter':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-400 border border-yellow-200">Recruiter</Badge>;
      case 'offer':
        return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200">Offer</Badge>;
      case 'rejection':
        return <Badge className="bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 border border-red-200">Rejection</Badge>;
      case 'spam':
        return <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 border border-gray-200">Spam</Badge>;
      case 'newsletter':
        return <Badge className="bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400 border border-sky-200">Newsletter</Badge>;
      case 'promotion':
        return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200">Promotion</Badge>;
      default:
        return <Badge variant="secondary">General</Badge>;
    }
  };

  const parseExtractedInfo = (infoString: string | null) => {
    if (!infoString) return null;
    try {
      const data = JSON.parse(infoString);
      return Object.entries(data).filter(([_, v]) => v !== null && v !== '');
    } catch {
      return null;
    }
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-12rem)] border rounded-xl overflow-hidden bg-card">
      {/* Sidebar List Pane */}
      <div className="w-96 border-r flex flex-col h-full bg-muted/5 shrink-0">
        <div className="p-4 border-b space-y-3 bg-muted/10">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <Inbox className="w-4 h-4" /> Inbox ({filteredEmails.length})
            </h3>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={handleSync} disabled={syncing}>
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          {/* Read/Unread Filters */}
          <div className="flex gap-1.5">
            <Button
              variant={filterRead === 'all' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setFilterRead('all')}
              className="text-xs h-7 px-2.5"
            >
              All
            </Button>
            <Button
              variant={filterRead === 'unread' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setFilterRead('unread')}
              className="text-xs h-7 px-2.5"
            >
              Unread
            </Button>
            <Button
              variant={filterRead === 'read' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setFilterRead('read')}
              className="text-xs h-7 px-2.5"
            >
              Read
            </Button>
          </div>
        </div>

        {/* Category Filters */}
        <div className="px-4 py-2 border-b flex gap-1.5 overflow-x-auto whitespace-nowrap scrollbar-none bg-muted/5">
          {['all', 'interview', 'recruiter', 'offer', 'rejection', 'newsletter', 'promotion', 'spam'].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors capitalize ${
                filterCategory === cat
                  ? 'bg-primary text-primary-foreground border-primary font-medium'
                  : 'bg-card text-muted-foreground hover:text-foreground'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Email Listing */}
        <div className="flex-1 overflow-y-auto divide-y">
          {loading ? (
            <div className="p-4 space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : filteredEmails.length === 0 ? (
            <div className="text-center py-16 px-4 space-y-2">
              <Inbox className="w-10 h-10 mx-auto text-muted-foreground/30" />
              <p className="font-semibold text-sm text-muted-foreground">No conversations found</p>
              <p className="text-xs text-muted-foreground/60">Try changing your search parameters or sync the inbox.</p>
            </div>
          ) : (
            filteredEmails.map((email) => {
              const isSelected = selectedEmail?.id === email.id;
              return (
                <div
                  key={email.id}
                  onClick={() => {
                    setSelectedEmail(email);
                    handleMarkRead(email.id, true);
                    setDraftContent(email.aiReplyDraft || '');
                    setIsEditingDraft(false);
                  }}
                  className={`p-4 cursor-pointer transition-colors relative flex flex-col gap-1.5 ${
                    isSelected ? 'bg-primary/5' : 'hover:bg-muted/30'
                  } ${!email.isRead ? 'border-l-2 border-l-primary' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-xs truncate font-bold ${!email.isRead ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {email.fromName || email.fromEmail}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-semibold shrink-0">
                      {new Date(email.receivedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <h4 className={`text-xs truncate font-bold ${!email.isRead ? 'text-foreground' : 'text-muted-foreground/90'}`}>
                    {email.subject}
                  </h4>
                  <p className="text-[11px] text-muted-foreground line-clamp-1">
                    {email.body}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex gap-1.5 items-center">
                      {getCategoryBadge(email.category)}
                      {email.autoReplied && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 border-emerald-500/30 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20">
                          Replied
                        </Badge>
                      )}
                    </div>
                    {email.isFlagged && <Flag className="w-3 h-3 text-amber-500 fill-amber-500" />}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Email Reader Details Pane */}
      <div className="flex-1 flex flex-col h-full overflow-y-auto p-6 space-y-6">
        {selectedEmail ? (
          <>
            {/* Header Toolbar */}
            <div className="flex items-center justify-between pb-4 border-b">
              <div>
                <h2 className="text-base font-bold tracking-tight">{selectedEmail.subject}</h2>
                <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{selectedEmail.fromName || selectedEmail.fromEmail}</span>
                  <span>&lt;{selectedEmail.fromEmail}&gt;</span>
                  <span>&bull;</span>
                  <span>{new Date(selectedEmail.receivedAt).toLocaleString()}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleFlag(selectedEmail)}
                  className={selectedEmail.isFlagged ? 'border-amber-400 bg-amber-500/10 text-amber-600' : ''}
                >
                  <Flag className={`w-3.5 h-3.5 mr-1.5 ${selectedEmail.isFlagged ? 'fill-amber-500' : ''}`} />
                  {selectedEmail.isFlagged ? 'Flagged' : 'Flag'}
                </Button>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(selectedEmail.id)}>
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
                </Button>
              </div>
            </div>

            {/* Email Message Content Body */}
            <div className="border rounded-xl p-6 bg-muted/10 shadow-inner">
              <p className="text-xs leading-relaxed whitespace-pre-wrap text-foreground/90 font-medium">{selectedEmail.body}</p>
            </div>

            {/* AI Summary Block */}
            {selectedEmail.summary && (
              <div className="flex gap-3 p-4 rounded-xl border border-primary/20 bg-primary/[0.02]">
                <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-primary tracking-wide uppercase">AI Summary</h4>
                  <p className="text-xs text-foreground/80 mt-1 leading-relaxed">{selectedEmail.summary}</p>
                </div>
              </div>
            )}

            {/* AI Extracted Context Info */}
            {parseExtractedInfo(selectedEmail.extractedInfo) && (
              <div className="p-4 rounded-xl border bg-card">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Extracted Details</h4>
                <div className="flex flex-wrap gap-2">
                  {parseExtractedInfo(selectedEmail.extractedInfo)!.map(([key, val]) => (
                    <div key={key} className="flex items-center gap-1.5 px-3 py-1 rounded-lg border bg-muted/40 text-xs">
                      <span className="font-semibold capitalize text-muted-foreground">{key.replace(/([A-Z])/g, ' $1')}:</span>
                      <span className="font-bold text-foreground">{String(val)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Reply Assistant Box */}
            <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
              <div className="border-b bg-muted/10 px-6 py-4 flex items-center justify-between">
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-violet-500 animate-pulse" /> AI Reply Assistant
                </h3>
                <div className="flex items-center gap-1.5">
                  {selectedEmail.autoReplied && (
                    <Badge className="bg-emerald-500 text-primary-foreground font-semibold text-[10px]">
                      Auto-Replied
                    </Badge>
                  )}
                </div>
              </div>
              <div className="p-6 space-y-4">
                {draftContent ? (
                  <div className="space-y-4">
                    <div className="border rounded-lg p-4 bg-muted/20">
                      <p className="text-xs text-muted-foreground mb-2 font-semibold">Suggested Response Draft:</p>
                      {isEditingDraft ? (
                        <Textarea
                          value={draftContent}
                          onChange={(e) => setDraftContent(e.target.value)}
                          rows={6}
                          className="font-mono text-xs leading-relaxed"
                        />
                      ) : (
                        <pre className="text-xs whitespace-pre-wrap font-sans leading-relaxed text-foreground/80">{draftContent}</pre>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-4 pt-1">
                      <div className="flex items-center gap-2">
                        {isEditingDraft ? (
                          <Button variant="outline" size="sm" onClick={() => setIsEditingDraft(false)}>
                            <Check className="w-3.5 h-3.5 mr-1.5" /> Done Editing
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => setIsEditingDraft(true)}>
                            <FileText className="w-3.5 h-3.5 mr-1.5" /> Edit Draft
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => { setDraftContent(''); setCustomGuidance(''); }} className="text-destructive">
                          <X className="w-3.5 h-3.5 mr-1.5" /> Discard
                        </Button>
                      </div>

                      <Button
                        onClick={handleSendReply}
                        disabled={generatingReply || !draftContent.trim()}
                        className="bg-primary hover:bg-primary/95 text-primary-foreground shadow shadow-primary/20"
                        size="sm"
                      >
                        <Send className="w-3.5 h-3.5 mr-1.5" /> Send Reply
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex gap-2 items-start p-3.5 rounded-lg border border-yellow-200/50 bg-yellow-50 dark:bg-yellow-950/20 text-yellow-800 dark:text-yellow-300">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <p className="text-[11px] font-medium leading-relaxed">
                        No reply draft generated. Type custom instructions below (e.g., &quot;Tell them I am interested in the role and available next Tuesday at 10 AM EST&quot;) to draft a response.
                      </p>
                    </div>
                  </div>
                )}

                <div className="border-t pt-4 space-y-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter custom instructions for drafting the reply..."
                      value={customGuidance}
                      onChange={(e) => setCustomGuidance(e.target.value)}
                      className="text-xs h-9"
                    />
                    <Button
                      onClick={handleGenerateReply}
                      disabled={generatingReply}
                      className="bg-violet-600 hover:bg-violet-500 text-white shrink-0 shadow shadow-violet-600/10 h-9"
                      size="sm"
                    >
                      {generatingReply ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Drafting...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Draft Reply
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3">
            <Inbox className="w-16 h-16 text-muted-foreground/20 animate-pulse" />
            <div>
              <h3 className="font-bold text-sm text-foreground">Select an Email</h3>
              <p className="text-xs text-muted-foreground max-w-[280px] mt-1 leading-normal">
                Click a message from the inbox to read contents, view AI intelligence metrics, and draft automatic replies.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
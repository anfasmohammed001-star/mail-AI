'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Inbox, RefreshCw, Eye, Flag, Trash2, Shield } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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
  contact?: { id: string; name: string } | null;
  replyRule?: { id: string; name: string } | null;
}

export function InboxTab() {
  const [emails, setEmails] = useState<ReceivedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<ReceivedEmail | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const { toast } = useToast();

  const fetchEmails = useCallback(() => {
    fetch('/api/emails?type=received')
      .then((r) => r.json())
      .then((d) => { setEmails(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { fetchEmails(); }, [fetchEmails]);

  const handleSimulate = async () => {
    setSimulating(true);
    try {
      const res = await fetch('/api/simulate/inbox', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        toast({ title: 'Inbox Updated', description: `${data.received} simulated emails received.` });
        fetchEmails();
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to simulate.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to simulate inbox.', variant: 'destructive' });
    } finally {
      setSimulating(false);
    }
  };

  const handleMarkRead = async (email: ReceivedEmail) => {
    await fetch('/api/emails', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: email.id, type: 'received', isRead: !email.isRead }),
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
        flagReason: !email.isFlagged ? 'Manually flagged' : null,
      }),
    });
    fetchEmails();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/emails?id=${id}&type=received`, { method: 'DELETE' });
    toast({ title: 'Deleted', description: 'Email removed.' });
    fetchEmails();
    setViewOpen(false);
  };

  const unreadCount = emails.filter((e) => !e.isRead).length;
  const flaggedCount = emails.filter((e) => e.isFlagged).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Inbox className="w-4 h-4" />
                Inbox
              </CardTitle>
              <CardDescription>
                {emails.length} emails
                {unreadCount > 0 && <Badge variant="default" className="ml-2 text-[10px] px-1.5 py-0">{unreadCount} unread</Badge>}
                {flaggedCount > 0 && <Badge variant="destructive" className="ml-1 text-[10px] px-1.5 py-0">{flaggedCount} flagged</Badge>}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleSimulate} disabled={simulating}>
                <RefreshCw className={`w-4 h-4 mr-1.5 ${simulating ? 'animate-spin' : ''}`} />
                {simulating ? 'Receiving...' : 'Simulate Inbox'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-muted rounded" />)}</div>
          ) : emails.length === 0 ? (
            <div className="text-center py-12">
              <Inbox className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground font-medium">Inbox is empty</p>
              <p className="text-sm text-muted-foreground/70 mt-1">Click &quot;Simulate Inbox&quot; to receive demo emails, or configure your IMAP settings.</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
              {emails.map((email) => (
                <div
                  key={email.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted/30 ${
                    !email.isRead ? 'bg-primary/[0.02] border-l-2 border-l-primary' : ''
                  } ${email.isFlagged ? 'border-l-2 border-l-amber-400' : ''}`}
                  onClick={() => { setSelectedEmail(email); setViewOpen(true); handleMarkRead(email); }}
                >
                  <div className="mt-1">
                    {!email.isRead && <div className="w-2 h-2 rounded-full bg-primary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-sm truncate ${!email.isRead ? 'font-semibold' : 'font-medium'}`}>
                        {email.fromName || email.fromEmail}
                      </span>
                      {email.isFlagged && <Flag className="w-3 h-3 text-amber-500 shrink-0" />}
                      {email.autoReplied && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                          <Shield className="w-2.5 h-2.5 mr-0.5" /> Auto-replied
                        </Badge>
                      )}
                    </div>
                    <p className={`text-sm truncate ${!email.isRead ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {email.subject}
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">{email.body?.substring(0, 80)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {new Date(email.receivedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Email Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-2xl">
          {selectedEmail && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg">{selectedEmail.subject}</DialogTitle>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>From: {selectedEmail.fromName || selectedEmail.fromEmail}</span>
                  <span>&bull;</span>
                  <span>{new Date(selectedEmail.receivedAt).toLocaleString()}</span>
                </div>
              </DialogHeader>
              <div className="space-y-4">
                <div className="border rounded-lg p-4 bg-muted/20">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{selectedEmail.body}</p>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleToggleFlag(selectedEmail)}>
                      <Flag className={`w-4 h-4 mr-1.5 ${selectedEmail.isFlagged ? 'text-amber-500 fill-amber-500' : ''}`} />
                      {selectedEmail.isFlagged ? 'Unflag' : 'Flag'}
                    </Button>
                  </div>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(selectedEmail.id)}>
                    <Trash2 className="w-4 h-4 mr-1.5" /> Delete
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ScrollText, Trash2, RefreshCw, CheckCircle2, AlertTriangle, XCircle, Filter } from 'lucide-react';

interface Log {
  id: string;
  action: string;
  category: string;
  details: string | null;
  status: string;
  createdAt: string;
}

export function LogsTab() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const { toast } = useToast();

  const fetchLogs = useCallback(() => {
    const params = new URLSearchParams();
    if (filterCategory !== 'all') params.set('category', filterCategory);
    if (filterStatus !== 'all') params.set('status', filterStatus);
    params.set('limit', '100');

    fetch(`/api/logs?${params}`)
      .then((r) => r.json())
      .then((d) => { setLogs(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [filterCategory, filterStatus]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handleClear = async () => {
    await fetch('/api/logs', { method: 'DELETE' });
    toast({ title: 'Logs Cleared', description: 'All activity logs have been removed.' });
    fetchLogs();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'error': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <CheckCircle2 className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'email': return 'bg-amber-100 text-amber-700';
      case 'contact': return 'bg-emerald-100 text-emerald-700';
      case 'template': return 'bg-violet-100 text-violet-700';
      case 'rule': return 'bg-sky-100 text-sky-700';
      case 'system': return 'bg-slate-100 text-slate-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const formatDetails = (details: string | null): string => {
    if (!details) return '';
    try {
      const parsed = JSON.parse(details);
      const parts: string[] = [];
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === 'object' && value !== null) {
          parts.push(`${key}: ${JSON.stringify(value)}`);
        } else {
          parts.push(`${key}: ${value}`);
        }
      }
      return parts.join(' | ');
    } catch {
      return details;
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <ScrollText className="w-4 h-4" />
                Activity Logs
              </CardTitle>
              <CardDescription>{logs.length} log entries</CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-[120px] h-8 text-xs">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="contact">Contact</SelectItem>
                    <SelectItem value="template">Template</SelectItem>
                    <SelectItem value="rule">Rule</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[110px] h-8 text-xs">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="sm" onClick={fetchLogs}>
                <RefreshCw className="w-3.5 h-3.5 mr-1" />
              </Button>
              {logs.length > 0 && (
                <Button variant="destructive" size="sm" onClick={handleClear}>
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Clear All
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">{[...Array(8)].map((_, i) => <div key={i} className="h-12 bg-muted rounded" />)}</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12">
              <ScrollText className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground font-medium">No logs yet</p>
              <p className="text-sm text-muted-foreground/70 mt-1">Activity will appear here as you use the agent.</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-[500px] overflow-y-auto">
                <div className="divide-y">
                  {logs.map((log) => (
                    <div key={log.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                      <div className="mt-0.5 shrink-0">{getStatusIcon(log.status)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-medium">{log.action}</span>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${getCategoryColor(log.category)}`}>
                            {log.category}
                          </Badge>
                        </div>
                        {log.details && (
                          <p className="text-xs text-muted-foreground truncate">{formatDetails(log.details)}</p>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                        {new Date(log.createdAt).toLocaleString(undefined, {
                          month: 'short', day: 'numeric',
                          hour: '2-digit', minute: '2-digit', second: '2-digit',
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
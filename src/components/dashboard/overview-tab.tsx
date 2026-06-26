'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, FileText, Send, Inbox, Shield, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

interface OverviewData {
  contacts: { total: number; limit: number; remaining: number };
  templates: { total: number; active: number };
  emails: {
    sent: { total: number; success: number; failed: number; recent7Days: number };
    received: { total: number; unread: number; flagged: number; autoReplied: number; recent7Days: number };
  };
  rules: { active: number };
  recentLogs: Array<{
    id: string;
    action: string;
    category: string;
    details: string | null;
    status: string;
    createdAt: string;
  }>;
}

interface OverviewTabProps {
  onNavigate: (tab: string) => void;
}

export function OverviewTab({ onNavigate }: OverviewTabProps) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/overview')
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="h-4 bg-muted rounded w-24 mb-3" />
              <div className="h-8 bg-muted rounded w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data) return <p className="text-muted-foreground">Failed to load overview data.</p>;

  const stats = [
    {
      label: 'Total Contacts',
      value: data.contacts.total,
      sub: `${data.contacts.remaining} slots remaining`,
      icon: Users,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      tab: 'contacts',
    },
    {
      label: 'Active Templates',
      value: data.templates.active,
      sub: `${data.templates.total} total templates`,
      icon: FileText,
      color: 'text-violet-600',
      bg: 'bg-violet-50',
      tab: 'templates',
    },
    {
      label: 'Emails Sent',
      value: data.emails.sent.success,
      sub: `${data.emails.sent.recent7Days} in last 7 days`,
      icon: Send,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      tab: 'compose',
    },
    {
      label: 'Unread Inbox',
      value: data.emails.received.unread,
      sub: `${data.emails.received.flagged} flagged`,
      icon: Inbox,
      color: 'text-rose-600',
      bg: 'bg-rose-50',
      tab: 'inbox',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card
            key={stat.label}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => onNavigate(stat.tab)}
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">{stat.label}</p>
                  <p className="text-3xl font-bold mt-1">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
                </div>
                <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center">
                <Shield className="w-4 h-4 text-sky-600" />
              </div>
              <h3 className="font-semibold text-sm">Active Rules</h3>
            </div>
            <p className="text-2xl font-bold">{data.rules.active}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {data.emails.received.autoReplied} auto-replies sent
            </p>
            <button
              onClick={() => onNavigate('rules')}
              className="text-xs text-primary hover:underline mt-2"
            >
              Manage rules →
            </button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-orange-600" />
              </div>
              <h3 className="font-semibold text-sm">Failed Sends</h3>
            </div>
            <p className="text-2xl font-bold">{data.emails.sent.failed}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Out of {data.emails.sent.total} total sent
            </p>
            <button
              onClick={() => onNavigate('logs')}
              className="text-xs text-primary hover:underline mt-2"
            >
              View logs →
            </button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
                <Clock className="w-4 h-4 text-teal-600" />
              </div>
              <h3 className="font-semibold text-sm">Recent Activity</h3>
            </div>
            <p className="text-2xl font-bold">{data.emails.sent.recent7Days + data.emails.received.recent7Days}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Emails in the last 7 days
            </p>
            <button
              onClick={() => onNavigate('logs')}
              className="text-xs text-primary hover:underline mt-2"
            >
              View all activity →
            </button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Activity</CardTitle>
          <CardDescription>Latest actions performed by the agent</CardDescription>
        </CardHeader>
        <CardContent>
          {data.recentLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No activity yet. Start by adding contacts and sending emails.</p>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {data.recentLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 py-2 border-b last:border-0">
                  <div className="mt-0.5">
                    {log.status === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : log.status === 'warning' ? (
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{log.action}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {log.category}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {log.details ? JSON.parse(log.details)?.toString().substring(0, 100) : 'No details'}
                    </p>
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
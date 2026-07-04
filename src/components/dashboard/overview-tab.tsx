'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, FileText, Send, Inbox, Shield, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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
  chartData?: Array<{ name: string; sent: number; received: number }>;
}

interface OverviewTabProps {
  onNavigate: (tab: string) => void;
}

export function OverviewTab({ onNavigate }: OverviewTabProps) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/overview')
      .then(r => { if (!r.ok) throw new Error('Network error'); return r.json(); })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
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
        <Card className="h-80 w-full animate-pulse bg-muted/20" />
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
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/30',
      tab: 'contacts',
    },
    {
      label: 'Active Templates',
      value: data.templates.active,
      sub: `${data.templates.total} total templates`,
      icon: FileText,
      color: 'text-violet-600 dark:text-violet-400',
      bg: 'bg-violet-50 dark:bg-violet-950/30',
      tab: 'templates',
    },
    {
      label: 'Emails Sent',
      value: data.emails.sent.success,
      sub: `${data.emails.sent.recent7Days} in last 7 days`,
      icon: Send,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-950/30',
      tab: 'compose',
    },
    {
      label: 'Unread Inbox',
      value: data.emails.received.unread,
      sub: `${data.emails.received.flagged} flagged`,
      icon: Inbox,
      color: 'text-rose-600 dark:text-rose-400',
      bg: 'bg-rose-50 dark:bg-rose-950/30',
      tab: 'inbox',
    },
  ];

  // Default fallback data for chart
  const chartData = data.chartData && data.chartData.length > 0
    ? data.chartData
    : [
        { name: 'Mon', sent: 0, received: 0 },
        { name: 'Tue', sent: 0, received: 0 },
        { name: 'Wed', sent: 0, received: 0 },
        { name: 'Thu', sent: 0, received: 0 },
        { name: 'Fri', sent: 0, received: 0 },
        { name: 'Sat', sent: 0, received: 0 },
        { name: 'Sun', sent: 0, received: 0 },
      ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card
            key={stat.label}
            className="cursor-pointer hover:shadow-md transition-all hover:scale-[1.01]"
            onClick={() => onNavigate(stat.tab)}
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">{stat.label}</p>
                  <p className="text-3xl font-extrabold tracking-tight mt-1">{stat.value}</p>
                  <p className="text-[11px] text-muted-foreground mt-1.5 font-medium">{stat.sub}</p>
                </div>
                <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center border border-muted`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recharts Area Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold">Email Traffic History</CardTitle>
          <CardDescription>Daily volume of sent and received emails over the last 7 days</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="oklch(0.646 0.222 41.116)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="oklch(0.646 0.222 41.116)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorRecv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="oklch(0.6 0.118 184.704)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="oklch(0.6 0.118 184.704)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Area type="monotone" dataKey="sent" stroke="oklch(0.646 0.222 41.116)" strokeWidth={2} fillOpacity={1} fill="url(#colorSent)" name="Sent" />
                <Area type="monotone" dataKey="received" stroke="oklch(0.6 0.118 184.704)" strokeWidth={2} fillOpacity={1} fill="url(#colorRecv)" name="Received" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-950/20 flex items-center justify-center border border-muted">
                <Shield className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              </div>
              <h3 className="font-bold text-sm">Active Rules</h3>
            </div>
            <p className="text-2xl font-extrabold">{data.rules.active}</p>
            <p className="text-xs text-muted-foreground mt-1.5 font-medium">
              {data.emails.received.autoReplied} automated replies dispatched
            </p>
            <button
              onClick={() => onNavigate('rules')}
              className="text-xs text-primary font-semibold hover:underline mt-3 block"
            >
              Manage rules →
            </button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-950/20 flex items-center justify-center border border-muted">
                <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              </div>
              <h3 className="font-bold text-sm">Delivery Failures</h3>
            </div>
            <p className="text-2xl font-extrabold text-red-600 dark:text-red-400">{data.emails.sent.failed}</p>
            <p className="text-xs text-muted-foreground mt-1.5 font-medium">
              Out of {data.emails.sent.total} total attempted sends
            </p>
            <button
              onClick={() => onNavigate('logs')}
              className="text-xs text-primary font-semibold hover:underline mt-3 block"
            >
              View logs →
            </button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/20 flex items-center justify-center border border-muted">
                <Clock className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              </div>
              <h3 className="font-bold text-sm">Recent Activity</h3>
            </div>
            <p className="text-2xl font-extrabold">{data.emails.sent.recent7Days + data.emails.received.recent7Days}</p>
            <p className="text-xs text-muted-foreground mt-1.5 font-medium">
              Total events recorded this week
            </p>
            <button
              onClick={() => onNavigate('logs')}
              className="text-xs text-primary font-semibold hover:underline mt-3 block"
            >
              View all activity →
            </button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold">Agent Feed</CardTitle>
          <CardDescription>Latest events and decisions handled by the local worker</CardDescription>
        </CardHeader>
        <CardContent>
          {data.recentLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No activity recorded yet.</p>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
              {data.recentLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 py-2.5 border-b last:border-0 hover:bg-muted/5 rounded-md px-1.5 transition-colors">
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
                      <span className="text-xs font-bold uppercase tracking-wider">{log.action}</span>
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-semibold uppercase">
                        {log.category}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {log.details ? JSON.parse(log.details)?.toString().substring(0, 100) : 'No details'}
                    </p>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-semibold whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
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
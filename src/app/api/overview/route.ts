import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/overview — dashboard summary stats
export async function GET() {
  try {
    const [
      totalContacts,
      totalTemplates,
      activeTemplates,
      sentCount,
      sentSuccessCount,
      receivedCount,
      unreadCount,
      flaggedCount,
      autoRepliedCount,
      activeRules,
      recentLogs,
    ] = await Promise.all([
      db.contact.count(),
      db.emailTemplate.count(),
      db.emailTemplate.count({ where: { isActive: true } }),
      db.sentEmail.count(),
      db.sentEmail.count({ where: { status: 'sent' } }),
      db.receivedEmail.count(),
      db.receivedEmail.count({ where: { isRead: false } }),
      db.receivedEmail.count({ where: { isFlagged: true } }),
      db.receivedEmail.count({ where: { autoReplied: true } }),
      db.responseRule.count({ where: { isActive: true } }),
      db.activityLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    // Email stats for the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentSent = await db.sentEmail.count({
      where: { sentAt: { gte: sevenDaysAgo } },
    });

    const recentReceived = await db.receivedEmail.count({
      where: { receivedAt: { gte: sevenDaysAgo } },
    });

    // Generate daily traffic for the last 7 days
    const chartData = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const nextDay = new Date(d);
      nextDay.setDate(nextDay.getDate() + 1);

      const sent = await db.sentEmail.count({
        where: { createdAt: { gte: d, lt: nextDay } },
      });
      const received = await db.receivedEmail.count({
        where: { createdAt: { gte: d, lt: nextDay } },
      });

      chartData.push({
        name: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        sent,
        received,
      });
    }

    // Template usage stats
    const templateUsage = await db.sentEmail.groupBy({
      by: ['templateId'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    });

    return NextResponse.json({
      contacts: {
        total: totalContacts,
        limit: 10000,
        remaining: 10000 - totalContacts,
      },
      templates: {
        total: totalTemplates,
        active: activeTemplates,
      },
      emails: {
        sent: {
          total: sentCount,
          success: sentSuccessCount,
          failed: sentCount - sentSuccessCount,
          recent7Days: recentSent,
        },
        received: {
          total: receivedCount,
          unread: unreadCount,
          flagged: flaggedCount,
          autoReplied: autoRepliedCount,
          recent7Days: recentReceived,
        },
      },
      rules: {
        active: activeRules,
      },
      recentLogs,
      templateUsage,
      chartData,
    });
  } catch (error) {
    console.error('Failed to fetch overview:', error);
    return NextResponse.json({ error: 'Failed to fetch overview' }, { status: 500 });
  }
}
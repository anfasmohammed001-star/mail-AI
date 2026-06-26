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
        limit: 100,
        remaining: 100 - totalContacts,
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
    });
  } catch (error) {
    console.error('Failed to fetch overview:', error);
    return NextResponse.json({ error: 'Failed to fetch overview' }, { status: 500 });
  }
}
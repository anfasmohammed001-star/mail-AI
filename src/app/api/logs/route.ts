import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/logs?category=xxx&action=xxx&limit=50
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const action = searchParams.get('action');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const where: Record<string, unknown> = {};
    if (category) where.category = category;
    if (action) where.action = action;
    if (status) where.status = status;

    const logs = await db.activityLog.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error('Failed to fetch logs:', error);
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
  }
}

// DELETE /api/logs — clear all logs or by category
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    if (category) {
      await db.activityLog.deleteMany({ where: { category } });
    } else {
      await db.activityLog.deleteMany();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete logs:', error);
    return NextResponse.json({ error: 'Failed to delete logs' }, { status: 500 });
  }
}
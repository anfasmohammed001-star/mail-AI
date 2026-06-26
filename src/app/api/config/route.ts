import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/config
export async function GET() {
  try {
    const configs = await db.emailConfig.findMany();
    const configMap: Record<string, string> = {};
    for (const c of configs) {
      configMap[c.key] = c.isEncrypted ? '[ENCRYPTED]' : c.value;
    }
    return NextResponse.json(configMap);
  } catch (error) {
    console.error('Failed to fetch config:', error);
    return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 });
  }
}

// POST /api/config — upsert config values
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { configs } = body as { configs: Record<string, string> };

    if (!configs || typeof configs !== 'object') {
      return NextResponse.json({ error: 'configs object is required' }, { status: 400 });
    }

    for (const [key, value] of Object.entries(configs)) {
      await db.emailConfig.upsert({
        where: { key },
        update: { value, updatedAt: new Date() },
        create: { key, value },
      });
    }

    await db.activityLog.create({
      data: {
        action: 'CONFIG_UPDATED',
        category: 'system',
        details: JSON.stringify({ keys: Object.keys(configs) }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update config:', error);
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
  }
}
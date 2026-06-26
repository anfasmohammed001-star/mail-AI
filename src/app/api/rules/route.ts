import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/rules
export async function GET() {
  try {
    const rules = await db.responseRule.findMany({
      orderBy: { priority: 'desc' },
    });
    return NextResponse.json(rules);
  } catch (error) {
    console.error('Failed to fetch rules:', error);
    return NextResponse.json({ error: 'Failed to fetch rules' }, { status: 500 });
  }
}

// POST /api/rules
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, conditions, replyTemplate, priority } = body;

    if (!name || !conditions || !replyTemplate) {
      return NextResponse.json({ error: 'Name, conditions, and reply template are required' }, { status: 400 });
    }

    const rule = await db.responseRule.create({
      data: {
        name,
        description: description || null,
        conditions: typeof conditions === 'string' ? conditions : JSON.stringify(conditions),
        replyTemplate,
        priority: priority || 0,
      },
    });

    await db.activityLog.create({
      data: {
        action: 'RULE_CREATED',
        category: 'rule',
        details: JSON.stringify({ ruleId: rule.id, name: rule.name }),
      },
    });

    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    console.error('Failed to create rule:', error);
    return NextResponse.json({ error: 'Failed to create rule' }, { status: 500 });
  }
}

// PUT /api/rules
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Rule ID is required' }, { status: 400 });
    }

    if (updates.conditions && typeof updates.conditions !== 'string') {
      updates.conditions = JSON.stringify(updates.conditions);
    }

    const rule = await db.responseRule.update({
      where: { id },
      data: updates,
    });

    await db.activityLog.create({
      data: {
        action: 'RULE_UPDATED',
        category: 'rule',
        details: JSON.stringify({ ruleId: rule.id, name: rule.name }),
      },
    });

    return NextResponse.json(rule);
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2025') {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }
    console.error('Failed to update rule:', error);
    return NextResponse.json({ error: 'Failed to update rule' }, { status: 500 });
  }
}

// DELETE /api/rules?id=xxx
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Rule ID is required' }, { status: 400 });
    }

    const rule = await db.responseRule.delete({ where: { id } });

    await db.activityLog.create({
      data: {
        action: 'RULE_DELETED',
        category: 'rule',
        details: JSON.stringify({ ruleId: rule.id, name: rule.name }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2025') {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }
    console.error('Failed to delete rule:', error);
    return NextResponse.json({ error: 'Failed to delete rule' }, { status: 500 });
  }
}
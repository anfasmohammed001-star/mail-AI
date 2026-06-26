import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/templates
export async function GET() {
  try {
    const templates = await db.emailTemplate.findMany({
      orderBy: { updatedAt: 'desc' },
    });
    return NextResponse.json(templates);
  } catch (error) {
    console.error('Failed to fetch templates:', error);
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }
}

// POST /api/templates
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, subject, body: templateBody, category } = body;

    if (!name || !subject || !templateBody) {
      return NextResponse.json({ error: 'Name, subject, and body are required' }, { status: 400 });
    }

    const template = await db.emailTemplate.create({
      data: {
        name,
        subject,
        body: templateBody,
        category: category || 'general',
      },
    });

    await db.activityLog.create({
      data: {
        action: 'TEMPLATE_CREATED',
        category: 'template',
        details: JSON.stringify({ templateId: template.id, name: template.name }),
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error('Failed to create template:', error);
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }
}

// PUT /api/templates
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, subject, body: templateBody, category, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: 'Template ID is required' }, { status: 400 });
    }

    const template = await db.emailTemplate.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(subject !== undefined && { subject }),
        ...(templateBody !== undefined && { body: templateBody }),
        ...(category !== undefined && { category }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    await db.activityLog.create({
      data: {
        action: 'TEMPLATE_UPDATED',
        category: 'template',
        details: JSON.stringify({ templateId: template.id, name: template.name }),
      },
    });

    return NextResponse.json(template);
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2025') {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }
    console.error('Failed to update template:', error);
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
  }
}

// DELETE /api/templates?id=xxx
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Template ID is required' }, { status: 400 });
    }

    const template = await db.emailTemplate.delete({ where: { id } });

    await db.activityLog.create({
      data: {
        action: 'TEMPLATE_DELETED',
        category: 'template',
        details: JSON.stringify({ templateId: template.id, name: template.name }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2025') {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }
    console.error('Failed to delete template:', error);
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
  }
}
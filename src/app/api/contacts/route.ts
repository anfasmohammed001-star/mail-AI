import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/contacts
export async function GET() {
  try {
    const contacts = await db.contact.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        sentEmails: {
          select: {
            id: true,
            subject: true,
            sentAt: true,
            status: true,
          },
          orderBy: { createdAt: 'desc' },
        }
      }
    });
    return NextResponse.json(contacts);
  } catch (error) {
    console.error('Failed to fetch contacts:', error);
    return NextResponse.json({ error: 'Failed to fetch contacts' }, { status: 500 });
  }
}

// POST /api/contacts
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, company, phone, customFields } = body;

    if (!name || !email) {
      return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
    }

    const contact = await db.contact.create({
      data: {
        name,
        email,
        company: company || null,
        phone: phone || null,
        customFields: customFields ? JSON.stringify(customFields) : null,
      },
    });

    // Log activity
    await db.activityLog.create({
      data: {
        action: 'CONTACT_ADDED',
        category: 'contact',
        details: JSON.stringify({ contactId: contact.id, email: contact.email }),
      },
    });

    return NextResponse.json(contact, { status: 201 });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
    }
    console.error('Failed to create contact:', error);
    return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 });
  }
}

// PUT /api/contacts
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, email, company, phone, customFields } = body;

    if (!id) {
      return NextResponse.json({ error: 'Contact ID is required' }, { status: 400 });
    }

    const contact = await db.contact.update({
      where: { id },
      data: {
        name: name || undefined,
        email: email || undefined,
        company: company !== undefined ? company : undefined,
        phone: phone !== undefined ? phone : undefined,
        customFields: customFields ? JSON.stringify(customFields) : null,
      },
    });

    await db.activityLog.create({
      data: {
        action: 'CONTACT_UPDATED',
        category: 'contact',
        details: JSON.stringify({ contactId: contact.id, email: contact.email }),
      },
    });

    return NextResponse.json(contact);
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2025') {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }
    console.error('Failed to update contact:', error);
    return NextResponse.json({ error: 'Failed to update contact' }, { status: 500 });
  }
}

// DELETE /api/contacts?id=xxx
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Contact ID is required' }, { status: 400 });
    }

    const contact = await db.contact.delete({ where: { id } });

    await db.activityLog.create({
      data: {
        action: 'CONTACT_DELETED',
        category: 'contact',
        details: JSON.stringify({ contactId: contact.id, email: contact.email }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2025') {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }
    console.error('Failed to delete contact:', error);
    return NextResponse.json({ error: 'Failed to delete contact' }, { status: 500 });
  }
}
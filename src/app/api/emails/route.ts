import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/emails?type=sent|received
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'sent';

    if (type === 'received') {
      const emails = await db.receivedEmail.findMany({
        orderBy: { receivedAt: 'desc' },
        include: { contact: true, replyRule: true },
      });
      return NextResponse.json(emails);
    }

    const emails = await db.sentEmail.findMany({
      orderBy: { createdAt: 'desc' },
      include: { contact: true, template: true },
    });
    return NextResponse.json(emails);
  } catch (error) {
    console.error('Failed to fetch emails:', error);
    return NextResponse.json({ error: 'Failed to fetch emails' }, { status: 500 });
  }
}

// POST /api/emails — send a single email or bulk send
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mode, contactIds, templateId, subject, body: emailBody } = body;

    if (mode === 'bulk') {
      return handleBulkSend(contactIds, templateId, subject, emailBody);
    }

    return handleSingleSend(body);
  } catch (error) {
    console.error('Failed to send email:', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}

async function handleSingleSend(data: {
  contactId?: string;
  templateId?: string;
  toEmail?: string;
  toName?: string;
  subject?: string;
  body?: string;
}) {
  const { contactId, templateId, toEmail, toName, subject, body: emailBody } = data;

  let finalToEmail = toEmail || '';
  let finalToName = toName || '';
  let finalSubject = subject || '';
  let finalBody = emailBody || '';

  // If contactId is provided, get contact details
  if (contactId) {
    const contact = await db.contact.findUnique({ where: { id: contactId } });
    if (contact) {
      finalToEmail = contact.email;
      finalToName = contact.name;
    }
  }

  // If templateId is provided, get template and fill placeholders
  if (templateId) {
    const template = await db.emailTemplate.findUnique({ where: { id: templateId } });
    if (template) {
      finalSubject = fillPlaceholders(template.subject, { name: finalToName, email: finalToEmail });
      finalBody = fillPlaceholders(template.body, { name: finalToName, email: finalToEmail });
    }
  }

  if (!finalToEmail || !finalSubject || !finalBody) {
    return NextResponse.json({ error: 'Missing required fields: toEmail, subject, body' }, { status: 400 });
  }

  // Simulate email sending (in production, this would use SMTP/Gmail API)
  const sentEmail = await db.sentEmail.create({
    data: {
      contactId: contactId || '',
      templateId: templateId || null,
      toEmail: finalToEmail,
      toName: finalToName,
      subject: finalSubject,
      body: finalBody,
      status: 'sent',
      sentAt: new Date(),
    },
  });

  await db.activityLog.create({
    data: {
      action: 'SENT',
      category: 'email',
      details: JSON.stringify({ sentEmailId: sentEmail.id, to: finalToEmail, subject: finalSubject }),
    },
  });

  return NextResponse.json(sentEmail, { status: 201 });
}

async function handleBulkSend(
  contactIds: string[],
  templateId: string | null,
  subject: string | null,
  body: string | null
) {
  if (!contactIds || contactIds.length === 0) {
    return NextResponse.json({ error: 'No contacts selected' }, { status: 400 });
  }

  const contacts = await db.contact.findMany({
    where: { id: { in: contactIds } },
  });

  let template = null;
  if (templateId) {
    template = await db.emailTemplate.findUnique({ where: { id: templateId } });
  }

  const results = [];
  let successCount = 0;
  let failCount = 0;

  for (const contact of contacts) {
    try {
      const emailSubject = template
        ? fillPlaceholders(template.subject, { name: contact.name, email: contact.email, company: contact.company || '' })
        : fillPlaceholders(subject || '', { name: contact.name, email: contact.email, company: contact.company || '' });

      const emailBody = template
        ? fillPlaceholders(template.body, { name: contact.name, email: contact.email, company: contact.company || '' })
        : fillPlaceholders(body || '', { name: contact.name, email: contact.email, company: contact.company || '' });

      // Simulate sending — in production, use SMTP or Gmail API
      const sentEmail = await db.sentEmail.create({
        data: {
          contactId: contact.id,
          templateId: templateId || null,
          toEmail: contact.email,
          toName: contact.name,
          subject: emailSubject,
          body: emailBody,
          status: 'sent',
          sentAt: new Date(),
        },
      });

      results.push(sentEmail);
      successCount++;
    } catch {
      failCount++;
      await db.sentEmail.create({
        data: {
          contactId: contact.id,
          templateId: templateId || null,
          toEmail: contact.email,
          toName: contact.name,
          subject: '',
          body: '',
          status: 'failed',
          error: 'Failed to send',
        },
      });
    }
  }

  await db.activityLog.create({
    data: {
      action: 'BULK_SEND',
      category: 'email',
      details: JSON.stringify({
        total: contactIds.length,
        success: successCount,
        failed: failCount,
        templateId: templateId || 'custom',
      }),
      status: failCount > 0 ? 'warning' : 'success',
    },
  });

  return NextResponse.json({
    total: contactIds.length,
    success: successCount,
    failed: failCount,
    emails: results,
  }, { status: 201 });
}

function fillPlaceholders(text: string, data: Record<string, string | null | undefined>): string {
  let result = text;
  for (const [key, value] of Object.entries(data)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || `{{${key}}}`);
  }
  return result;
}

// PUT /api/emails — mark received email as read, flagged, etc.
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, type, ...updates } = body;

    if (!id || !type) {
      return NextResponse.json({ error: 'ID and type are required' }, { status: 400 });
    }

    if (type === 'received') {
      const email = await db.receivedEmail.update({
        where: { id },
        data: updates,
      });
      return NextResponse.json(email);
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2025') {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }
    console.error('Failed to update email:', error);
    return NextResponse.json({ error: 'Failed to update email' }, { status: 500 });
  }
}

// DELETE /api/emails?id=xxx&type=sent|received
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const type = searchParams.get('type') || 'sent';

    if (!id) {
      return NextResponse.json({ error: 'Email ID is required' }, { status: 400 });
    }

    if (type === 'received') {
      await db.receivedEmail.delete({ where: { id } });
    } else {
      await db.sentEmail.delete({ where: { id } });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2025') {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }
    console.error('Failed to delete email:', error);
    return NextResponse.json({ error: 'Failed to delete email' }, { status: 500 });
  }
}
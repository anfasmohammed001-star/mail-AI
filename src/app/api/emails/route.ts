import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { db } from '@/lib/db';
import { decrypt } from '@/lib/crypto';

// ---------- SMTP helper ----------

interface Attachment {
  filename: string;
  content: string; // Base64
}

interface SmtpConfig {
  host: string;
  port: number;
  email: string;
  password: string;
  fromName: string;
  secure: boolean;
}

async function getSmtpConfig(): Promise<SmtpConfig | null> {
  const configs = await db.emailConfig.findMany();
  const map: Record<string, string> = {};
  for (const c of configs) map[c.key] = c.value;

  if (!map.smtp_host || !map.smtp_email || !map.smtp_password) return null;

  return {
    host: map.smtp_host,
    port: parseInt(map.smtp_port || '587', 10),
    email: map.smtp_email,
    password: decrypt(map.smtp_password),
    fromName: map.smtp_from_name || map.smtp_email,
    secure: map.smtp_secure === 'true',
  };
}

async function createTransport(config: SmtpConfig) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.email,
      pass: config.password,
    },
  });
}

async function sendRealEmail(
  config: SmtpConfig,
  toEmail: string,
  toName: string,
  subject: string,
  htmlBody: string,
  attachments?: Attachment[]
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const transport = await createTransport(config);
  try {
    const info = await transport.sendMail({
      from: `"${config.fromName}" <${config.email}>`,
      to: toName ? `"${toName}" <${toEmail}>` : toEmail,
      subject,
      html: htmlBody.replace(/\n/g, '<br />'),
      text: htmlBody,
      attachments: attachments ? attachments.map(att => ({
        filename: att.filename,
        content: Buffer.from(att.content, 'base64')
      })) : undefined
    });
    transport.close();
    return { success: true, messageId: info.messageId };
  } catch (err: unknown) {
    transport.close();
    const message = err instanceof Error ? err.message : 'Unknown SMTP error';
    return { success: false, error: message };
  }
}

// ---------- fillPlaceholders ----------

function fillPlaceholders(text: string, data: Record<string, string | null | undefined>): string {
  let result = text;
  for (const [key, value] of Object.entries(data)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || `{{${key}}}`);
  }
  return result;
}

// ---------- GET ----------

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

// ---------- POST ----------

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mode, contactIds, templateId, subject, body: emailBody, attachments } = body;

    if (mode === 'bulk') {
      return handleBulkSend(contactIds, templateId, subject, emailBody, attachments);
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
  attachments?: Attachment[];
}) {
  const { contactId, templateId, toEmail, toName, subject, body: emailBody, attachments } = data;

  let finalToEmail = toEmail || '';
  let finalToName = toName || '';
  let finalSubject = subject || '';
  let finalBody = emailBody || '';

  if (contactId) {
    const contact = await db.contact.findUnique({ where: { id: contactId } });
    if (contact) {
      finalToEmail = contact.email;
      finalToName = contact.name;
    }
  }

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

  // Try real SMTP send
  const smtpConfig = await getSmtpConfig();
  let sendStatus: 'sent' | 'failed' = 'sent';
  let sendError: string | null = null;
  let messageId: string | null = null;

  if (smtpConfig) {
    const result = await sendRealEmail(smtpConfig, finalToEmail, finalToName, finalSubject, finalBody, attachments);
    if (!result.success) {
      sendStatus = 'failed';
      sendError = result.error || 'SMTP error';
    } else {
      messageId = result.messageId || null;
    }
  } else {
    // No SMTP configured — mark as failed with helpful message
    sendStatus = 'failed';
    sendError = 'SMTP not configured. Go to Settings to add your SMTP credentials.';
  }

  const sentEmail = await db.sentEmail.create({
    data: {
      contactId: contactId || '',
      templateId: templateId || null,
      toEmail: finalToEmail,
      toName: finalToName,
      subject: finalSubject,
      body: finalBody,
      status: sendStatus,
      error: sendError,
      sentAt: sendStatus === 'sent' ? new Date() : null,
      attachments: attachments && attachments.length > 0 ? JSON.stringify(attachments.map(a => a.filename)) : null,
    },
  });

  await db.activityLog.create({
    data: {
      action: 'SENT',
      category: 'email',
      status: sendStatus === 'sent' ? 'success' : 'error',
      details: JSON.stringify({
        sentEmailId: sentEmail.id,
        to: finalToEmail,
        subject: finalSubject,
        smtpUsed: !!smtpConfig,
        messageId,
      }),
    },
  });

  if (sendStatus === 'failed') {
    return NextResponse.json({ error: sendError, sentEmail }, { status: 422 });
  }

  return NextResponse.json(sentEmail, { status: 201 });
}

async function handleBulkSend(
  contactIds: string[],
  templateId: string | null,
  subject: string | null,
  body: string | null,
  attachments?: Attachment[]
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

  const smtpConfig = await getSmtpConfig();
  const results = [];
  let successCount = 0;
  let failCount = 0;
  const errors: string[] = [];

  for (const contact of contacts) {
    try {
      const emailSubject = template
        ? fillPlaceholders(template.subject, { name: contact.name, email: contact.email, company: contact.company || '' })
        : fillPlaceholders(subject || '', { name: contact.name, email: contact.email, company: contact.company || '' });

      const emailBody = template
        ? fillPlaceholders(template.body, { name: contact.name, email: contact.email, company: contact.company || '' })
        : fillPlaceholders(body || '', { name: contact.name, email: contact.email, company: contact.company || '' });

      let sendStatus: 'sent' | 'failed' = 'sent';
      let sendError: string | null = null;

      if (smtpConfig) {
        const result = await sendRealEmail(smtpConfig, contact.email, contact.name, emailSubject, emailBody, attachments);
        if (!result.success) {
          sendStatus = 'failed';
          sendError = result.error || 'SMTP error';
        }
      } else {
        sendStatus = 'failed';
        sendError = 'SMTP not configured. Go to Settings to add your SMTP credentials.';
      }

      const sentEmail = await db.sentEmail.create({
        data: {
          contactId: contact.id,
          templateId: templateId || null,
          toEmail: contact.email,
          toName: contact.name,
          subject: emailSubject,
          body: emailBody,
          status: sendStatus,
          error: sendError,
          sentAt: sendStatus === 'sent' ? new Date() : null,
          attachments: attachments && attachments.length > 0 ? JSON.stringify(attachments.map(a => a.filename)) : null,
        },
      });

      results.push(sentEmail);

      if (sendStatus === 'sent') {
        successCount++;
      } else {
        failCount++;
        if (sendError && !errors.includes(sendError)) {
          errors.push(sendError);
        }
      }
    } catch (err: unknown) {
      failCount++;
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (!errors.includes(msg)) errors.push(msg);
      await db.sentEmail.create({
        data: {
          contactId: contact.id,
          templateId: templateId || null,
          toEmail: contact.email,
          toName: contact.name,
          subject: '',
          body: '',
          status: 'failed',
          error: msg,
        },
      });
    }
  }

  await db.activityLog.create({
    data: {
      action: 'BULK_SEND',
      category: 'email',
      status: failCount > 0 ? (successCount > 0 ? 'warning' : 'error') : 'success',
      details: JSON.stringify({
        total: contactIds.length,
        success: successCount,
        failed: failCount,
        smtpUsed: !!smtpConfig,
        errors: errors.length > 0 ? errors : undefined,
        templateId: templateId || 'custom',
      }),
    },
  });

  return NextResponse.json({
    total: contactIds.length,
    success: successCount,
    failed: failCount,
    errors: errors.length > 0 ? errors : undefined,
    smtpConfigured: !!smtpConfig,
    emails: results,
  }, { status: 201 });
}

// ---------- PUT ----------

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

// ---------- DELETE ----------

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
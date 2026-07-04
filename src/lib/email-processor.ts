import { db } from './db';
import { generateAIResponse } from './ai-service';
import nodemailer from 'nodemailer';
import { decrypt } from './crypto';

function evaluateCondition(email: { from: string; subject: string; body: string }, condition: { field: string; operator: string; value: string }) {
  const fieldValue = (email[condition.field as keyof typeof email] || '').toLowerCase();
  const matchValue = (condition.value || '').toLowerCase();

  switch (condition.operator) {
    case 'contains':
      return fieldValue.includes(matchValue);
    case 'equals':
      return fieldValue === matchValue;
    case 'startsWith':
      return fieldValue.startsWith(matchValue);
    case 'regex':
      try {
        const re = new RegExp(matchValue, 'i');
        return re.test(fieldValue);
      } catch {
        return false;
      }
    default:
      return false;
  }
}

async function sendAutoReply(
  smtpConfig: any,
  toEmail: string,
  toName: string | null,
  subject: string,
  body: string,
  receivedEmailId: string,
  ruleId: string
) {
  const decryptedPassword = decrypt(smtpConfig.password);
  const transport = nodemailer.createTransport({
    host: smtpConfig.host,
    port: parseInt(smtpConfig.port || '587', 10),
    secure: smtpConfig.secure === 'true',
    auth: {
      user: smtpConfig.email,
      pass: decryptedPassword,
    },
  });

  try {
    const info = await transport.sendMail({
      from: `"${smtpConfig.fromName || smtpConfig.email}" <${smtpConfig.email}>`,
      to: toName ? `"${toName}" <${toEmail}>` : toEmail,
      subject: `Re: ${subject}`,
      html: body.replace(/\n/g, '<br />'),
      text: body,
    });

    const sentEmail = await db.sentEmail.create({
      data: {
        contactId: '',
        toEmail,
        toName,
        subject: `Re: ${subject}`,
        body,
        status: 'sent',
        sentAt: new Date(),
      },
    });

    await db.receivedEmail.update({
      where: { id: receivedEmailId },
      data: {
        autoReplied: true,
        replyRuleId: ruleId,
        aiReplyStatus: 'sent',
        aiReplyDraft: body,
      },
    });

    await db.activityLog.create({
      data: {
        action: 'AUTO_REPLY',
        category: 'email',
        status: 'success',
        details: JSON.stringify({ receivedEmailId, sentEmailId: sentEmail.id, ruleId, to: toEmail, messageId: info.messageId }),
      },
    });
  } catch (err: any) {
    console.error('Auto-reply failed:', err);
    await db.activityLog.create({
      data: {
        action: 'AUTO_REPLY',
        category: 'email',
        status: 'error',
        details: JSON.stringify({ receivedEmailId, ruleId, error: err.message || 'SMTP failed' }),
      },
    });
  } finally {
    transport.close();
  }
}

export async function processIncomingEmail(emailRecordId: string) {
  const emailRecord = await db.receivedEmail.findUnique({
    where: { id: emailRecordId },
  });

  if (!emailRecord) return;

  const configs = await db.emailConfig.findMany();
  const map: Record<string, string> = {};
  for (const c of configs) map[c.key] = c.value;

  // 1. Run AI Classification & Summarization
  if (map.ai_enabled === 'true') {
    try {
      const systemPrompt = `You are an AI Email Analyst. Analyze the incoming email and output a JSON object containing:
- "category": Must be one of: "interview", "recruiter", "rejection", "offer", "spam", "newsletter", "promotion", "other".
- "summary": A one-sentence summary of the email.
- "extractedInfo": A JSON object containing key details like "interviewDate", "recruiterName", "companyName", "roleName" if present, else null.`;

      const userPrompt = `From: ${emailRecord.fromName || ''} <${emailRecord.fromEmail}>
Subject: ${emailRecord.subject}
Body:
${emailRecord.body || ''}`;

      const aiResponse = await generateAIResponse(systemPrompt, userPrompt, true);
      if (aiResponse) {
        const aiData = JSON.parse(aiResponse);
        await db.receivedEmail.update({
          where: { id: emailRecord.id },
          data: {
            category: aiData.category || 'other',
            summary: aiData.summary || null,
            extractedInfo: aiData.extractedInfo ? JSON.stringify(aiData.extractedInfo) : null,
          },
        });
      }
    } catch (err) {
      console.error('AI processing of email failed:', err);
    }
  }

  // Reload email record
  const updatedEmail = await db.receivedEmail.findUnique({
    where: { id: emailRecordId },
  });
  if (!updatedEmail) return;

  // 2. Evaluate Rules
  const rules = await db.responseRule.findMany({
    where: { isActive: true },
    orderBy: { priority: 'desc' },
  });

  const emailObj = {
    from: updatedEmail.fromEmail,
    subject: updatedEmail.subject,
    body: updatedEmail.body || '',
  };

  let smtpConfig: any = null;
  if (map.smtp_host && map.smtp_email && map.smtp_password) {
    smtpConfig = {
      host: map.smtp_host,
      port: map.smtp_port,
      secure: map.smtp_secure,
      email: map.smtp_email,
      password: map.smtp_password,
      fromName: map.smtp_from_name,
    };
  }

  for (const rule of rules) {
    try {
      const conditions = JSON.parse(rule.conditions);
      const isMatch = conditions.every((cond: any) => evaluateCondition(emailObj, cond));

      if (isMatch) {
        const replyTemplate = rule.replyTemplate;
        const contact = updatedEmail.contactId ? await db.contact.findUnique({ where: { id: updatedEmail.contactId } }) : null;

        let replyBody = replyTemplate
          .replace(/\{\{name\}\}/gi, contact?.name || updatedEmail.fromName || 'there')
          .replace(/\{\{email\}\}/gi, updatedEmail.fromEmail)
          .replace(/\{\{company\}\}/gi, contact?.company || 'your company');

        if (map.auto_reply_enabled === 'true' && smtpConfig) {
          await sendAutoReply(smtpConfig, updatedEmail.fromEmail, updatedEmail.fromName, updatedEmail.subject, replyBody, updatedEmail.id, rule.id);
        } else {
          // Store draft
          await db.receivedEmail.update({
            where: { id: updatedEmail.id },
            data: {
              aiReplyDraft: replyBody,
              aiReplyStatus: 'drafted',
              replyRuleId: rule.id,
            },
          });

          await db.activityLog.create({
            data: {
              action: 'RULE_TRIGGERED',
              category: 'rule',
              status: 'success',
              details: JSON.stringify({ receivedEmailId: updatedEmail.id, ruleId: rule.id, name: rule.name, replyStatus: 'drafted' }),
            },
          });
        }
        break;
      }
    } catch (e) {
      console.error(`Rule processing failed for rule ${rule.name}:`, e);
    }
  }
}

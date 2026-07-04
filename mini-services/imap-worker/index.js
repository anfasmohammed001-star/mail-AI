import { PrismaClient } from '@prisma/client';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';

const db = new PrismaClient();

// Crypto Decryption (matches src/lib/crypto.ts)
const ALGORITHM = 'aes-256-gcm';
function decrypt(cipherText) {
  if (!cipherText) return '';
  try {
    const parts = cipherText.split(':');
    if (parts.length !== 3) return cipherText;
    const [ivHex, encryptedHex, authTagHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const envKey = process.env.ENCRYPTION_KEY;
    const computerName = process.env.COMPUTERNAME || process.env.HOSTNAME || 'local_agent_dev';
    const finalSecret = envKey || `secure_salt_${computerName}_mail_agent_key_hash_32_bytes_long!!`;
    const derivedKey = crypto.scryptSync(finalSecret, 'mail_agent_salt', 32);
    const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    return cipherText;
  }
}

// SMTP Helper to auto-reply
async function sendAutoReply(smtpConfig, toEmail, toName, subject, body, receivedEmailId, ruleId) {
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

    // Save SentEmail record
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

    // Update ReceivedEmail status
    await db.receivedEmail.update({
      where: { id: receivedEmailId },
      data: {
        autoReplied: true,
        replyRuleId: ruleId,
        aiReplyStatus: 'sent',
        aiReplyDraft: body,
      },
    });

    // Log Activity
    await db.activityLog.create({
      data: {
        action: 'AUTO_REPLY',
        category: 'email',
        status: 'success',
        details: JSON.stringify({
          receivedEmailId,
          sentEmailId: sentEmail.id,
          ruleId,
          to: toEmail,
          messageId: info.messageId,
        }),
      },
    });
  } catch (err) {
    console.error('Auto reply failed:', err);
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

// AI Service Client (call local Ollama/LM Studio or cloud APIs via HTTP Fetch)
async function getAIConfig() {
  const configs = await db.emailConfig.findMany();
  const map = {};
  for (const c of configs) map[c.key] = c.value;
  return {
    enabled: map.ai_enabled === 'true',
    provider: map.ai_provider || 'ollama',
    model: map.ai_model || 'llama3',
    endpoint: map.ai_endpoint || 'http://localhost:11434',
    apiKey: map.ai_api_key ? decrypt(map.ai_api_key) : '',
  };
}

async function callAI(systemPrompt, userPrompt, jsonMode = false) {
  const config = await getAIConfig();
  if (!config.enabled) return null;
  const { provider, model, endpoint, apiKey } = config;
  const cleanEndpoint = endpoint.replace(/\/$/, '');

  try {
    if (provider === 'ollama') {
      const res = await fetch(`${cleanEndpoint}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          stream: false,
          format: jsonMode ? 'json' : undefined,
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.message?.content || '';
    } else if (provider === 'lm_studio' || provider === 'openai') {
      const headers = { 'Content-Type': 'application/json' };
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
      const url = provider === 'openai' ? 'https://api.openai.com/v1/chat/completions' : `${cleanEndpoint}/v1/chat/completions`;
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.3,
          response_format: jsonMode ? { type: 'json_object' } : undefined,
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.choices?.[0]?.message?.content || '';
    } else if (provider === 'gemini') {
      if (!apiKey) return null;
      const finalModel = model.includes('models/') ? model : `models/${model}`;
      const url = `${cleanEndpoint}/v1beta/${finalModel}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: `${systemPrompt}\n\nUser Content:\n${userPrompt}` }],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            responseMimeType: jsonMode ? 'application/json' : 'text/plain',
          },
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }
  } catch (err) {
    console.error('Background AI call failed:', err);
  }
  return null;
}

// Rules Engine
function evaluateCondition(email, condition) {
  const fieldValue = (email[condition.field] || '').toLowerCase();
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

async function processEmailThroughRules(emailRecord, emailObj, smtpConfig) {
  const rules = await db.responseRule.findMany({
    where: { isActive: true },
    orderBy: { priority: 'desc' },
  });

  for (const rule of rules) {
    try {
      const conditions = JSON.parse(rule.conditions);
      const isMatch = conditions.every((cond) => evaluateCondition(emailObj, cond));

      if (isMatch) {
        // Auto reply match!
        console.log(`Email matched rule: "${rule.name}"`);
        const replyTemplate = rule.replyTemplate;
        const contact = emailRecord.contactId ? await db.contact.findUnique({ where: { id: emailRecord.contactId } }) : null;
        
        let replyBody = replyTemplate
          .replace(/\{\{name\}\}/gi, contact?.name || emailRecord.fromName || 'there')
          .replace(/\{\{email\}\}/gi, emailRecord.fromEmail)
          .replace(/\{\{company\}\}/gi, contact?.company || 'your company');

        // Check if auto-reply send is configured globally or default to drafting
        const configs = await db.emailConfig.findMany();
        const map = {};
        for (const c of configs) map[c.key] = c.value;

        if (map.auto_reply_enabled === 'true' && smtpConfig) {
          await sendAutoReply(smtpConfig, emailRecord.fromEmail, emailRecord.fromName, emailRecord.subject, replyBody, emailRecord.id, rule.id);
        } else {
          // Store reply draft for approval
          await db.receivedEmail.update({
            where: { id: emailRecord.id },
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
              details: JSON.stringify({ receivedEmailId: emailRecord.id, ruleId: rule.id, name: rule.name, replyStatus: 'drafted' }),
            },
          });
        }
        break; // Stop at first matching rule (since they are ordered by priority desc)
      }
    } catch (e) {
      console.error(`Failed to process rule ${rule.id}:`, e);
    }
  }
}

// IMAP Poller Loop
let lastCheckTime = new Date();

async function pollIMAP() {
  const configs = await db.emailConfig.findMany();
  const map = {};
  for (const c of configs) map[c.key] = c.value;

  if (!map.imap_host || !map.imap_email || !map.imap_password) {
    console.log('IMAP settings not fully configured, skipping sync...');
    return;
  }

  const client = new ImapFlow({
    host: map.imap_host,
    port: parseInt(map.imap_port || '993', 10),
    secure: map.imap_secure !== 'false',
    auth: {
      user: map.imap_email,
      pass: decrypt(map.imap_password),
    },
    logger: false,
  });

  try {
    await client.connect();
    let lock = await client.getMailboxLock('INBOX');
    try {
      // Find emails received since lastCheckTime or unseen
      // For local demo and safety, we search for UNSEEN emails
      const searchCriteria = { unseen: true };
      const messages = await client.search(searchCriteria);

      console.log(`Found ${messages.length} unseen emails on server.`);

      for (const uid of messages) {
        // Fetch MIME content
        let message = await client.fetchOne(uid, { source: true });
        let parsed = await simpleParser(message.source);

        const fromEmail = parsed.from?.value?.[0]?.address || '';
        const fromName = parsed.from?.value?.[0]?.name || null;
        const subject = parsed.subject || '(No Subject)';
        const body = parsed.text || parsed.html || '';

        // Check if email already exists in DB to prevent duplicates
        const existing = await db.receivedEmail.findFirst({
          where: {
            fromEmail,
            subject,
            receivedAt: parsed.date || new Date(),
          },
        });

        if (existing) continue;

        // Associate with Contact if exists
        const contact = await db.contact.findUnique({ where: { email: fromEmail } });

        // Save ReceivedEmail to Database
        const emailRecord = await db.receivedEmail.create({
          data: {
            contactId: contact ? contact.id : null,
            fromEmail,
            fromName,
            subject,
            body,
            isRead: false,
            receivedAt: parsed.date || new Date(),
          },
        });

        // Activity Log for incoming mail
        await db.activityLog.create({
          data: {
            action: 'RECEIVED',
            category: 'email',
            status: 'success',
            details: JSON.stringify({ emailId: emailRecord.id, from: fromEmail, subject }),
          },
        });

        // Run AI Classification & Summarization (if enabled)
        if (map.ai_enabled === 'true') {
          const systemPrompt = `You are an AI Email Analyst. Analyze the incoming email and output a JSON object containing:
- "category": Must be one of: "interview", "recruiter", "rejection", "offer", "spam", "newsletter", "promotion", "other".
- "summary": A one-sentence summary of the email.
- "extractedInfo": A JSON object containing key details like "interviewDate", "recruiterName", "companyName", "roleName" if present, else null.`;

          const userPrompt = `From: ${fromName || ''} <${fromEmail}>
Subject: ${subject}
Body:
${body.substring(0, 1500)}`;

          const aiResponse = await callAI(systemPrompt, userPrompt, true);
          if (aiResponse) {
            try {
              const aiData = JSON.parse(aiResponse);
              await db.receivedEmail.update({
                where: { id: emailRecord.id },
                data: {
                  category: aiData.category || 'other',
                  summary: aiData.summary || null,
                  extractedInfo: aiData.extractedInfo ? JSON.stringify(aiData.extractedInfo) : null,
                },
              });
            } catch (jsonErr) {
              console.error('Failed to parse AI JSON:', jsonErr, aiResponse);
            }
          }
        }

        // Run Response Rules & Auto-Reply
        let smtpConfig = null;
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
        await processEmailThroughRules(emailRecord, { from: fromEmail, subject, body }, smtpConfig);
      }
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (err) {
    console.error('IMAP sync failed:', err);
  }
}

// Scheduler: run every 30 seconds
async function startPoller() {
  console.log('Background IMAP worker starting...');
  // Immediate sync on startup
  await pollIMAP();
  
  setInterval(async () => {
    console.log('Running periodic IMAP sync...');
    await pollIMAP();
  }, 30000);
}

startPoller();

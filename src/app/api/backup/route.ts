import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import fs from 'fs';
import path from 'path';

// GET /api/backup — Export data or perform database file snapshot
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'export';

    if (action === 'snapshot') {
      const projectDir = process.cwd();
      const dbPath = path.join(projectDir, 'db', 'custom.db');
      const backupDir = path.join(projectDir, 'db', 'backups');

      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(backupDir, `custom_backup_${timestamp}.db`);

      fs.copyFileSync(dbPath, backupPath);

      // Log activity
      await db.activityLog.create({
        data: {
          action: 'DB_SNAPSHOT_BACKUP',
          category: 'system',
          status: 'success',
          details: JSON.stringify({ file: `custom_backup_${timestamp}.db` }),
        },
      });

      return NextResponse.json({ success: true, file: `custom_backup_${timestamp}.db` });
    }

    // Export data
    const [contacts, templates, rules, configs] = await Promise.all([
      db.contact.findMany(),
      db.emailTemplate.findMany(),
      db.responseRule.findMany(),
      db.emailConfig.findMany(),
    ]);

    // Mask secrets in export
    const safeConfigs = configs.map((c) => {
      if (c.key === 'smtp_password' || c.key === 'imap_password' || c.key === 'ai_api_key') {
        return { ...c, value: c.value ? '********' : '' };
      }
      return c;
    });

    const exportData = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      contacts,
      templates,
      rules,
      configs: safeConfigs,
    };

    return NextResponse.json(exportData);
  } catch (error: any) {
    console.error('Backup export failed:', error);
    return NextResponse.json({ error: error.message || 'Backup export failed' }, { status: 500 });
  }
}

// POST /api/backup — Restore data from import file
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { contacts, templates, rules, configs } = data;

    let restoredContacts = 0;
    let restoredTemplates = 0;
    let restoredRules = 0;
    let restoredConfigs = 0;

    if (contacts && Array.isArray(contacts)) {
      for (const c of contacts) {
        const res = await db.contact.upsert({
          where: { email: c.email },
          update: { name: c.name, company: c.company, phone: c.phone, customFields: c.customFields },
          create: { name: c.name, email: c.email, company: c.company, phone: c.phone, customFields: c.customFields },
        });
        if (res) restoredContacts++;
      }
    }

    if (templates && Array.isArray(templates)) {
      for (const t of templates) {
        const existing = await db.emailTemplate.findFirst({ where: { name: t.name } });
        if (existing) {
          await db.emailTemplate.update({
            where: { id: existing.id },
            data: { subject: t.subject, body: t.body, category: t.category, isActive: t.isActive },
          });
        } else {
          await db.emailTemplate.create({
            data: { name: t.name, subject: t.subject, body: t.body, category: t.category, isActive: t.isActive },
          });
        }
        restoredTemplates++;
      }
    }

    if (rules && Array.isArray(rules)) {
      for (const r of rules) {
        const existing = await db.responseRule.findFirst({ where: { name: r.name } });
        if (existing) {
          await db.responseRule.update({
            where: { id: existing.id },
            data: { description: r.description, conditions: r.conditions, replyTemplate: r.replyTemplate, isActive: r.isActive, priority: r.priority },
          });
        } else {
          await db.responseRule.create({
            data: { name: r.name, description: r.description, conditions: r.conditions, replyTemplate: r.replyTemplate, isActive: r.isActive, priority: r.priority },
          });
        }
        restoredRules++;
      }
    }

    if (configs && Array.isArray(configs)) {
      for (const c of configs) {
        if (c.value === '********') continue;
        await db.emailConfig.upsert({
          where: { key: c.key },
          update: { value: c.value },
          create: { key: c.key, value: c.value },
        });
        restoredConfigs++;
      }
    }

    // Log restore activity
    await db.activityLog.create({
      data: {
        action: 'DB_RESTORE',
        category: 'system',
        status: 'success',
        details: JSON.stringify({ restoredContacts, restoredTemplates, restoredRules, restoredConfigs }),
      },
    });

    return NextResponse.json({
      success: true,
      restoredContacts,
      restoredTemplates,
      restoredRules,
      restoredConfigs,
    });
  } catch (error: any) {
    console.error('Backup import failed:', error);
    return NextResponse.json({ error: error.message || 'Backup import failed' }, { status: 500 });
  }
}

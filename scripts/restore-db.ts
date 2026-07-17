import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const db = new PrismaClient();

async function main() {
  const backupPath = path.join(process.cwd(), 'db', 'backup.json');
  if (!fs.existsSync(backupPath)) {
    console.error('No backup file found at', backupPath);
    return;
  }
  
  const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  console.log('Restoring data to Supabase PostgreSQL...');

  // 1. Restore templates
  if (backupData.templates && backupData.templates.length > 0) {
    console.log(`Restoring ${backupData.templates.length} templates...`);
    for (const template of backupData.templates) {
      await db.emailTemplate.upsert({
        where: { id: template.id },
        update: {
          name: template.name,
          subject: template.subject,
          body: template.body,
          category: template.category,
          isActive: template.isActive,
        },
        create: {
          id: template.id,
          name: template.name,
          subject: template.subject,
          body: template.body,
          category: template.category,
          isActive: template.isActive,
          createdAt: new Date(template.createdAt),
          updatedAt: new Date(template.updatedAt),
        }
      });
    }
    console.log('Templates restored.');
  }

  // 2. Restore response rules
  if (backupData.rules && backupData.rules.length > 0) {
    console.log(`Restoring ${backupData.rules.length} response rules...`);
    for (const rule of backupData.rules) {
      await db.responseRule.upsert({
        where: { id: rule.id },
        update: {
          name: rule.name,
          description: rule.description,
          conditions: rule.conditions,
          replyTemplate: rule.replyTemplate,
          isActive: rule.isActive,
          priority: rule.priority,
        },
        create: {
          id: rule.id,
          name: rule.name,
          description: rule.description,
          conditions: rule.conditions,
          replyTemplate: rule.replyTemplate,
          isActive: rule.isActive,
          priority: rule.priority,
          createdAt: new Date(rule.createdAt),
          updatedAt: new Date(rule.updatedAt),
        }
      });
    }
    console.log('Response rules restored.');
  }

  // 3. Restore configs
  if (backupData.configs && backupData.configs.length > 0) {
    console.log(`Restoring ${backupData.configs.length} configs...`);
    for (const config of backupData.configs) {
      await db.emailConfig.upsert({
        where: { key: config.key },
        update: {
          value: config.value,
          isEncrypted: config.isEncrypted,
        },
        create: {
          id: config.id,
          key: config.key,
          value: config.value,
          isEncrypted: config.isEncrypted,
        }
      });
    }
    console.log('Configs restored.');
  }

  console.log('Database restore complete!');
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());

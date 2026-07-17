import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const db = new PrismaClient();

async function main() {
  console.log('Reading from SQLite...');
  
  const templates = await db.emailTemplate.findMany();
  const rules = await db.responseRule.findMany();
  const configs = await db.emailConfig.findMany();
  
  const backupData = {
    templates,
    rules,
    configs
  };
  
  const backupPath = path.join(process.cwd(), 'db', 'backup.json');
  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
  console.log(`Backup saved to ${backupPath}`);
  console.log(`Templates: ${templates.length}, Rules: ${rules.length}, Configs: ${configs.length}`);
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());

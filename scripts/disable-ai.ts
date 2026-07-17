import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  console.log('Setting ai_enabled to false...');
  await db.emailConfig.upsert({
    where: { key: 'ai_enabled' },
    update: { value: 'false' },
    create: { key: 'ai_enabled', value: 'false' }
  });
  console.log('AI disabled successfully in Supabase!');
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());

import { PrismaClient } from '@prisma/client';
import { decrypt } from '../src/lib/crypto';

const db = new PrismaClient();

async function main() {
  const rows = await db.emailConfig.findMany();
  const keyRow = rows.find((r: any) => r.key === 'ai_api_key');
  const providerRow = rows.find((r: any) => r.key === 'ai_provider');
  const endpointRow = rows.find((r: any) => r.key === 'ai_endpoint');
  const modelRow = rows.find((r: any) => r.key === 'ai_model');
  const enabledRow = rows.find((r: any) => r.key === 'ai_enabled');

  console.log('ai_enabled:', enabledRow?.value);
  console.log('ai_provider:', providerRow?.value);
  console.log('ai_endpoint:', endpointRow?.value);
  console.log('ai_model:', modelRow?.value);
  console.log('ai_api_key raw length:', keyRow?.value?.length || 0);
  
  if (keyRow?.value) {
    const decrypted = decrypt(keyRow.value);
    console.log('decrypted api_key length:', decrypted?.length || 0);
    console.log('decrypted api_key starts with:', decrypted?.substring(0, 10) || 'empty');
  } else {
    console.log('No API key set');
  }
  
  await db.$disconnect();
}

main().catch(console.error);

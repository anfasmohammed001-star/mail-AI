import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const db = new PrismaClient();

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getEncryptionKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY;
  const computerName = process.env.COMPUTERNAME || process.env.HOSTNAME || 'local_agent_dev';
  const finalSecret = envKey || `secure_salt_${computerName}_mail_agent_key_hash_32_bytes_long!!`;
  return crypto.scryptSync(finalSecret, 'mail_agent_salt', 32);
}

function encrypt(text: string): string {
  if (!text) return '';
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${encrypted}:${authTag}`;
  } catch (err) {
    console.error('Encryption failed:', err);
    return text;
  }
}

async function main() {
  const apiKey = "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";
  const encryptedKey = encrypt(apiKey);

  const configs = {
    ai_enabled: "true",
    ai_provider: "nvidia_nim",
    ai_endpoint: "https://integrate.api.nvidia.com",
    ai_model: "z-ai/glm-5.2",
    ai_api_key: encryptedKey
  };

  for (const [key, value] of Object.entries(configs)) {
    await db.emailConfig.upsert({
      where: { key },
      update: { value, updatedAt: new Date() },
      create: { key, value }
    });
  }

  console.log("NVIDIA NIM database configuration seeded successfully!");
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());

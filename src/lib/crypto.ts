import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getEncryptionKey(): Buffer {
  // Use a user-configured key from environment variables, or fall back to a computer-unique key
  const envKey = process.env.ENCRYPTION_KEY;
  const computerName = process.env.COMPUTERNAME || process.env.HOSTNAME || 'local_agent_dev';
  const finalSecret = envKey || `secure_salt_${computerName}_mail_agent_key_hash_32_bytes_long!!`;
  
  // Use scrypt to derive a consistent 32-byte key
  return crypto.scryptSync(finalSecret, 'mail_agent_salt', 32);
}

/**
 * Encrypts clear text using AES-256-GCM.
 * Output format is: iv_hex:encrypted_hex:auth_tag_hex
 */
export function encrypt(text: string): string {
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
    return text; // Fallback to raw text if encryption fails
  }
}

/**
 * Decrypts encrypted text using AES-256-GCM.
 * Gracefully returns the original text if it doesn't match the encrypted format.
 */
export function decrypt(cipherText: string): string {
  if (!cipherText) return '';
  try {
    const parts = cipherText.split(':');
    // If not in our encrypted format, it's probably clear text from before migration
    if (parts.length !== 3) return cipherText;
    
    const [ivHex, encryptedHex, authTagHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    // If decryption fails, it could be clear text, so return as-is
    return cipherText;
  }
}

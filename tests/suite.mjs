import assert from 'assert';
import crypto from 'crypto';

// Replicate or Import Cryptographic Functions
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TEST_KEY = 'secure_salt_test_machine_mail_agent_key_hash_32_bytes_long!!';
const derivedKey = crypto.scryptSync(TEST_KEY, 'mail_agent_salt', 32);

function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${encrypted}:${authTag}`;
}

function decrypt(cipherText) {
  const parts = cipherText.split(':');
  if (parts.length !== 3) return cipherText;
  const [ivHex, encryptedHex, authTagHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, undefined, 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Replicate Placeholder Interpolator
function fillPlaceholders(text, dict) {
  let result = text;
  for (const [k, v] of Object.entries(dict)) {
    result = result.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'gi'), v || '');
  }
  return result;
}

// Replicate Rules Engine Matching
function evaluateCondition(email, condition) {
  const fieldValue = (email[condition.field] || '').toLowerCase();
  const matchValue = (condition.value || '').toLowerCase();
  switch (condition.operator) {
    case 'contains': return fieldValue.includes(matchValue);
    case 'equals': return fieldValue === matchValue;
    case 'startsWith': return fieldValue.startsWith(matchValue);
    default: return false;
  }
}

async function runTests() {
  console.log('🧪 Starting MailAgent AI Test Suite...\n');

  // Test 1: Crypto Encryption
  console.log('▶️ Running Cryptographic Security Tests...');
  const secret = 'my_super_secret_smtp_password_123!';
  const cipher = encrypt(secret);
  assert.notStrictEqual(cipher, secret, 'Cipher text should not match plain text');
  const plain = decrypt(cipher);
  assert.strictEqual(plain, secret, 'Decrypted text should match original plain text');
  console.log('✅ Cryptographic Security Tests Passed!\n');

  // Test 2: Personalization Placeholders
  console.log('▶️ Running Personalization Variables Tests...');
  const template = 'Hello {{Name}}, welcome to {{Company}}!';
  const variables = { name: 'Alice', company: 'TechCorp' };
  const rendered = fillPlaceholders(template, variables);
  assert.strictEqual(rendered, 'Hello Alice, welcome to TechCorp!', 'Placeholders should be correctly replaced');
  console.log('✅ Personalization Variables Tests Passed!\n');

  // Test 3: Response Rules Engine
  console.log('▶️ Running Auto-Response Rules Engine Tests...');
  const email = { subject: 'Please unsubscribe me from this newsletter', body: 'Remove my email' };
  const condition = { field: 'subject', operator: 'contains', value: 'unsubscribe' };
  const match = evaluateCondition(email, condition);
  assert.strictEqual(match, true, 'Email subject containing unsubscribe should match the rule condition');
  
  const email2 = { subject: 'Partnership Inquiry', body: 'Let us collaborate' };
  const match2 = evaluateCondition(email2, condition);
  assert.strictEqual(match2, false, 'Email subject without unsubscribe should NOT match the rule condition');
  console.log('✅ Auto-Response Rules Engine Tests Passed!\n');

  console.log('🎉 All 3 Test Suites Passed Successfully!');
}

runTests().catch(err => {
  console.error('❌ Test Suite Failed:', err);
  process.exit(1);
});

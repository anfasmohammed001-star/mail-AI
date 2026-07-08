/*
  Integration test: delete-persistence.test.mjs

  Usage:
  - Ensure server is running at http://localhost:3000
  - Ensure DATABASE_URL points to your test DB
  - Run: node tests/delete-persistence.test.mjs
*/

import { PrismaClient } from '@prisma/client';

const API_BASE = process.env.API_BASE || 'http://localhost:3000';

(async function main() {
  const prisma = new PrismaClient();
  try {
    // 1) Create a contact via API
    const email = `test-delete-${Date.now()}@example.com`;
    const createRes = await fetch(`${API_BASE}/api/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Delete Test', email }),
    });
    if (!createRes.ok) {
      console.error('Create API failed', await createRes.text());
      process.exit(1);
    }
    const created = await createRes.json();
    const id = created.id || created?.id;
    if (!id) {
      console.error('Create response did not include id:', created);
      process.exit(1);
    }
    console.log('Created contact id:', id);

    // 2) Delete via API (path-based)
    const delRes = await fetch(`${API_BASE}/api/contacts/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!delRes.ok) {
      console.error('Delete API failed', delRes.status, await delRes.text());
      process.exit(1);
    }
    console.log('Delete API success');

    // 3) Verify DB: contact must NOT exist
    const found = await prisma.contact.findUnique({ where: { id } });
    if (found) {
      console.error('Test FAILED: contact still exists in DB after DELETE', found);
      process.exit(1);
    }
    console.log('PASS: contact not found in DB after DELETE');
    process.exit(0);
  } catch (err) {
    console.error('Test error', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();

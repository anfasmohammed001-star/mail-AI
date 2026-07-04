import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/contacts/bulk — Bulk import contacts
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contacts } = body as { contacts: Array<{ name: string; email: string; company?: string; phone?: string; customFields?: Record<string, string> }> };

    if (!contacts || !Array.isArray(contacts)) {
      return NextResponse.json({ error: 'An array of contacts is required' }, { status: 400 });
    }

    // Filter out invalid contacts (must have name and email)
    const validContacts = contacts.filter((c) => c.name?.trim() && c.email?.trim());

    if (validContacts.length === 0) {
      return NextResponse.json({ error: 'No valid contacts provided' }, { status: 400 });
    }

    // Format for Prisma insert
    const dataToInsert = validContacts.map((c) => ({
      name: c.name.trim(),
      email: c.email.trim().toLowerCase(),
      company: c.company?.trim() || null,
      phone: c.phone?.trim() || null,
      customFields: c.customFields ? JSON.stringify(c.customFields) : null,
    }));

    // Filter out existing emails to avoid duplicates on SQLite
    const emailsToInsert = dataToInsert.map(d => d.email);
    const existingContacts = await db.contact.findMany({
      where: { email: { in: emailsToInsert } },
      select: { email: true }
    });
    const existingEmails = new Set(existingContacts.map(c => c.email));
    const uniqueDataToInsert = dataToInsert.filter(d => !existingEmails.has(d.email));

    let importedCount = 0;
    if (uniqueDataToInsert.length > 0) {
      const result = await db.contact.createMany({
        data: uniqueDataToInsert,
      });
      importedCount = result.count;
    }

    // Log bulk insert activity
    await db.activityLog.create({
      data: {
        action: 'CONTACTS_BULK_IMPORT',
        category: 'contact',
        status: 'success',
        details: JSON.stringify({ total: validContacts.length, imported: importedCount }),
      },
    });

    return NextResponse.json({
      success: true,
      total: validContacts.length,
      imported: importedCount,
      skipped: validContacts.length - importedCount,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Bulk contacts import failed:', error);
    return NextResponse.json({ error: error.message || 'Failed to import contacts' }, { status: 500 });
  }
}

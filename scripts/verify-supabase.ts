import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  console.log('--- Database Verification Script ---');
  
  // 1. Fetch templates
  const templates = await db.emailTemplate.findMany();
  console.log(`Successfully fetched ${templates.length} templates from Supabase.`);
  for (const t of templates) {
    console.log(`- Template ID: ${t.id}, Name: ${t.name}`);
  }
  
  // 2. Create a test contact
  console.log('Creating a test contact...');
  const testContact = await db.contact.create({
    data: {
      name: 'Verification Test User',
      email: 'verification-test@example.com',
      company: 'Test Company',
      phone: '123-456-7890'
    }
  });
  console.log(`Created contact with ID: ${testContact.id}`);
  
  // 3. Retrieve the contact
  const fetchedContact = await db.contact.findUnique({
    where: { id: testContact.id }
  });
  if (fetchedContact) {
    console.log(`Successfully retrieved contact: ${fetchedContact.name} (${fetchedContact.email})`);
  } else {
    throw new Error('Failed to retrieve the created contact!');
  }
  
  // 4. Delete the contact
  console.log('Deleting the test contact...');
  await db.contact.delete({
    where: { id: testContact.id }
  });
  console.log('Deleted contact.');
  
  // 5. Verify deletion
  const afterDelete = await db.contact.findUnique({
    where: { id: testContact.id }
  });
  if (!afterDelete) {
    console.log('Verification successful: Contact was successfully deleted.');
  } else {
    throw new Error('Contact still exists after deletion!');
  }
  
  console.log('--- Database Verification Complete & Successful! ---');
}

main()
  .catch(err => {
    console.error('Verification failed:', err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
